#!/usr/bin/env node
// Обновляет data/places.json свежими данными OpenStreetMap (через Overpass API).
// Запуск:  node scripts/update-data.mjs
// Настройки — в config.json. Переменные окружения:
//   OVERPASS_URL   — использовать только этот сервер Overpass
//   CHECK_SITES=0  — пропустить проверку доступности сайтов (и аудит качества вместе с ней)
//   AUDIT_SITES=0  — проверять только доступность, без аудита качества сайтов

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildQuery, fetchOverpass, normalizeResponse, siteStatus, OVERPASS_ENDPOINTS } from '../js/osm.js';
import { mergeHistory, diffSummary, isNew } from '../js/history.js';
import { auditSite } from './site-quality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'places.json');
const USER_AGENT = 'establishments-map-updater/1.0 (static site data refresh)';

const log = (...args) => console.log(...args);
const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `ВНИМАНИЕ: ${msg}`);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Делит большой прямоугольник на плитки, чтобы запросы были лёгкими для Overpass. */
export function splitBbox([s, w, n, e], maxSpan = 0.12) {
  const rows = Math.max(1, Math.ceil((n - s) / maxSpan));
  const cols = Math.max(1, Math.ceil((e - w) / (maxSpan * 1.8)));
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push([
        s + ((n - s) * r) / rows,
        w + ((e - w) * c) / cols,
        s + ((n - s) * (r + 1)) / rows,
        w + ((e - w) * (c + 1)) / cols,
      ].map((x) => Math.round(x * 1e5) / 1e5));
    }
  }
  return tiles;
}

/**
 * Проверка сайта. Помечаем «не открывается» только в однозначных случаях
 * (домен не существует или страница отдаёт 404/410), чтобы не было ложных срабатываний
 * из-за блокировок по географии, защиты от ботов и временных сбоев.
 */
export async function checkSite(url, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; establishments-map-check/1.0)', Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(12000),
    });
    try { await res.body?.cancel(); } catch { /* тело ответа не нужно */ }
    return res.status === 404 || res.status === 410 ? 'dead' : 'ok';
  } catch (err) {
    const code = err?.cause?.code || '';
    return code === 'ENOTFOUND' ? 'dead' : 'unknown';
  }
}

/**
 * Доступность и качество сайта одним запросом: аудит (auditSite) скачивает страницу,
 * а мы подсматриваем за его запросом и выносим тот же осторожный вердикт, что и checkSite.
 * @returns {Promise<{check: 'ok'|'dead'|'unknown', issues: string[]|null}>}
 *   issues — id проблем, если сайт ответил успешно и отдал HTML; иначе null.
 */
export async function inspectSite(url, fetchImpl = fetch) {
  let check = 'unknown';
  const spy = async (target, init) => {
    try {
      const res = await fetchImpl(target, init);
      check = res?.status === 404 || res?.status === 410 ? 'dead' : 'ok';
      return res;
    } catch (err) {
      check = (err?.cause?.code || '') === 'ENOTFOUND' ? 'dead' : 'unknown';
      throw err;
    }
  };
  const result = await auditSite(url, spy);
  return { check, issues: result.ok ? result.issues : null };
}

/**
 * Проверяет сайты заведений (каждый адрес — один раз) и дописывает результат прямо в объекты:
 * siteCheck = 'dead' — сайт однозначно не открывается (подтверждено повторной попыткой);
 * siteIssues = [...] — найденные проблемы качества (только если они есть и audit включён).
 */
export async function checkSites(places, { concurrency = 24, audit = true, fetchImpl = fetch } = {}) {
  const targets = places.filter((p) => p.website);
  const byUrl = new Map();

  async function inspect(url) {
    const first = audit ? await inspectSite(url, fetchImpl) : { check: await checkSite(url, fetchImpl), issues: null };
    if (first.check !== 'dead') return { dead: false, issues: first.issues };
    // Одна повторная попытка, чтобы исключить случайный сбой DNS.
    return { dead: (await checkSite(url, fetchImpl)) === 'dead', issues: null };
  }

  let index = 0;
  let dead = 0;
  let withIssues = 0;
  async function worker() {
    while (index < targets.length) {
      const place = targets[index++];
      if (!byUrl.has(place.website)) byUrl.set(place.website, inspect(place.website));
      const result = await byUrl.get(place.website);
      if (result.dead) {
        place.siteCheck = 'dead';
        dead++;
      } else if (result.issues?.length) {
        place.siteIssues = [...result.issues];
        withIssues++;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { checked: targets.length, dead, withIssues };
}

async function main() {
  const config = await readJson(CONFIG_FILE, null);
  if (!config || !Array.isArray(config.areas) || !config.areas.length) {
    throw new Error('config.json: нужен непустой список areas');
  }
  const endpoints = process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : config.overpassEndpoints || OVERPASS_ENDPOINTS;
  const previous = await readJson(DATA_FILE, null);

  const all = new Map();
  for (const area of config.areas) {
    const tiles = splitBbox(area.bbox);
    log(`Область «${area.name}»: ${tiles.length} запрос(ов) к Overpass`);
    for (const [i, tile] of tiles.entries()) {
      const json = await fetchOverpass(buildQuery(tile, { timeout: 180 }), {
        endpoints,
        timeoutMs: 200000,
        headers: { 'User-Agent': USER_AGENT },
      });
      const places = normalizeResponse(json);
      for (const p of places) all.set(p.id, p);
      log(`  плитка ${i + 1}/${tiles.length}: ${places.length} заведений`);
      if (i < tiles.length - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const fetched = [...all.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!fetched.length) throw new Error('Overpass вернул пустой результат — данные не перезаписаны');
  const prevCount = previous && !previous.demo ? previous.places?.length || 0 : 0;
  if (prevCount && fetched.length < prevCount * 0.5) {
    throw new Error(`Получено ${fetched.length} заведений против ${prevCount} раньше — похоже на сбой, данные не перезаписаны`);
  }

  // История: дата первого появления заведения и дата, когда у него пропал или появился сайт.
  // После демонстрационных данных (и при первом запуске) историю не датируем.
  const prevIsDemo = !previous || !!previous.demo;
  const places = mergeHistory(previous?.places, fetched, { prevIsDemo });
  const diff = diffSummary(previous?.places, fetched, { prevIsDemo });
  if (prevIsDemo) log('История изменений начнётся со следующего обновления: сравнивать пока не с чем.');
  else log(`Изменения с прошлого обновления: новых заведений ${diff.added}, исчезло ${diff.removed}, сайт пропал у ${diff.siteLost}, сайт появился у ${diff.siteGained}`);

  const checkEnabled = config.checkSites !== false && process.env.CHECK_SITES !== '0';
  const auditEnabled = checkEnabled && config.auditSites !== false && process.env.AUDIT_SITES !== '0';
  if (checkEnabled) {
    log(auditEnabled ? 'Проверяю доступность и качество сайтов…' : 'Проверяю доступность сайтов…');
    const { checked, dead, withIssues } = await checkSites(places, { audit: auditEnabled });
    log(`  проверено ${checked}, не открываются: ${dead}${auditEnabled ? `, с проблемами: ${withIssues}` : ''}`);
  }

  const stats = { total: places.length, site: 0, social: 0, none: 0, dead: 0, issues: 0, new: 0 };
  for (const p of places) {
    stats[siteStatus(p)]++;
    if (p.siteIssues?.length) stats.issues++;
    if (isNew(p)) stats.new++;
  }

  // Если данные не изменились, оставляем прежнюю дату и файл целиком — так не будет пустых коммитов.
  // Счётчики сравниваем тоже: число «новых» меняется со временем и при тех же заведениях.
  const same = !prevIsDemo &&
    JSON.stringify(previous.places) === JSON.stringify(places) &&
    JSON.stringify(previous.stats) === JSON.stringify(stats);
  const output = {
    generated: same ? previous.generated : new Date().toISOString(),
    source: 'OpenStreetMap (Overpass API)',
    license: 'ODbL — © участники OpenStreetMap',
    areas: config.areas.map(({ name, bbox }) => ({ name, bbox })),
    sitesChecked: checkEnabled,
    sitesAudited: auditEnabled,
    stats,
    places,
  };
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(output) + '\n');
  log(`Готово: ${stats.total} заведений (с сайтом ${stats.site}, только соцсети ${stats.social}, без сайта ${stats.none}, сайт не открывается ${stats.dead}; сайтов с проблемами ${stats.issues}, новых за 14 дней ${stats.new})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    warn(`Данные не обновлены: ${err.message}`);
    // В GitHub Actions не роняем сборку: сайт продолжит работать на прежних данных.
    process.exit(process.env.GITHUB_ACTIONS ? 0 : 1);
  });
}
