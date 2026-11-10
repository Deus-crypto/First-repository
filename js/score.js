// Оценка «горячести» заведения как лида для веб-разработчика.
//
// Чем выше балл, тем вероятнее, что у заведения нет сайта, который стоит предложить
// (и есть способ с ним связаться). Модуль чистый: без DOM и без сети.
//
// Формула:
//   raw   = вес статуса сайта
//         + бонусы за контакты (телефон, почта)
//         + бонусы за полноту карточки (адрес, часы работы)
//         + вес сферы деятельности
//         + штраф за сеть / бренд
//   score = clamp(round(raw), 0, 100)
//   Если сайт работает (status 'site'), score дополнительно ограничивается SITE_MAX,
//   поэтому такое заведение всегда 'cold' (холодный).
//
// Уровень: hot (>= 70), warm (>= 40), cold (остальное), пороги берутся из LEVELS.
//
// Причины (reasons): сначала пояснение к статусу сайта, затем остальные факторы
// по убыванию |вклада|. Максимум 5 строк.

import { classify } from './categories.js';

// Все веса в одной таблице. Меняйте здесь, а не в логике.
const WEIGHTS = {
  // Статус сайта: основной фактор.
  status: { none: 50, dead: 40, social: 30, site: 0 },
  // Потолок для заведений с рабочим сайтом: гарантирует 'cold'.
  siteMax: 20,
  // Контакты: есть куда написать или позвонить.
  phone: 12,
  email: 6,
  // Полнота карточки: признак активного, описанного бизнеса.
  address: 4,
  hours: 4,
  // Сеть или бренд: у сетей обычно есть корпоративный сайт.
  brand: -30,
  // Вес сферы (группа из categories.js). Сферы, где сайт нужен чаще, выше.
  group: {
    food: 8,
    beauty: 8,
    health: 8,
    lodging: 6,
    services: 6,
    auto: 6,
    leisure: 6,
    education: 6,
    craft: 4,
    shops: 2,
    finance: -4,
    office: -4,
    other: -8,
  },
};

const STATUS_REASON = {
  none: 'Нет сайта и соцсетей',
  social: 'Только соцсети, нет своего сайта',
  dead: 'Сайт не открывается',
  site: 'Есть свой сайт',
};

export const LEVELS = {
  hot: { label: 'Горячий', color: '#e5484d', min: 70 },
  warm: { label: 'Тёплый', color: '#f59e0b', min: 40 },
  cold: { label: 'Холодный', color: '#8a8f98', min: 0 },
};

const MAX_REASONS = 5;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const hasText = (value) => typeof value === 'string' && value.trim() !== '';

// Статус, если он не передан или неизвестен: выводим его из самой карточки.
function deriveStatus(place) {
  if (hasText(place.website)) return 'site';
  if (Array.isArray(place.social) && place.social.length > 0) return 'social';
  return 'none';
}

function levelOf(score) {
  if (score >= LEVELS.hot.min) return 'hot';
  if (score >= LEVELS.warm.min) return 'warm';
  return 'cold';
}

/**
 * place: { name, kind ('amenity=cafe'), website?, social?: string[], phone?, email?, address?, hours?, brand?, siteCheck?, added? }
 * siteStatus: 'none' | 'social' | 'dead' | 'site'
 * Returns { score: integer 0..100, level: 'hot'|'warm'|'cold', reasons: string[] }
 *
 * Не бросает исключений: отсутствующие и некорректные поля считаются пустыми.
 */
export function leadScore(place, siteStatus) {
  const p = place && typeof place === 'object' ? place : {};
  const status = typeof siteStatus === 'string' && hasOwn(WEIGHTS.status, siteStatus)
    ? siteStatus
    : deriveStatus(p);

  // Дополнительные факторы: { delta, text }. Нулевые вклады не попадают в причины.
  const factors = [];
  const add = (delta, text) => {
    if (delta !== 0) factors.push({ delta, text });
  };

  if (hasText(p.phone)) add(WEIGHTS.phone, 'Есть телефон');
  if (hasText(p.email)) add(WEIGHTS.email, 'Есть почта');
  if (hasText(p.address)) add(WEIGHTS.address, 'Указан адрес');
  if (hasText(p.hours)) add(WEIGHTS.hours, 'Указаны часы работы');
  if (hasText(p.brand)) add(WEIGHTS.brand, 'Сеть или бренд: вероятно, есть корпоративный сайт');

  const group = classify(p.kind).group;
  const groupDelta = hasOwn(WEIGHTS.group, group) ? WEIGHTS.group[group] : WEIGHTS.group.other;
  add(groupDelta, groupDelta > 0 ? 'Сфера с хорошим спросом на сайт' : 'Сфера с низким спросом на сайт');

  // Сортировка стабильная: при равном |вкладе| сохраняется порядок добавления.
  factors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const total = WEIGHTS.status[status] + factors.reduce((sum, f) => sum + f.delta, 0);
  let score = Math.min(100, Math.max(0, Math.round(total)));
  if (status === 'site') score = Math.min(score, WEIGHTS.siteMax);

  const reasons = [STATUS_REASON[status], ...factors.map((f) => f.text)].slice(0, MAX_REASONS);

  return { score, level: levelOf(score), reasons };
}
