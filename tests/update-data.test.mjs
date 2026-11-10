import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSite, checkSites } from '../scripts/update-data.mjs';
import { ISSUES, knownIssues, issueLabels } from '../js/site-issues.js';
import { ISSUES as SCRIPT_ISSUES } from '../scripts/site-quality.mjs';

const GOOD = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Кафе</title></head><body>${'Текст страницы. '.repeat(30)}</body></html>`;
const NO_VIEWPORT = `<!doctype html><html><head><title>Кафе</title></head><body>${'Текст страницы. '.repeat(30)}</body></html>`;

const page = (html, { status = 200, type = 'text/html; charset=utf-8', url } = {}) => ({
  status,
  url,
  headers: { 'content-type': type },
  text: async () => html,
});
const dnsError = (code) => Object.assign(new TypeError('fetch failed'), { cause: { code } });

/** fetch-заглушка: по адресу отдаёт ответ или бросает ошибку; считает обращения. */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const route = routes[url];
    const value = typeof route === 'function' ? route(calls.filter((u) => u === url).length) : route;
    if (value instanceof Error) throw value;
    return value;
  };
  impl.calls = calls;
  return impl;
}

test('общий справочник проблем: один и тот же объект для сайта и скрипта', () => {
  assert.equal(SCRIPT_ISSUES, ISSUES);
  assert.deepEqual(knownIssues(['builder_stub', 'bogus', 'no_https']), ['no_https', 'builder_stub']);
  assert.deepEqual(knownIssues('no_https'), []);
  assert.deepEqual(knownIssues(undefined), []);
  assert.deepEqual(issueLabels(['no_viewport', 'x']), ['Нет мобильной версии']);
});

test('inspectSite: один запрос даёт и доступность, и проблемы', async () => {
  const f = fakeFetch({
    'https://ok.ru/': page(GOOD, { url: 'https://ok.ru/' }),
    'https://old.ru/': page(NO_VIEWPORT, { url: 'http://old.ru/' }),
    'https://gone.ru/': page('', { status: 404 }),
    'https://gone410.ru/': page('', { status: 410 }),
    'https://forbidden.ru/': page('', { status: 403 }),
    'https://pdf.ru/': page('%PDF', { type: 'application/pdf' }),
    'https://nodomain.ru/': dnsError('ENOTFOUND'),
    'https://slow.ru/': dnsError('ETIMEDOUT'),
  });
  assert.deepEqual(await inspectSite('https://ok.ru/', f), { check: 'ok', issues: [] });
  assert.deepEqual(await inspectSite('https://old.ru/', f), { check: 'ok', issues: ['no_https', 'no_viewport'] });
  assert.deepEqual(await inspectSite('https://gone.ru/', f), { check: 'dead', issues: null });
  assert.deepEqual(await inspectSite('https://gone410.ru/', f), { check: 'dead', issues: null });
  assert.deepEqual(await inspectSite('https://forbidden.ru/', f), { check: 'ok', issues: null });
  assert.deepEqual(await inspectSite('https://pdf.ru/', f), { check: 'ok', issues: null });
  assert.deepEqual(await inspectSite('https://nodomain.ru/', f), { check: 'dead', issues: null });
  assert.deepEqual(await inspectSite('https://slow.ru/', f), { check: 'unknown', issues: null });
  assert.equal(f.calls.length, 8, 'каждый сайт запрошен ровно один раз');
});

test('checkSites: siteIssues только непустые, dead после повторной попытки, один запрос на адрес', async () => {
  const f = fakeFetch({
    'https://ok.ru/': page(GOOD),
    'https://old.ru/': page(NO_VIEWPORT),
    'https://gone.ru/': page('', { status: 404 }),
    // Первый раз сбой DNS, при повторной попытке сайт отвечает — «мёртвым» не считаем.
    'https://flaky.ru/': (n) => (n === 1 ? dnsError('ENOTFOUND') : page(GOOD)),
    'https://slow.ru/': dnsError('ETIMEDOUT'),
  });
  const places = [
    { id: 'a', website: 'https://ok.ru/' },
    { id: 'b', website: 'https://old.ru/' },
    { id: 'b2', website: 'https://old.ru/' },
    { id: 'c', website: 'https://gone.ru/' },
    { id: 'd', website: 'https://flaky.ru/' },
    { id: 'e', website: 'https://slow.ru/' },
    { id: 'f', social: ['https://vk.com/x'] },
  ];
  const result = await checkSites(places, { fetchImpl: f, concurrency: 3 });
  assert.deepEqual(result, { checked: 6, dead: 1, withIssues: 2 });
  assert.deepEqual(places, [
    { id: 'a', website: 'https://ok.ru/' },
    { id: 'b', website: 'https://old.ru/', siteIssues: ['no_viewport'] },
    { id: 'b2', website: 'https://old.ru/', siteIssues: ['no_viewport'] },
    { id: 'c', website: 'https://gone.ru/', siteCheck: 'dead' },
    { id: 'd', website: 'https://flaky.ru/' },
    { id: 'e', website: 'https://slow.ru/' },
    { id: 'f', social: ['https://vk.com/x'] },
  ]);
  assert.notEqual(places[1].siteIssues, places[2].siteIssues, 'массивы не общие');
  const count = (url) => f.calls.filter((u) => u === url).length;
  assert.equal(count('https://ok.ru/'), 1);
  assert.equal(count('https://old.ru/'), 1, 'одинаковый адрес проверяется один раз');
  assert.equal(count('https://gone.ru/'), 2, 'повторная попытка для «мёртвого»');
  assert.equal(count('https://flaky.ru/'), 2);
  assert.equal(count('https://slow.ru/'), 1);
});

test('checkSites с audit: false не скачивает страницы и не пишет siteIssues', async () => {
  let bodyRead = 0;
  const f = fakeFetch({
    'https://old.ru/': { status: 200, headers: { 'content-type': 'text/html' }, text: async () => { bodyRead++; return NO_VIEWPORT; } },
    'https://gone.ru/': page('', { status: 410 }),
  });
  const places = [{ id: 'a', website: 'https://old.ru/' }, { id: 'b', website: 'https://gone.ru/' }];
  assert.deepEqual(await checkSites(places, { fetchImpl: f, audit: false }), { checked: 2, dead: 1, withIssues: 0 });
  assert.deepEqual(places, [{ id: 'a', website: 'https://old.ru/' }, { id: 'b', website: 'https://gone.ru/', siteCheck: 'dead' }]);
  assert.equal(bodyRead, 0);
});
