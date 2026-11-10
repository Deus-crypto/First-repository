// Общая логика работы с данными OpenStreetMap.
// Модуль без зависимостей от DOM: используется и в браузере, и в scripts/update-data.mjs.

import { KINDS } from './categories.js';

/** Ключи OSM в порядке приоритета при определении типа заведения. */
export const KIND_KEYS = ['amenity', 'shop', 'tourism', 'leisure', 'craft', 'office', 'healthcare'];

/** Для этих ключей берём любые значения (кроме мусорных). */
const WILDCARD_KEYS = new Set(['shop', 'craft', 'office']);
const IGNORED_VALUES = new Set(['yes', 'no', 'vacant', 'disused', 'abandoned', 'government']);

/** Публичные серверы Overpass API. Пробуем по очереди. */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Домены, которые считаем «не сайтом»: соцсети, мессенджеры, агрегаторы. */
export const SOCIAL_HOSTS = [
  'vk.com', 'vk.ru', 'vk.link', 'ok.ru', 't.me', 'telegram.me', 'telegram.org',
  'instagram.com', 'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'youtube.com',
  'youtu.be', 'tiktok.com', 'wa.me', 'whatsapp.com', 'viber.com', 'dzen.ru',
  'rutube.ru', 'taplink.cc', 'taplink.ru', 'linktr.ee', '2gis.ru', 'go.2gis.com',
  'yandex.ru', 'yandex.com', 'ya.ru', 'google.com', 'goo.gl', 'maps.app.goo.gl',
  'tripadvisor.ru', 'tripadvisor.com', 'zoon.ru', 'flamp.ru', 'avito.ru',
  'booking.com', 'ostrovok.ru', 'eda.yandex.ru', 'delivery-club.ru',
];

/** Теги с соцсетями и шаблон ссылки, если в теге указан только ник. */
const SOCIAL_TAGS = {
  'contact:vk': 'https://vk.com/',
  vk: 'https://vk.com/',
  'contact:telegram': 'https://t.me/',
  telegram: 'https://t.me/',
  'contact:instagram': 'https://instagram.com/',
  instagram: 'https://instagram.com/',
  'contact:facebook': 'https://facebook.com/',
  facebook: 'https://facebook.com/',
  'contact:ok': 'https://ok.ru/',
  'contact:youtube': 'https://youtube.com/',
  'contact:tiktok': 'https://tiktok.com/@',
  'contact:whatsapp': 'https://wa.me/',
};

const WEBSITE_TAGS = ['website', 'contact:website', 'url', 'website:ru', 'contact:url'];

/**
 * Приводит значение тега к аккуратному http(s)-адресу.
 * Возвращает '' для пустых и заведомо некорректных значений.
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') return '';
  let value = raw.split(';')[0].trim();
  if (!value || /\s/.test(value)) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = 'https://' + value.replace(/^\/+/, '');
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (!url.hostname.includes('.')) return '';
    return url.href;
  } catch {
    return '';
  }
}

/** Домен без www. в нижнем регистре ('' если адрес некорректен). */
export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  } catch {
    return '';
  }
}

/** true, если ссылка ведёт в соцсеть / мессенджер / агрегатор, а не на собственный сайт. */
export function isSocialUrl(url) {
  const host = hostOf(url);
  if (!host) return false;
  return SOCIAL_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

/** Список селекторов Overpass, построенный из справочника категорий. */
export function buildSelectors(kinds = KINDS) {
  const byKey = new Map();
  for (const kind of Object.keys(kinds)) {
    const [key, value] = kind.split('=');
    if (!KIND_KEYS.includes(key) || !/^[a-z0-9_]+$/.test(value || '')) continue;
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key).add(value);
  }
  const selectors = [];
  for (const key of KIND_KEYS) {
    if (WILDCARD_KEYS.has(key)) selectors.push(`["${key}"]`);
    else if (byKey.has(key)) selectors.push(`["${key}"~"^(${[...byKey.get(key)].sort().join('|')})$"]`);
  }
  return selectors;
}

/**
 * Текст запроса Overpass QL для прямоугольника.
 * @param {number[]} bbox [юг, запад, север, восток]
 */
export function buildQuery(bbox, { timeout = 120, kinds = KINDS } = {}) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
    throw new TypeError('bbox должен быть массивом [юг, запад, север, восток]');
  }
  const [s, w, n, e] = bbox;
  if (s >= n || w >= e) throw new RangeError('bbox: юг должен быть меньше севера, запад — меньше востока');
  const box = `(${s},${w},${n},${e})`;
  const lines = buildSelectors(kinds).map((sel) => `  nwr["name"]${sel}${box};`);
  return `[out:json][timeout:${timeout}];\n(\n${lines.join('\n')}\n);\nout center tags;`;
}

function pickKind(tags, kinds) {
  for (const key of KIND_KEYS) {
    const value = tags[key];
    if (!value) continue;
    const first = value.split(';')[0].trim();
    if (!first || IGNORED_VALUES.has(first)) continue;
    const kind = `${key}=${first}`;
    if (WILDCARD_KEYS.has(key) || kind in kinds) return kind;
  }
  return '';
}

function collectLinks(tags) {
  const websites = [];
  const social = [];
  const add = (url) => {
    if (!url) return;
    const list = isSocialUrl(url) ? social : websites;
    if (!list.includes(url)) list.push(url);
  };
  for (const key of WEBSITE_TAGS) add(normalizeUrl(tags[key]));
  for (const [key, prefix] of Object.entries(SOCIAL_TAGS)) {
    const raw = (tags[key] || '').split(';')[0].trim();
    if (!raw) continue;
    const url = /^https?:\/\//i.test(raw) || raw.includes('.')
      ? normalizeUrl(raw)
      : normalizeUrl(prefix + raw.replace(/^@/, '').replace(/[^\w.+-]/g, ''));
    if (url && !social.includes(url)) social.push(url);
  }
  return { website: websites[0] || '', social };
}

function buildAddress(tags) {
  if (tags['addr:full']) return tags['addr:full'];
  const street = tags['addr:street'] || tags['addr:place'] || '';
  const house = tags['addr:housenumber'] || '';
  const line = [street, house].filter(Boolean).join(', ');
  return [tags['addr:city'], line].filter(Boolean).join(', ');
}

/**
 * Превращает элемент ответа Overpass в компактное описание заведения.
 * Возвращает null, если элемент нам не подходит.
 */
export function normalizeElement(el, kinds = KINDS) {
  if (!el || !el.tags) return null;
  const tags = el.tags;
  const name = (tags['name:ru'] || tags.name || '').trim();
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const kind = pickKind(tags, kinds);
  if (!kind) return null;

  const { website, social } = collectLinks(tags);
  const place = {
    id: `${(el.type || 'n')[0]}${el.id}`,
    lat: Math.round(lat * 1e6) / 1e6,
    lon: Math.round(lon * 1e6) / 1e6,
    name,
    kind,
  };
  if (website) place.website = website;
  if (social.length) place.social = social;
  const phone = (tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '').split(';')[0].trim();
  if (phone) place.phone = phone;
  const email = (tags.email || tags['contact:email'] || '').split(';')[0].trim();
  if (email) place.email = email;
  const address = buildAddress(tags);
  if (address) place.address = address;
  if (tags.opening_hours) place.hours = tags.opening_hours;
  if (tags.brand) place.brand = tags.brand;
  return place;
}

/** Нормализует ответ Overpass целиком, убирая дубликаты. Результат отсортирован по id. */
export function normalizeResponse(json, kinds = KINDS) {
  const map = new Map();
  for (const el of json?.elements || []) {
    const place = normalizeElement(el, kinds);
    if (place) map.set(place.id, place);
  }
  return [...map.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Главный признак проекта:
 *  'none'   — нет ни сайта, ни соцсетей;
 *  'social' — есть только страница в соцсети / агрегаторе;
 *  'dead'   — сайт указан, но при автоматической проверке не открылся;
 *  'site'   — есть собственный сайт.
 */
export function siteStatus(place) {
  if (place.website) return place.siteCheck === 'dead' ? 'dead' : 'site';
  return place.social && place.social.length ? 'social' : 'none';
}

export const SITE_STATUS = {
  none: { label: 'Нет сайта', color: '#e5484d' },
  social: { label: 'Только соцсети', color: '#f59e0b' },
  dead: { label: 'Сайт не открывается', color: '#a855f7' },
  site: { label: 'Есть сайт', color: '#30a46c' },
};

/**
 * Запрашивает Overpass, перебирая серверы. `fetchImpl` — fetch браузера или Node.
 * Возвращает разобранный JSON либо бросает Error с понятным сообщением.
 */
export async function fetchOverpass(query, { endpoints = OVERPASS_ENDPOINTS, fetchImpl = fetch, timeoutMs = 150000, headers = {} } = {}) {
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', ...headers },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || !Array.isArray(json.elements)) throw new Error('неожиданный формат ответа');
      if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark);
      return json;
    } catch (err) {
      errors.push(`${endpoint}: ${err.message}`);
    }
  }
  throw new Error('Overpass API недоступен. ' + errors.join(' | '));
}
