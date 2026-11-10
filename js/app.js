// Интерфейс карты заведений.
import { GROUPS, classify, groupById } from './categories.js';
import { STATUSES, createLeadStore, placesToCSV, buildPitch, downloadText } from './leads.js';
import { SITE_STATUS, siteStatus, buildQuery, fetchOverpass, normalizeResponse, hostOf } from './osm.js';

const L = window.L;
const $ = (sel) => document.querySelector(sel);
const STATUS_ORDER = ['none', 'social', 'dead', 'site'];
const PAGE = 150;
const MAX_LIVE_SPAN = 0.35; // градусов: больше — слишком тяжёлый запрос для живой загрузки
const PREFS_KEY = 'sitemap-prefs-v1';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeHref = (url) => (/^https?:\/\//i.test(url || '') ? esc(url) : '#');
const fmt = (n) => n.toLocaleString('ru-RU');

const leads = createLeadStore();
let leadMap = leads.all();
const leadStatusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

const state = {
  places: new Map(), // id -> place (с вычисленными полями _status, _cat, _text)
  filtered: [],
  shown: PAGE,
  selectedId: null,
  filters: { q: '', statuses: new Set(), groups: new Set(), lead: 'any', onlyPhone: false, hideBrands: false, inView: false },
  meta: null,
};
const markers = new Map();

/* ---------- Карта ---------- */

const map = L.map('map', { zoomControl: true, preferCanvas: false }).setView([55.7558, 37.6176], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© <a href="https://www.openstreetmap.org/copyright">участники OpenStreetMap</a>',
}).addTo(map);
map.attributionControl.setPrefix(false);

const cluster = L.markerClusterGroup({
  chunkedLoading: true,
  maxClusterRadius: 55,
  disableClusteringAtZoom: 18,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  iconCreateFunction(c) {
    // Кольцо кластера показывает доли статусов сайта.
    const counts = { none: 0, social: 0, dead: 0, site: 0 };
    for (const m of c.getAllChildMarkers()) counts[m.options.siteStatus]++;
    const total = c.getChildCount();
    let acc = 0;
    const stops = STATUS_ORDER.filter((s) => counts[s]).map((s) => {
      const from = (acc / total) * 100;
      acc += counts[s];
      return `${SITE_STATUS[s].color} ${from}% ${(acc / total) * 100}%`;
    });
    const size = total < 10 ? 34 : total < 100 ? 40 : total < 1000 ? 46 : 54;
    return L.divIcon({
      html: `<div class="cluster" style="width:${size}px;height:${size}px;background:conic-gradient(${stops.join(',')})"><b>${total > 999 ? Math.round(total / 100) / 10 + 'к' : total}</b></div>`,
      className: '',
      iconSize: [size, size],
    });
  },
});
map.addLayer(cluster);

const legend = L.control({ position: 'bottomright' });
legend.onAdd = () => {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = STATUS_ORDER.map((s) => `<div><i style="background:${SITE_STATUS[s].color}"></i>${SITE_STATUS[s].label}</div>`).join('');
  return div;
};
legend.addTo(map);

function makeIcon(place) {
  const lead = leadMap[place.id];
  const leadColor = lead && lead.status !== 'none' ? leadStatusById[lead.status]?.color : '';
  return L.divIcon({
    html: `<div class="pin${leadColor ? ' lead' : ''}" style="--c:${SITE_STATUS[place._status].color}${leadColor ? `;--lead:${leadColor}` : ''}"><span>${place._cat.icon}</span></div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 24],
  });
}

function markerFor(place) {
  let m = markers.get(place.id);
  if (!m) {
    m = L.marker([place.lat, place.lon], { icon: makeIcon(place), title: place.name, siteStatus: place._status });
    m.on('click', () => select(place.id, { pan: false }));
    markers.set(place.id, m);
  }
  return m;
}

/* ---------- Данные ---------- */

function prepare(place) {
  place._status = siteStatus(place);
  place._cat = classify(place.kind);
  place._text = [place.name, place.address, place.phone, place._cat.label, place.brand, place.website && hostOf(place.website)]
    .filter(Boolean).join(' ').toLowerCase();
  return place;
}

function addPlaces(list) {
  let added = 0;
  for (const raw of list) {
    if (!raw || !raw.id || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)) continue;
    if (!state.places.has(raw.id)) added++;
    else if (markers.has(raw.id)) {
      cluster.removeLayer(markers.get(raw.id));
      markers.delete(raw.id);
    }
    // Результат автоматической проверки сайта переносим, если адрес сайта не поменялся.
    const old = state.places.get(raw.id);
    if (old && old.siteCheck && old.website === raw.website && !raw.siteCheck) raw.siteCheck = old.siteCheck;
    state.places.set(raw.id, prepare(raw));
  }
  return added;
}

async function loadInitial() {
  try {
    const res = await fetch('data/places.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.meta = data;
    addPlaces(data.places || []);
    if (data.demo) {
      showBanner('Сейчас показаны <b>демонстрационные (вымышленные) данные</b>. Настоящие появятся после первого автообновления (GitHub Actions) — или нажмите «Загрузить эту область», чтобы получить живые данные OpenStreetMap прямо сейчас.');
    }
    if (data.generated) {
      $('#updated').textContent = 'Обновлено ' + new Date(data.generated).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (!location.hash && state.places.size) {
      const pts = [...state.places.values()].map((p) => [p.lat, p.lon]);
      map.fitBounds(L.latLngBounds(pts).pad(0.05));
    }
  } catch (err) {
    showBanner(`Не удалось загрузить сохранённые данные (${esc(err.message)}). Нажмите «Загрузить эту область», чтобы получить данные OpenStreetMap напрямую.`);
  }
  refresh();
}

async function loadArea() {
  const b = map.getBounds();
  const bbox = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((x) => Math.round(x * 1e5) / 1e5);
  if (bbox[2] - bbox[0] > MAX_LIVE_SPAN || bbox[3] - bbox[1] > MAX_LIVE_SPAN * 2) {
    toast('Область слишком большая — приблизьте карту (примерно до уровня района).');
    return;
  }
  const btn = $('#load-area');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Загружаю…';
  try {
    const json = await fetchOverpass(buildQuery(bbox, { timeout: 60 }), { timeoutMs: 75000 });
    const list = normalizeResponse(json);
    if (state.meta?.demo) {
      // Живые данные заменяют демонстрационные.
      state.places.clear();
      markers.clear();
      cluster.clearLayers();
      state.meta = { ...state.meta, demo: false };
      $('#banner').hidden = true;
    }
    const added = addPlaces(list);
    $('#updated').textContent = 'Живые данные от ' + new Date().toLocaleTimeString('ru-RU', { timeStyle: 'short' });
    refresh();
    toast(`Найдено ${fmt(list.length)} заведений, новых: ${fmt(added)}.`);
  } catch (err) {
    toast('Не получилось загрузить данные: ' + err.message, 7000);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

/* ---------- Фильтры ---------- */

function matches(p, { skipStatus = false, skipGroup = false } = {}) {
  const f = state.filters;
  if (!skipStatus && f.statuses.size && !f.statuses.has(p._status)) return false;
  if (!skipGroup && f.groups.size && !f.groups.has(p._cat.group)) return false;
  if (f.onlyPhone && !p.phone) return false;
  if (f.hideBrands && p.brand) return false;
  if (f.lead !== 'any') {
    const st = leadMap[p.id]?.status || 'none';
    if (f.lead === 'tracked' ? st === 'none' : st !== f.lead) return false;
  }
  if (f.q && !f.q.split(/\s+/).every((w) => p._text.includes(w))) return false;
  if (f.inView && !map.getBounds().contains([p.lat, p.lon])) return false;
  return true;
}

const SORT_RANK = { none: 0, dead: 1, social: 2, site: 3 };

function refresh({ keepPage = false } = {}) {
  const all = [...state.places.values()];
  const statusCounts = { none: 0, social: 0, dead: 0, site: 0 };
  const groupCounts = {};
  const filtered = [];
  for (const p of all) {
    if (matches(p, { skipStatus: true })) statusCounts[p._status]++;
    if (matches(p, { skipGroup: true })) groupCounts[p._cat.group] = (groupCounts[p._cat.group] || 0) + 1;
    if (matches(p)) filtered.push(p);
  }
  // Сначала самые перспективные: без сайта и с телефоном.
  filtered.sort((a, b) =>
    SORT_RANK[a._status] - SORT_RANK[b._status] ||
    (b.phone ? 1 : 0) - (a.phone ? 1 : 0) ||
    a.name.localeCompare(b.name, 'ru'));
  state.filtered = filtered;
  if (!keepPage) state.shown = PAGE;

  cluster.clearLayers();
  cluster.addLayers(filtered.map(markerFor));

  renderStats(filtered);
  renderChips(statusCounts, groupCounts);
  renderList();
  savePrefs();
}

function renderStats(list) {
  const c = { none: 0, social: 0, dead: 0, site: 0 };
  for (const p of list) c[p._status]++;
  const total = list.length || 1;
  $('#stats').innerHTML =
    STATUS_ORDER.map((s) => `
      <button class="stat" style="--c:${SITE_STATUS[s].color}" data-status="${s}" title="Показать только: ${SITE_STATUS[s].label}">
        <b>${fmt(c[s])}</b><span>${SITE_STATUS[s].label}</span><small>${Math.round((c[s] / total) * 100)}%</small>
      </button>`).join('') +
    `<div class="share" title="Доли среди показанных заведений">${STATUS_ORDER.map((s) => `<i style="width:${(c[s] / total) * 100}%;background:${SITE_STATUS[s].color}"></i>`).join('')}</div>`;
  $('#list-count').textContent = `Показано: ${fmt(list.length)} из ${fmt(state.places.size)}`;
}

function renderChips(statusCounts, groupCounts) {
  const f = state.filters;
  $('#status-chips').innerHTML = STATUS_ORDER.map((s) => `
    <button class="chip" data-status="${s}" aria-pressed="${f.statuses.has(s)}" style="--c:${SITE_STATUS[s].color}">
      <span class="dot"></span>${SITE_STATUS[s].label}<span class="n">${fmt(statusCounts[s])}</span>
    </button>`).join('');
  $('#group-chips').innerHTML = GROUPS.filter((g) => groupCounts[g.id] || f.groups.has(g.id)).map((g) => `
    <button class="chip" data-group="${g.id}" aria-pressed="${f.groups.has(g.id)}">
      ${g.icon} ${esc(g.label)}<span class="n">${fmt(groupCounts[g.id] || 0)}</span>
    </button>`).join('');
}

function renderList() {
  const list = state.filtered.slice(0, state.shown);
  const ul = $('#list');
  if (!list.length) {
    ul.innerHTML = '<li class="empty">Ничего не найдено. Измените фильтры или загрузите данные для этой области.</li>';
  } else {
    ul.innerHTML = list.map((p) => {
      const lead = leadMap[p.id];
      const ls = lead && lead.status !== 'none' ? leadStatusById[lead.status] : null;
      const sub = [p._cat.label, p.address, p.phone].filter(Boolean).join(' · ');
      return `<li class="item${p.id === state.selectedId ? ' active' : ''}" data-id="${esc(p.id)}" style="--c:${SITE_STATUS[p._status].color}" tabindex="0">
        <span class="ico">${p._cat.icon}</span>
        <span class="name">${esc(p.name)}</span>
        <span class="badge">${SITE_STATUS[p._status].label}</span>
        <span class="sub">${ls ? `<span class="lead-tag" style="--c:${ls.color}">● ${esc(ls.label)}</span> · ` : ''}${esc(sub)}</span>
      </li>`;
    }).join('');
  }
  const rest = state.filtered.length - list.length;
  $('#more').hidden = rest <= 0;
  $('#more').textContent = `Показать ещё (${fmt(rest)})`;
}

/* ---------- Карточка заведения ---------- */

function select(id, { pan = true } = {}) {
  const p = state.places.get(id);
  if (!p) return;
  state.selectedId = id;
  renderDetail(p);
  document.querySelectorAll('.item.active').forEach((el) => el.classList.remove('active'));
  document.querySelector(`.item[data-id="${CSS.escape(id)}"]`)?.classList.add('active');
  if (pan) {
    const m = markers.get(id);
    if (m && cluster.hasLayer(m)) cluster.zoomToShowLayer(m, () => map.panTo(m.getLatLng()));
    else map.setView([p.lat, p.lon], Math.max(map.getZoom(), 17));
    if (window.matchMedia('(max-width: 760px)').matches) $('#panel').classList.add('collapsed');
  }
}

function renderDetail(p) {
  const st = SITE_STATUS[p._status];
  const lead = leads.get(p.id);
  const group = groupById(p._cat.group);
  const q = encodeURIComponent(p.name);
  const rows = [];
  if (p.website) rows.push(['Сайт', `<a href="${safeHref(p.website)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(p.website) || p.website)}</a>${p._status === 'dead' ? ' <span class="muted">(не открылся при автопроверке)</span>' : ''}`]);
  if (p.social?.length) rows.push(['Соцсети', p.social.map((u) => `<a href="${safeHref(u)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(u))}</a>`).join(', ')]);
  if (p.phone) rows.push(['Телефон', `<a href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}">${esc(p.phone)}</a>`]);
  if (p.email) rows.push(['Email', `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`]);
  if (p.address) rows.push(['Адрес', esc(p.address)]);
  if (p.hours) rows.push(['Часы', esc(p.hours)]);
  if (p.brand) rows.push(['Сеть', esc(p.brand)]);

  const osmType = { n: 'node', w: 'way', r: 'relation' }[p.id[0]];
  const osmLink = osmType && /^\d+$/.test(p.id.slice(1)) ? `<a href="https://www.openstreetmap.org/${osmType}/${p.id.slice(1)}" target="_blank" rel="noopener">OSM</a>` : '';

  const el = $('#detail');
  el.innerHTML = `
    <button class="close" aria-label="Закрыть">×</button>
    <h2>${esc(p.name)}</h2>
    <div class="cat">${p._cat.icon} ${esc(p._cat.label)} · ${esc(group.label)}</div>
    <span class="badge" style="--c:${st.color}">${st.label}</span>
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="links">
      <a href="https://yandex.ru/maps/?ll=${p.lon},${p.lat}&z=18&text=${q}" target="_blank" rel="noopener">Яндекс Карты</a>
      <a href="https://2gis.ru/search/${q}?m=${p.lon},${p.lat}/18" target="_blank" rel="noopener">2ГИС</a>
      <a href="https://yandex.ru/search/?text=${q}%20${encodeURIComponent(p.address || '')}%20официальный%20сайт" target="_blank" rel="noopener">Искать сайт</a>
      ${osmLink}
    </div>
    <label for="lead-status">Статус лида</label>
    <select id="lead-status">${STATUSES.map((s) => `<option value="${s.id}"${s.id === lead.status ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
    <label for="lead-note">Заметка</label>
    <textarea id="lead-note" placeholder="С кем говорили, о чём договорились…">${esc(lead.note)}</textarea>
    <div class="links">
      <button id="copy-pitch" title="Скопировать текст предложения сделать сайт">✉ Скопировать предложение</button>
    </div>
    <div class="hint">Статусы и заметки хранятся только в этом браузере. Чтобы перенести их — «⬇ Лиды» / «⬆ Лиды».</div>`;
  el.hidden = false;

  el.querySelector('.close').onclick = closeDetail;
  el.querySelector('#lead-status').onchange = (e) => leads.set(p.id, { status: e.target.value });
  el.querySelector('#lead-note').onchange = (e) => leads.set(p.id, { note: e.target.value });
  el.querySelector('#copy-pitch').onclick = async () => {
    const text = buildPitch({ name: p.name, categoryLabel: p._cat.label, siteStatus: p._status });
    try {
      await navigator.clipboard.writeText(text);
      toast('Текст предложения скопирован.');
    } catch {
      window.prompt('Скопируйте текст:', text);
    }
  };
}

function closeDetail() {
  $('#detail').hidden = true;
  state.selectedId = null;
  document.querySelectorAll('.item.active').forEach((el) => el.classList.remove('active'));
}

/* ---------- Мелочи интерфейса ---------- */

let toastTimer;
function toast(text, ms = 3500) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

function showBanner(html) {
  const el = $('#banner');
  el.innerHTML = html;
  el.hidden = false;
  setTimeout(() => map.invalidateSize(), 0);
}

function savePrefs() {
  const f = state.filters;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      statuses: [...f.statuses], groups: [...f.groups], lead: f.lead, onlyPhone: f.onlyPhone, hideBrands: f.hideBrands,
    }));
  } catch { /* приватный режим — живём без сохранения */ }
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (!p) return;
    const f = state.filters;
    f.statuses = new Set((p.statuses || []).filter((s) => s in SITE_STATUS));
    f.groups = new Set((p.groups || []).filter((g) => GROUPS.some((x) => x.id === g)));
    f.lead = p.lead === 'tracked' || leadStatusById[p.lead] ? p.lead : 'any';
    f.onlyPhone = !!p.onlyPhone;
    f.hideBrands = !!p.hideBrands;
  } catch { /* повреждённые настройки игнорируем */ }
}

function syncControls() {
  const f = state.filters;
  $('#search').value = f.q;
  $('#lead-filter').value = f.lead;
  $('#only-phone').checked = f.onlyPhone;
  $('#hide-brands').checked = f.hideBrands;
  $('#in-view').checked = f.inView;
}

function toggle(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

/* Положение карты в адресе страницы: #zoom/lat/lon — ссылкой можно поделиться. */
function readHash() {
  const m = location.hash.match(/^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (m) map.setView([+m[2], +m[3]], +m[1]);
}
function writeHash() {
  const c = map.getCenter();
  history.replaceState(null, '', `#${map.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`);
}

async function geocode(query) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ru&q=' + encodeURIComponent(query);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const [hit] = await res.json();
  if (!hit) return false;
  const [s, n, w, e] = hit.boundingbox.map(Number);
  map.fitBounds([[s, w], [n, e]], { maxZoom: 16 });
  return true;
}

/* ---------- События ---------- */

function bind() {
  $('#lead-filter').innerHTML =
    '<option value="any">Все заведения</option><option value="tracked">Только мои лиды (любой статус)</option>' +
    STATUSES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('');

  $('#search').addEventListener('input', debounce((e) => {
    state.filters.q = e.target.value.trim().toLowerCase();
    refresh();
  }, 200));

  const onStatus = (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    toggle(state.filters.statuses, btn.dataset.status);
    refresh();
  };
  $('#status-chips').addEventListener('click', onStatus);
  $('#stats').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    const only = state.filters.statuses.size === 1 && state.filters.statuses.has(btn.dataset.status);
    state.filters.statuses = only ? new Set() : new Set([btn.dataset.status]);
    refresh();
  });
  $('#group-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-group]');
    if (!btn) return;
    toggle(state.filters.groups, btn.dataset.group);
    refresh();
  });
  $('#lead-filter').addEventListener('change', (e) => { state.filters.lead = e.target.value; refresh(); });
  $('#only-phone').addEventListener('change', (e) => { state.filters.onlyPhone = e.target.checked; refresh(); });
  $('#hide-brands').addEventListener('change', (e) => { state.filters.hideBrands = e.target.checked; refresh(); });
  $('#in-view').addEventListener('change', (e) => { state.filters.inView = e.target.checked; refresh(); });
  $('#reset-filters').addEventListener('click', () => {
    Object.assign(state.filters, { q: '', statuses: new Set(), groups: new Set(), lead: 'any', onlyPhone: false, hideBrands: false, inView: false });
    syncControls();
    refresh();
  });

  $('#list').addEventListener('click', (e) => {
    const li = e.target.closest('.item');
    if (li) select(li.dataset.id);
  });
  $('#list').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('.item');
    if (li) { e.preventDefault(); select(li.dataset.id); }
  });
  $('#more').addEventListener('click', () => { state.shown += PAGE; renderList(); });

  $('#toggle-panel').addEventListener('click', () => {
    $('#panel').classList.toggle('collapsed');
    setTimeout(() => map.invalidateSize(), 0);
  });
  $('#load-area').addEventListener('click', loadArea);

  $('#geo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = $('#geo-input').value.trim();
    if (!q) return;
    try {
      if (!(await geocode(q))) toast('Ничего не нашлось — уточните запрос.');
      else if (window.matchMedia('(max-width: 760px)').matches) $('#panel').classList.add('collapsed');
    } catch (err) {
      toast('Поиск места недоступен: ' + err.message);
    }
  });

  $('#export-csv').addEventListener('click', () => {
    if (!state.filtered.length) return toast('Нечего выгружать — список пуст.');
    const rows = state.filtered.map((p) => ({ ...p, categoryLabel: p._cat.label, siteStatusLabel: SITE_STATUS[p._status].label }));
    downloadText(`zavedeniya-${new Date().toISOString().slice(0, 10)}.csv`, placesToCSV(rows, leads), 'text/csv;charset=utf-8');
    toast(`Выгружено строк: ${fmt(rows.length)}.`);
  });
  $('#export-leads').addEventListener('click', () => {
    if (!leads.count()) return toast('Пока нет ни одного лида со статусом или заметкой.');
    downloadText(`lidy-${new Date().toISOString().slice(0, 10)}.json`, leads.exportJSON(), 'application/json');
  });
  $('#import-leads').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      toast(`Импортировано записей: ${leads.importJSON(await file.text())}.`);
    } catch (err) {
      toast(err.message, 6000);
    }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

  map.on('moveend', () => {
    writeHash();
    if (state.filters.inView) refresh();
  });

  leads.subscribe(() => {
    leadMap = leads.all();
    // Перерисовываем значки: у лидов появляется цветная обводка.
    for (const [id, m] of markers) {
      const p = state.places.get(id);
      if (p) m.setIcon(makeIcon(p));
    }
    refresh({ keepPage: true });
  });
}

loadPrefs();
bind();
syncControls();
readHash();
if (window.matchMedia('(max-width: 760px)').matches) $('#panel').classList.add('collapsed');
loadInitial();

// Для отладки и автоматических проверок.
window.__app = { state, map, leads, refresh, select };
