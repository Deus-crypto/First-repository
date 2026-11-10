import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHtml, auditSite, ISSUES } from '../scripts/site-quality.mjs';

const HTTPS = 'https://example.ru/';
const LONG_TEXT = 'Наше кафе работает каждый день с утра до позднего вечера, готовим на месте. '.repeat(4);

const modern = (body = `<h1>Кафе</h1><p>${LONG_TEXT}</p>`, head = '') => `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Кафе Тест</title>${head}</head>
<body>${body}</body></html>`;

const has = (html, url = HTTPS) => analyzeHtml(html, url).issues;

describe('ISSUES', () => {
  it('has the six ids with Russian labels', () => {
    assert.deepEqual(Object.keys(ISSUES), ['no_https', 'no_viewport', 'no_title', 'old_markup', 'parked', 'builder_stub']);
    for (const v of Object.values(ISSUES)) assert.ok(typeof v.label === 'string' && v.label.length > 0);
  });
});

describe('no_https', () => {
  it('is reported for an http final URL, even with empty html', () => {
    assert.deepEqual(analyzeHtml('', 'http://example.ru/'), { issues: ['no_https'] });
  });
  it('is not reported for https, invalid or missing URLs', () => {
    assert.deepEqual(analyzeHtml('', HTTPS).issues, []);
    assert.deepEqual(analyzeHtml('', 'not a url').issues, []);
    assert.deepEqual(analyzeHtml('', undefined).issues, []);
  });
});

describe('modern page', () => {
  it('has no issues', () => {
    assert.deepEqual(has(modern()), []);
  });
});

describe('no_viewport', () => {
  const noViewport = '<html><head><title>T</title></head><body><p>x</p></body></html>';

  it('is reported when there is no viewport meta', () => {
    assert.ok(has(noViewport).includes('no_viewport'));
  });

  for (const [name, tag] of [
    ['single quotes', `<meta name='viewport' content='width=device-width'>`],
    ['uppercase', `<META NAME="VIEWPORT" CONTENT="width=device-width">`],
    ['different attribute order', `<meta content="width=device-width" name="viewport">`],
    ['unquoted', `<meta name=viewport content=width=device-width>`],
    ['self-closing', `<meta name="viewport" content="width=device-width" />`],
  ]) {
    it(`is not reported with ${name}`, () => {
      assert.ok(!has(`<html><head>${tag}<title>T</title></head><body><p>x</p></body></html>`).includes('no_viewport'));
    });
  }

  it('is not reported for a head that is cut off (truncated)', () => {
    assert.ok(!has('<html><head><meta charset="utf-8"><met').includes('no_viewport'));
  });
});

describe('no_title', () => {
  const wrap = (head) => `<html><head>${head}<meta name="viewport" content="width=device-width"></head><body><p>${LONG_TEXT}</p></body></html>`;

  it('is reported when the title is missing', () => {
    assert.ok(has(wrap('')).includes('no_title'));
  });
  it('is reported when the title is empty or whitespace', () => {
    assert.ok(has(wrap('<title></title>')).includes('no_title'));
    assert.ok(has(wrap('<title>   \n </title>')).includes('no_title'));
    assert.ok(has(wrap('<title>&nbsp;</title>')).includes('no_title'));
  });
  it('is not reported with a real title', () => {
    assert.ok(!has(wrap('<title>Кафе</title>')).includes('no_title'));
  });
  it('is not reported when the title is opened but never closed (truncated)', () => {
    assert.ok(!has('<html><head><title>Кафе').includes('no_title'));
  });
});

describe('old_markup', () => {
  it('is not reported for one legacy sign alone', () => {
    assert.ok(!has(modern(`<center>${LONG_TEXT}</center>`)).includes('old_markup'));
    assert.ok(!has(modern(`<font size="2">${LONG_TEXT}</font>`)).includes('old_markup'));
  });
  it('is reported for two distinct signs', () => {
    assert.ok(has(modern(`<center><marquee>${LONG_TEXT}</marquee></center>`)).includes('old_markup'));
    assert.ok(has(modern(`<font size="2"><center>${LONG_TEXT}</center></font>`)).includes('old_markup'));
  });
  it('counts an HTML 4.01 Transitional doctype and windows-1251 charset as two signs', () => {
    const html = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1251">
<meta name="viewport" content="width=device-width"><title>Кафе</title></head><body><p>${LONG_TEXT}</p></body></html>`;
    assert.ok(has(html).includes('old_markup'));
  });
  it('is not reported for an HTML5 doctype with a windows-1251 charset alone', () => {
    const html = modern(`<p>${LONG_TEXT}</p>`).replace('utf-8', 'windows-1251');
    assert.ok(!has(html).includes('old_markup'));
  });
  it('does not treat tags like <fontx> or <centered> as legacy', () => {
    assert.ok(!has(modern(`<fontx>a</fontx><centered>b</centered>${LONG_TEXT}`)).includes('old_markup'));
  });
});

describe('parked', () => {
  const parked = (text) => modern(`<h1>${text}</h1><p>${LONG_TEXT}</p>`);

  for (const phrase of [
    'Домен продаётся',
    'домен продается',
    'ДОМЕН   ПРОДАЁТСЯ',
    'Domain is for sale',
    'Buy this domain',
    'This domain is parked',
    'Купить домен',
  ]) {
    it(`is reported for "${phrase}"`, () => {
      assert.ok(has(parked(phrase)).includes('parked'));
    });
  }

  it('is not reported for ordinary text', () => {
    assert.ok(!has(parked('Продаём кофе и выпечку')).includes('parked'));
  });
  it('is not reported when the phrase appears only inside a script', () => {
    const html = modern(`<p>${LONG_TEXT}</p><script>var s = "домен продаётся";</script>`);
    assert.ok(!has(html).includes('parked'));
  });
});

describe('builder_stub', () => {
  it('is reported for a page with little visible text', () => {
    const html = '<html><head><title>x</title><meta name="viewport" content="width=device-width"></head><body><h1>Скоро открытие</h1></body></html>';
    assert.ok(has(html).includes('builder_stub'));
  });
  it('is reported when the text is only inside a script or style', () => {
    const html = `<html><head><title>x</title><meta name="viewport" content="width=device-width"></head><body><script>${'var a = 1; '.repeat(100)}</script><style>${'p{}'.repeat(100)}</style></body></html>`;
    assert.ok(has(html).includes('builder_stub'));
  });
  it('is not reported for a page with long text', () => {
    assert.ok(!has(modern()).includes('builder_stub'));
  });
  it('is not reported for empty html', () => {
    assert.ok(!has('').includes('builder_stub'));
  });
});

describe('analyzeHtml robustness and order', () => {
  it('returns issues in ISSUES key order', () => {
    const html = '<html><body><p>коротко</p><font>a</font><center>b</center></body></html>';
    assert.deepEqual(has(html, 'http://example.ru/'), ['no_https', 'no_viewport', 'no_title', 'old_markup', 'builder_stub']);
  });

  it('never throws on garbage input', () => {
    const inputs = [
      ['asdf', HTTPS],
      ['<<<>>>\u0000￿', HTTPS],
      ['<html><bo', HTTPS],
      [null, HTTPS],
      [undefined, undefined],
      [123, 'not a url'],
      [{}, 'http://x'],
      ['<meta' .repeat(5000), HTTPS],
    ];
    for (const [html, url] of inputs) {
      const result = analyzeHtml(html, url);
      assert.ok(Array.isArray(result.issues));
    }
  });

  it('returns no content issues for text that is not markup', () => {
    assert.deepEqual(analyzeHtml('asdf', HTTPS).issues, []);
  });
});

// ---- auditSite with fake fetch implementations (no network) ----

const htmlResponse = (body, init = {}) =>
  new Response(body, {
    status: init.status ?? 200,
    headers: { 'content-type': init.contentType ?? 'text/html; charset=utf-8' },
  });

describe('auditSite', () => {
  it('returns ok with issues for an html page', async () => {
    const fake = async () => htmlResponse('<html><head></head><body><p>коротко</p></body></html>');
    const result = await auditSite('https://example.ru/', fake);
    assert.equal(result.ok, true);
    assert.deepEqual(result.issues, ['no_viewport', 'no_title', 'builder_stub']);
  });

  it('returns ok with no issues for a modern page', async () => {
    const result = await auditSite(HTTPS, async () => htmlResponse(modern()));
    assert.deepEqual(result, { ok: true, issues: [] });
  });

  it('uses the final URL after redirects for no_https', async () => {
    const fake = async () => ({
      status: 200,
      url: 'http://example.ru/',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => modern(),
    });
    const result = await auditSite('https://example.ru/', fake);
    assert.deepEqual(result, { ok: true, issues: ['no_https'] });
  });

  it('passes redirect, timeout signal and a browser-like User-Agent to fetch', async () => {
    let seen;
    await auditSite(HTTPS, async (url, opts) => {
      seen = { url, opts };
      return htmlResponse(modern());
    });
    assert.equal(seen.url, HTTPS);
    assert.equal(seen.opts.redirect, 'follow');
    assert.ok(seen.opts.signal instanceof AbortSignal);
    assert.match(seen.opts.headers['User-Agent'], /^Mozilla\/5\.0/);
  });

  it('returns ok:false for a non-html content type', async () => {
    const fake = async () => htmlResponse('{"a":1}', { contentType: 'application/json' });
    assert.deepEqual(await auditSite(HTTPS, fake), { ok: false });
  });

  it('returns ok:false for a missing content type', async () => {
    const fake = async () => ({ status: 200, headers: {}, text: async () => modern() });
    assert.deepEqual(await auditSite(HTTPS, fake), { ok: false });
  });

  it('returns ok:false for a 500 response', async () => {
    const fake = async () => htmlResponse(modern(), { status: 500 });
    assert.deepEqual(await auditSite(HTTPS, fake), { ok: false });
  });

  it('returns ok:false for a 404 response', async () => {
    const fake = async () => htmlResponse(modern(), { status: 404 });
    assert.deepEqual(await auditSite(HTTPS, fake), { ok: false });
  });

  it('returns ok:false when fetch throws', async () => {
    const fake = async () => {
      throw new TypeError('fetch failed');
    };
    assert.deepEqual(await auditSite(HTTPS, fake), { ok: false });
  });

  it('returns ok:false when fetchImpl is not a function', async () => {
    assert.deepEqual(await auditSite(HTTPS, null), { ok: false });
  });

  it('reads at most 300 KB from a stream body and still analyzes it', async () => {
    const CHUNK = 16 * 1024;
    const TOTAL = 1024 * 1024;
    const head = '<html><head><meta name="viewport" content="width=device-width"><title>Большой</title></head><body>';
    const headBytes = new TextEncoder().encode(head);
    const filler = new Uint8Array(CHUNK).fill(0x61); // "a"
    let pulled = 0;
    let sent = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (sent >= TOTAL) return controller.close();
        const chunk = sent === 0 ? headBytes : filler;
        sent += chunk.length;
        pulled += chunk.length;
        controller.enqueue(chunk);
      },
    }, { highWaterMark: 0 }); // pull only when the reader asks, so `pulled` counts what is consumed
    const fake = async () => ({
      status: 200,
      url: HTTPS,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      body: stream,
    });
    const result = await auditSite(HTTPS, fake);
    assert.deepEqual(result, { ok: true, issues: [] });
    assert.ok(pulled <= 300 * 1024 + CHUNK, `read ${pulled} bytes, expected at most ~300 KB`);
    assert.ok(pulled < TOTAL);
  });

  it('falls back to res.text() when there is no body stream and truncates it', async () => {
    const big = modern(`<p>${'а'.repeat(400 * 1024)}</p>`);
    const fake = async () => ({
      status: 200,
      url: HTTPS,
      headers: { 'Content-Type': 'text/html' },
      text: async () => big,
    });
    const result = await auditSite(HTTPS, fake);
    assert.equal(result.ok, true);
    assert.deepEqual(result.issues, []);
  });

  it('returns ok:false when reading the body throws', async () => {
    const stream = new ReadableStream({
      pull(controller) {
        controller.error(new Error('connection reset'));
      },
    });
    const fake = async () => ({
      status: 200,
      url: HTTPS,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: stream,
    });
    assert.deepEqual(await auditSite(HTTPS, fake), { ok: false });
  });
});
