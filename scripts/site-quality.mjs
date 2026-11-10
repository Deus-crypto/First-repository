// Conservative website quality audit. No dependencies.
//
// analyzeHtml(html, finalUrl) is a pure function: it never throws and reports an issue
// only when the evidence is clear. Truncated or unexpected input yields fewer issues,
// not more. auditSite(url, fetchImpl) fetches a page and runs analyzeHtml on it.

export const ISSUES = {
  no_https:     { label: 'Нет HTTPS' },                       // finalUrl protocol is http:
  no_viewport:  { label: 'Нет мобильной версии' },            // no <meta name="viewport">
  no_title:     { label: 'Нет заголовка страницы' },          // missing or empty <title>
  old_markup:   { label: 'Устаревшая вёрстка' },              // at least two legacy signs
  parked:       { label: 'Домен продаётся или припаркован' }, // parking phrases in visible text
  builder_stub: { label: 'Сайт-заглушка' },                   // visible text shorter than 200 chars
};

const STUB_MIN_TEXT = 200;
const FETCH_TIMEOUT_MS = 12000;
const MAX_BODY_BYTES = 300 * 1024;
const USER_AGENT = 'Mozilla/5.0 (compatible; establishments-map-quality/1.0)';

// Legacy markup signs. Each regex matches once; old_markup needs at least two distinct matches.
const LEGACY_SIGNS = [
  /<font[\s>\/]/i,
  /<marquee[\s>\/]/i,
  /<frameset[\s>\/]/i,
  /<center[\s>\/]/i,
  /<!doctype\s+html\s+public\s+["']-\/\/w3c\/\/dtd\s+(?:html\s+4|xhtml\s+1\.0\s+transitional)/i,
  /<meta\b[^<>]*charset\s*=\s*["']?\s*windows-1251/i,
];

// Phrases are compared after lowercasing and replacing "ё" with "е".
const PARKED_PHRASES = [
  'домен продается',
  'domain is for sale',
  'buy this domain',
  'this domain is parked',
  'купить домен',
];

// Input must look like markup before document-level checks apply.
const MARKUP_RE = /<[a-z!\/]/i;
const META_TAG_RE = /<meta\b[^<>]*>/gi;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    return new URL(value).protocol === 'http:';
  } catch {
    return false;
  }
}

// Strips non-visible content and tags. Unfinished trailing markup is removed too.
// Entities count as one character each so the length stays close to what a reader sees.
function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[a-z!\/][^<>]*>/gi, ' ')
    .replace(/<[a-z!\/][^<>]*$/i, ' ')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasViewport(html) {
  for (const tag of html.match(META_TAG_RE) || []) {
    const attrs = tag.slice(5, -1); // drop "<meta" and ">"
    ATTR_RE.lastIndex = 0;
    let m;
    let name = null;
    while ((m = ATTR_RE.exec(attrs))) {
      if (m[1].toLowerCase() === 'name') {
        name = (m[2] ?? m[3] ?? m[4] ?? '').trim().toLowerCase();
      }
    }
    if (name === 'viewport') return true;
  }
  return false;
}

// Returns 'missing', 'empty', 'ok' or 'unknown' (opened but never closed, so truncated).
function titleState(html) {
  const open = /<title\b[^<>]*>/i.exec(html);
  if (!open) return 'missing';
  const rest = html.slice(open.index + open[0].length);
  const close = /<\/title\s*>/i.exec(rest);
  if (!close) return 'unknown';
  const content = rest.slice(0, close.index).replace(/&nbsp;|&#160;/gi, ' ').trim();
  return content ? 'ok' : 'empty';
}

/**
 * Pure analysis of one page.
 * @param {string} html   Page HTML. May be truncated or garbage.
 * @param {string} finalUrl  URL after redirects.
 * @returns {{ issues: string[] }} Issue ids, in ISSUES key order.
 */
export function analyzeHtml(html, finalUrl) {
  const found = new Set();
  try {
    if (isHttpUrl(finalUrl)) found.add('no_https');

    const text = typeof html === 'string' ? html : '';
    if (text.trim() && MARKUP_RE.test(text)) {
      // Head checks run only when the head is complete. Otherwise the page may be truncated.
      const headComplete = /<\/head\s*>|<body[\s>]/i.test(text);
      if (headComplete) {
        if (!hasViewport(text)) found.add('no_viewport');
        const title = titleState(text);
        if (title === 'missing' || title === 'empty') found.add('no_title');
      }

      const legacyCount = LEGACY_SIGNS.filter((re) => re.test(text)).length;
      if (legacyCount >= 2) found.add('old_markup');

      const visible = visibleText(text);
      const normalized = visible.toLowerCase().replace(/ё/g, 'е');
      if (PARKED_PHRASES.some((phrase) => normalized.includes(phrase))) found.add('parked');

      if (visible.length < STUB_MIN_TEXT) found.add('builder_stub');
    }
  } catch {
    // Defensive: never throw. Whatever was found so far is returned.
  }
  return { issues: Object.keys(ISSUES).filter((id) => found.has(id)) };
}

function getHeader(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? String(headers[key] ?? '') : '';
}

async function discardBody(res) {
  try {
    await res.body?.cancel?.();
  } catch {
    /* body is not needed */
  }
}

function decodeBytes(bytes, charset) {
  try {
    return new TextDecoder(charset || 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

// Reads at most MAX_BODY_BYTES. Uses the stream reader when present, else res.text().
async function readLimited(res, contentType) {
  const charset = /charset\s*=\s*["']?\s*([^;"'\s]+)/i.exec(contentType)?.[1];
  const reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;

  if (!reader) {
    if (typeof res.text !== 'function') return '';
    const text = await res.text();
    return String(text ?? '').slice(0, MAX_BODY_BYTES);
  }

  const chunks = [];
  let total = 0;
  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = value;
      if (typeof chunk === 'string') chunk = new TextEncoder().encode(chunk);
      else if (chunk instanceof ArrayBuffer) chunk = new Uint8Array(chunk);
      if (!(chunk instanceof Uint8Array)) continue;
      const room = MAX_BODY_BYTES - total;
      if (chunk.length > room) {
        chunks.push(chunk.subarray(0, room));
        total += room;
        break;
      }
      chunks.push(chunk);
      total += chunk.length;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already finished */
    }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return decodeBytes(bytes, charset);
}

/**
 * Fetches a page and analyzes it. Never throws.
 * @returns {Promise<{ ok: true, issues: string[] } | { ok: false }>}
 */
export async function auditSite(url, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*;q=0.8' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res || typeof res.status !== 'number' || res.status < 200 || res.status > 299) {
      await discardBody(res);
      return { ok: false };
    }
    const contentType = getHeader(res.headers, 'content-type');
    if (!/html/i.test(contentType)) {
      await discardBody(res);
      return { ok: false };
    }
    const html = await readLimited(res, contentType);
    const finalUrl = typeof res.url === 'string' && res.url ? res.url : String(url);
    return { ok: true, issues: analyzeHtml(html, finalUrl).issues };
  } catch {
    return { ok: false };
  }
}
