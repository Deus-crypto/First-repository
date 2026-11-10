/**
 * Лиды: статусы работы с заведениями, хранение в localStorage,
 * экспорт/импорт JSON, CSV для Excel и генератор текста предложения.
 * Модуль не импортирует ничего и не обращается к window/document/localStorage при загрузке.
 */

/** Статусы лида: id, подпись и цвет для интерфейса. */
export const STATUSES = [
  { id: 'none', label: 'Не обработан', color: '#8a8f98' },
  { id: 'planned', label: 'В планах', color: '#3b82f6' },
  { id: 'contacted', label: 'Связался', color: '#a855f7' },
  { id: 'negotiation', label: 'Переговоры', color: '#f59e0b' },
  { id: 'in_progress', label: 'Делаю сайт', color: '#06b6d4' },
  { id: 'done', label: 'Сайт сделан', color: '#22c55e' },
  { id: 'rejected', label: 'Отказ', color: '#ef4444' },
];

const STORAGE_KEY = 'sitemap-leads-v1';
const IMPORT_ERROR = 'Файл не похож на экспорт лидов';
const VALID_STATUSES = new Set(STATUSES.map((s) => s.id));
const STATUS_LABELS = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Ссылка на сделанный сайт (портфолио): аккуратный http(s)-адрес либо '' для пустого
 * или некорректного значения.
 */
export function normalizePortfolioUrl(raw) {
  if (typeof raw !== 'string') return '';
  const value = raw.trim();
  if (!value || /\s/.test(value) || !/^https?:\/\//i.test(value)) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * Приводит запись к виду { status, note, updated } (+ необязательное поле url — ссылка
 * на сделанный сайт); null для некорректной записи.
 */
function normalizeRecord(rec) {
  if (!isPlainObject(rec) || !VALID_STATUSES.has(rec.status)) return null;
  const out = {
    status: rec.status,
    note: typeof rec.note === 'string' ? rec.note : '',
    updated: typeof rec.updated === 'string' ? rec.updated : null,
  };
  const url = normalizePortfolioUrl(rec.url);
  if (url) out.url = url;
  return out;
}

/** Запись без статуса, заметки и ссылки на работу не хранится. */
function isEmptyRecord(rec) {
  return rec.status === 'none' && !rec.note.trim() && !rec.url;
}

/** Время ISO-строки в миллисекундах; -Infinity для отсутствующей или некорректной даты. */
function timestamp(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? -Infinity : t;
}

/** Запасное хранилище в памяти, если localStorage недоступен. */
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
  };
}

/** localStorage, если он есть; доступ к нему может бросать исключение (приватный режим, запрет cookies). */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Читает все записи; нет данных или испорченный JSON дают пустой объект. */
function readAll(storage) {
  let parsed;
  try {
    parsed = JSON.parse(storage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
  if (!isPlainObject(parsed)) return {};
  const out = {};
  for (const [id, rec] of Object.entries(parsed)) {
    const clean = normalizeRecord(rec);
    if (clean) out[id] = clean;
  }
  return out;
}

/** Сохраняет все записи; ошибки записи игнорируются. */
function writeAll(storage, data) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // квота или запрет записи: приложение продолжает работать без сохранения
  }
}

/**
 * Создаёт хранилище лидов.
 * @param {{getItem(key: string): string|null, setItem(key: string, value: string): void}} [storage]
 *   По умолчанию localStorage, а при его отсутствии — память.
 */
export function createLeadStore(storage) {
  const store = storage ?? defaultStorage() ?? memoryStorage();
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());

  return {
    /** Запись лида по id; для неизвестного id — статус 'none'. */
    get(id) {
      const rec = readAll(store)[id];
      return rec ? { ...rec } : { status: 'none', note: '', updated: null };
    },

    /**
     * Меняет статус, заметку и/или ссылку на сделанный сайт (url; пустая строка убирает ссылку).
     * Пустая запись (статус 'none', заметка без текста, ссылки нет) удаляется.
     * @throws {TypeError} если статус неизвестен или url не является адресом http(s)
     */
    set(id, patch = {}) {
      const data = readAll(store);
      const current = data[id] ?? { status: 'none', note: '', updated: null };
      const next = {
        status: patch.status === undefined ? current.status : patch.status,
        note: patch.note === undefined ? current.note : String(patch.note),
        updated: new Date().toISOString(),
      };
      if (!VALID_STATUSES.has(next.status)) {
        throw new TypeError(`Неизвестный статус лида: ${next.status}`);
      }
      let url = current.url ?? '';
      if (patch.url !== undefined) {
        const raw = patch.url === null ? '' : String(patch.url).trim();
        url = normalizePortfolioUrl(raw);
        if (raw && !url) throw new TypeError('Ссылка должна начинаться с http:// или https://');
      }
      if (url) next.url = url;
      if (isEmptyRecord(next)) {
        delete data[id];
        writeAll(store, data);
        notify();
        return { status: 'none', note: '', updated: null };
      }
      data[id] = next;
      writeAll(store, data);
      notify();
      return { ...next };
    },

    /** Копия всех записей вида { [id]: { status, note, updated, url? } }. */
    all() {
      return readAll(store);
    },

    /** Количество сохранённых записей. */
    count() {
      return Object.keys(readAll(store)).length;
    },

    /** Число сохранённых записей по статусам (только статусы, встречающиеся в данных). */
    countByStatus() {
      const counts = {};
      for (const rec of Object.values(readAll(store))) {
        counts[rec.status] = (counts[rec.status] ?? 0) + 1;
      }
      return counts;
    },

    /**
     * Подписка на изменения.
     * @returns {() => void} функция отписки
     */
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    /** JSON-экспорт: { version, exported, leads }. */
    exportJSON() {
      return JSON.stringify(
        { version: 1, exported: new Date().toISOString(), leads: readAll(store) },
        null,
        2,
      );
    },

    /**
     * Импорт JSON-экспорта. При конфликте побеждает запись с более новым `updated`.
     * Некорректные записи пропускаются.
     * @returns {number} число добавленных или обновлённых записей
     * @throws {Error} если текст не JSON или в нём нет объекта leads
     */
    importJSON(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(IMPORT_ERROR);
      }
      if (!isPlainObject(parsed) || !isPlainObject(parsed.leads)) {
        throw new Error(IMPORT_ERROR);
      }

      const data = readAll(store);
      let changed = 0;
      for (const [id, raw] of Object.entries(parsed.leads)) {
        const incoming = normalizeRecord(raw);
        if (!id || !incoming) continue;
        const existing = data[id];
        if (existing && timestamp(incoming.updated) <= timestamp(existing.updated)) continue;
        if (!existing && isEmptyRecord(incoming)) continue;
        if (isEmptyRecord(incoming)) {
          delete data[id];
        } else {
          data[id] = incoming;
        }
        changed += 1;
      }
      if (changed) {
        writeAll(store, data);
        notify();
      }
      return changed;
    },
  };
}

const CSV_HEADER = [
  'Название', 'Категория', 'Сайт (статус)', 'Сайт', 'Соцсети', 'Телефон', 'Email',
  'Адрес', 'Часы работы', 'Сеть', 'Статус лида', 'Заметка', 'Широта', 'Долгота',
  'Яндекс Карты', 'OSM ID', 'Балл', 'Проблемы сайта',
];
/** Индексы колонок с координатами: их значения не экранируются от формул. */
const NUMERIC_COLUMNS = new Set([12, 13]);
const FORMULA_START = /^\s*[=+\-@\t]/;

/**
 * Экранирует значение поля CSV: защита от формул Excel и удвоение кавычек.
 * @param {unknown} value
 * @param {boolean} [numeric] координата: без защиты от формул
 */
function csvField(value, numeric = false) {
  let s = value === undefined || value === null ? '' : String(value);
  if (!numeric && FORMULA_START.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Экспорт заведений в CSV для Excel (русская локаль): BOM, разделитель ';', CRLF.
 * @param {object[]} places заведения (любые поля могут отсутствовать); `score` — балл перспективности,
 *   `siteIssueLabels` — подписи проблем сайта (массив или строка)
 * @param {ReturnType<typeof createLeadStore>} [leadStore] если передан, добавляются статус лида и заметка
 * @returns {string}
 */
export function placesToCSV(places = [], leadStore) {
  const rows = places.map((p) => {
    const lead = leadStore ? leadStore.get(p.id) : null;
    const hasCoords = p.lat != null && p.lon != null && p.lat !== '' && p.lon !== '';
    const yandex = hasCoords ? `https://yandex.ru/maps/?pt=${p.lon},${p.lat}&z=18&l=map` : '';
    const social = Array.isArray(p.social) ? p.social.join(', ') : p.social;
    return [
      p.name, p.categoryLabel, p.siteStatusLabel, p.website,
      social, p.phone, p.email, p.address, p.hours, p.brand,
      lead ? STATUS_LABELS[lead.status] ?? '' : '',
      lead ? lead.note : '',
      p.lat, p.lon, yandex, p.id,
      p.score, Array.isArray(p.siteIssueLabels) ? p.siteIssueLabels.join(', ') : p.siteIssueLabels,
    ];
  });
  const lines = [CSV_HEADER, ...rows].map((cells) =>
    cells.map((v, i) => csvField(v, NUMERIC_COLUMNS.has(i))).join(';'),
  );
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Начало сообщения: что заметили про заведение, по статусу сайта. */
const OPENINGS = {
  none: (x) =>
    `На карте заведений мы нашли ${x}, и у него пока нет собственного сайта. ` +
    'Понимаем, что на работу и гостей уходит много сил, поэтому до сайта обычно руки не доходят.',
  social: (x) =>
    `На карте заведений мы нашли ${x}: у него есть страница в социальной сети, ` +
    'но собственного сайта пока нет. Соцсети хороши для общения, а сайт помогает быстрее находить вас в поиске и на картах.',
  dead: (x) =>
    `На карте заведений мы нашли ${x}: сайт, указанный в карточке, сейчас не открывается. ` +
    'Гости, которые переходят по этой ссылке, уходят ни с чем.',
  site: (x) =>
    `На карте заведений мы нашли ${x}: у него уже есть сайт, и мы хотели бы предложить его обновить, ` +
    'сделать современнее, быстрее на телефоне и понятнее для посетителей.',
};

const BENEFITS = [
  '• Понятная страница с адресом, часами работы и контактами, которую удобно смотреть с телефона.',
  '• Ссылка для карт и поиска, чтобы вас проще находили рядом и видели актуальные часы работы.',
  '• Кнопка звонка и форма обратной связи, чтобы обращения не терялись в переписке.',
];

/**
 * Текст предложения сделать сайт (вежливый, без выдуманных цифр и гарантий).
 * @param {{name?: string, categoryLabel?: string, siteStatus: 'none'|'social'|'dead'|'site'}} place
 * @param {{author?: string, contact?: string}} [opts] подпись; строки подписи добавляются, только если заданы
 * @returns {string}
 */
export function buildPitch(place = {}, opts = {}) {
  const name = typeof place.name === 'string' ? place.name.trim() : '';
  const label = name ? `«${name}»` : 'ваше заведение';
  const opening = (OPENINGS[place.siteStatus] ?? OPENINGS.none)(label);

  const signature = [];
  if (opts.author) signature.push(`С уважением, ${opts.author}`);
  if (opts.contact) signature.push(`Связаться: ${opts.contact}`);

  return [
    'Здравствуйте!',
    opening,
    'Небольшой сайт может помочь:',
    BENEFITS.join('\n'),
    'Я могу показать примерный вариант того, как это могло бы выглядеть для вашего заведения, ' +
      'и обсудить задачи без каких-либо обязательств. Гарантировать конкретный результат не возьмусь, ' +
      'но с удовольствием разберусь, что будет полезно именно вам.',
    ...(signature.length ? [signature.join('\n')] : []),
  ].join('\n\n');
}

/**
 * Скачивает текст как файл через временную ссылку.
 * @returns {boolean} false, если среда без document (например, Node)
 */
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
