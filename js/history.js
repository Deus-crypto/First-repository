// История появления заведений: когда место впервые увидели и когда менялось наличие сайта.
// Чистый модуль без импортов и без DOM: работает и в Node, и в браузере.

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Текущая дата UTC в формате YYYY-MM-DD. */
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/** Миллисекунды начала дня UTC для строки YYYY-MM-DD, либо NaN, если дата некорректна. */
function parseDay(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return NaN;
  const ms = Date.parse(value + 'T00:00:00Z');
  if (Number.isNaN(ms)) return NaN;
  // Отсекаем «несуществующие» даты вроде 2026-02-30, которые Date молча переносит.
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : NaN;
}

/** Есть ли у заведения присутствие в сети: сайт или хотя бы одна ссылка на соцсеть. */
export function hasWebPresence(place) {
  return Boolean(place?.website) || (Array.isArray(place?.social) && place.social.length > 0);
}

/** Копия заведения без истории: массив social копируется, чтобы не делить ссылку с входом. */
function copyPlace(place) {
  const copy = { ...place };
  if (Array.isArray(place.social)) copy.social = [...place.social];
  delete copy.added;
  delete copy.changed;
  delete copy.changeType;
  return copy;
}

/**
 * Объединяет свежий список заведений с предыдущим и проставляет историю.
 * Возвращает НОВЫЙ массив, входные данные не меняются.
 *
 * - Место было раньше (тот же id): сохраняем его прежний `added` (если он был).
 * - Место новое: added = today.
 * - Нет предыдущих данных или они демонстрационные: историю не проставляем вовсе.
 * - Изменилось наличие сайта/соцсетей: changed = today, changeType = 'site_lost' | 'site_gained'.
 *   Иначе переносим прежние changed/changeType без изменений.
 *
 * @param {object[]} prevPlaces предыдущий список (может быть пустым или отсутствовать)
 * @param {object[]} newPlaces  свежий список
 * @param {{today?: string, prevIsDemo?: boolean}} [options] today — 'YYYY-MM-DD' (по умолчанию сегодня UTC)
 */
export function mergeHistory(prevPlaces, newPlaces, { today = todayUtc(), prevIsDemo = false } = {}) {
  const fresh = Array.isArray(newPlaces) ? newPlaces : [];
  const prev = Array.isArray(prevPlaces) ? prevPlaces : [];

  // Первый реальный запуск: возраста мест мы не знаем, поэтому ничего не датируем.
  if (prevIsDemo || prev.length === 0) return fresh.map(copyPlace);

  const prevById = new Map(prev.map((p) => [p.id, p]));
  return fresh.map((place) => {
    const out = copyPlace(place);
    const old = prevById.get(place.id);

    if (!old) {
      out.added = today;
      return out;
    }

    if (old.added !== undefined) out.added = old.added;

    const hadWeb = hasWebPresence(old);
    const hasWeb = hasWebPresence(place);
    if (hadWeb && !hasWeb) {
      out.changed = today;
      out.changeType = 'site_lost';
    } else if (!hadWeb && hasWeb) {
      out.changed = today;
      out.changeType = 'site_gained';
    } else {
      if (old.changed !== undefined) out.changed = old.changed;
      if (old.changeType !== undefined) out.changeType = old.changeType;
    }
    return out;
  });
}

/**
 * true, если place.added попадает в последние `days` дней относительно `now`.
 * Границы включительны: ровно `days` дней назад — это уже «новое».
 * Дата `added` трактуется как начало дня UTC. Дата в будущем больше чем на сутки — false.
 *
 * @param {object} place
 * @param {number} [days=14]
 * @param {Date|string} [now=new Date()]
 */
export function isNew(place, days = 14, now) {
  const addedMs = parseDay(place?.added);
  if (Number.isNaN(addedMs)) return false;

  const nowDate = now === undefined ? new Date() : now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  if (Number.isNaN(nowMs)) return false;

  if (addedMs - nowMs > DAY_MS) return false;
  return nowMs - addedMs <= days * DAY_MS;
}

/**
 * Сводка для логов: сколько мест добавилось, исчезло, потеряло или получило сайт.
 * Сравнение по id. Если предыдущих данных нет или они демонстрационные, все счётчики нулевые.
 *
 * @param {object[]} prevPlaces
 * @param {object[]} newPlaces
 * @param {{prevIsDemo?: boolean}} [options]
 * @returns {{added: number, removed: number, siteLost: number, siteGained: number}}
 */
export function diffSummary(prevPlaces, newPlaces, { prevIsDemo = false } = {}) {
  const summary = { added: 0, removed: 0, siteLost: 0, siteGained: 0 };
  const prev = Array.isArray(prevPlaces) ? prevPlaces : [];
  const fresh = Array.isArray(newPlaces) ? newPlaces : [];
  if (prevIsDemo || prev.length === 0) return summary;

  const prevById = new Map(prev.map((p) => [p.id, p]));
  const freshIds = new Set(fresh.map((p) => p.id));

  for (const place of fresh) {
    const old = prevById.get(place.id);
    if (!old) {
      summary.added++;
      continue;
    }
    const hadWeb = hasWebPresence(old);
    const hasWeb = hasWebPresence(place);
    if (hadWeb && !hasWeb) summary.siteLost++;
    else if (!hadWeb && hasWeb) summary.siteGained++;
  }
  for (const id of prevById.keys()) {
    if (!freshIds.has(id)) summary.removed++;
  }
  return summary;
}
