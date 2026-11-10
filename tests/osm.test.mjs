import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, hostOf, isSocialUrl, buildQuery, buildSelectors, normalizeElement, normalizeResponse, siteStatus, fetchOverpass } from '../js/osm.js';
import { splitBbox, checkSite } from '../scripts/update-data.mjs';

test('normalizeUrl', () => {
  assert.equal(normalizeUrl('example.ru'), 'https://example.ru/');
  assert.equal(normalizeUrl('http://example.ru/a; http://b.ru'), 'http://example.ru/a');
  assert.equal(normalizeUrl('javascript://alert(1)'), '');
  assert.equal(normalizeUrl('нет сайта'), '');
  assert.equal(normalizeUrl('localhost'), '');
  assert.equal(normalizeUrl(undefined), '');
});

test('hostOf и isSocialUrl', () => {
  assert.equal(hostOf('https://www.Example.ru/x'), 'example.ru');
  assert.ok(isSocialUrl('https://vk.com/cafe'));
  assert.ok(isSocialUrl('https://m.vk.com/cafe'));
  assert.ok(isSocialUrl('https://cafe.taplink.cc/'));
  assert.ok(!isSocialUrl('https://myvk.com/'));
  assert.ok(!isSocialUrl('https://cafe-romashka.ru/'));
});

test('buildQuery', () => {
  const q = buildQuery([55.7, 37.5, 55.8, 37.7]);
  assert.match(q, /^\[out:json\]\[timeout:120\];/);
  assert.match(q, /nwr\["name"\]\["shop"\]\(55\.7,37\.5,55\.8,37\.7\);/);
  assert.match(q, /\["amenity"~"\^\([a-z_|]*\bcafe\b[a-z_|]*\)\$"\]/);
  assert.match(q, /out center tags;$/);
  assert.throws(() => buildQuery([1, 2, 3]), TypeError);
  assert.throws(() => buildQuery([56, 37, 55, 38]), RangeError);
  assert.ok(buildSelectors({ 'amenity=x"]bad': {} }).every((s) => !s.includes('bad')));
});

test('normalizeElement: узел без сайта', () => {
  const p = normalizeElement({ type: 'node', id: 7, lat: 55.1234567, lon: 37.7654321, tags: {
    name: 'Ромашка', amenity: 'cafe', phone: '+7 900 000-00-00; +7 901', 'addr:street': 'улица Ленина', 'addr:housenumber': '5', opening_hours: 'Mo-Su 10:00-22:00',
  } });
  assert.deepEqual(p, { id: 'n7', lat: 55.123457, lon: 37.765432, name: 'Ромашка', kind: 'amenity=cafe', phone: '+7 900 000-00-00', address: 'улица Ленина, 5', hours: 'Mo-Su 10:00-22:00' });
  assert.equal(siteStatus(p), 'none');
});

test('normalizeElement: сайт, соцсети, линия с центром', () => {
  const p = normalizeElement({ type: 'way', id: 9, center: { lat: 1, lon: 2 }, tags: {
    name: 'Салон', shop: 'hairdresser', 'contact:website': 'salon.ru', 'contact:vk': 'salon_club', 'contact:instagram': 'https://instagram.com/salon', brand: 'Сеть',
  } });
  assert.equal(p.id, 'w9');
  assert.equal(p.website, 'https://salon.ru/');
  assert.deepEqual(p.social, ['https://vk.com/salon_club', 'https://instagram.com/salon']);
  assert.equal(p.brand, 'Сеть');
  assert.equal(siteStatus(p), 'site');
  assert.equal(siteStatus({ ...p, siteCheck: 'dead' }), 'dead');
});

test('normalizeElement: ссылка на соцсеть в теге website — это не сайт', () => {
  const p = normalizeElement({ type: 'node', id: 1, lat: 1, lon: 2, tags: { name: 'Бар', amenity: 'bar', website: 'https://vk.com/bar' } });
  assert.equal(p.website, undefined);
  assert.deepEqual(p.social, ['https://vk.com/bar']);
  assert.equal(siteStatus(p), 'social');
});

test('normalizeElement: отбрасывает неподходящее', () => {
  assert.equal(normalizeElement({ type: 'node', id: 1, lat: 1, lon: 2, tags: { amenity: 'cafe' } }), null, 'без названия');
  assert.equal(normalizeElement({ type: 'node', id: 1, lat: 1, lon: 2, tags: { name: 'P', amenity: 'parking' } }), null, 'не заведение');
  assert.equal(normalizeElement({ type: 'node', id: 1, lat: 1, lon: 2, tags: { name: 'P', shop: 'vacant' } }), null, 'пустующее');
  assert.equal(normalizeElement({ type: 'way', id: 1, tags: { name: 'P', shop: 'bakery' } }), null, 'без координат');
  assert.equal(normalizeElement(null), null);
});

test('normalizeResponse: дубликаты и сортировка', () => {
  const el = (id) => ({ type: 'node', id, lat: 1, lon: 2, tags: { name: 'A', shop: 'bakery' } });
  const list = normalizeResponse({ elements: [el(2), el(1), el(2)] });
  assert.deepEqual(list.map((p) => p.id), ['n1', 'n2']);
  assert.deepEqual(normalizeResponse(null), []);
});

test('fetchOverpass: переходит на запасной сервер', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url === 'a') return { ok: false, status: 504 };
    return { ok: true, status: 200, json: async () => ({ elements: [] }) };
  };
  const json = await fetchOverpass('q', { endpoints: ['a', 'b'], fetchImpl });
  assert.deepEqual(json, { elements: [] });
  assert.deepEqual(calls, ['a', 'b']);
  await assert.rejects(fetchOverpass('q', { endpoints: ['a'], fetchImpl }), /Overpass API недоступен.*HTTP 504/);
});

test('splitBbox покрывает область целиком', () => {
  assert.deepEqual(splitBbox([55.73, 37.58, 55.78, 37.66]), [[55.73, 37.58, 55.78, 37.66]]);
  const tiles = splitBbox([55.5, 37.3, 55.9, 37.9]);
  assert.ok(tiles.length > 1);
  assert.equal(Math.min(...tiles.map((t) => t[0])), 55.5);
  assert.equal(Math.max(...tiles.map((t) => t[2])), 55.9);
  assert.equal(Math.min(...tiles.map((t) => t[1])), 37.3);
  assert.equal(Math.max(...tiles.map((t) => t[3])), 37.9);
});

test('checkSite помечает «не открывается» только в однозначных случаях', async () => {
  const resp = (status) => async () => ({ status, body: { cancel: async () => {} } });
  assert.equal(await checkSite('https://a.ru', resp(200)), 'ok');
  assert.equal(await checkSite('https://a.ru', resp(403)), 'ok');
  assert.equal(await checkSite('https://a.ru', resp(503)), 'ok');
  assert.equal(await checkSite('https://a.ru', resp(404)), 'dead');
  const fail = (code) => async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code } }); };
  assert.equal(await checkSite('https://a.ru', fail('ENOTFOUND')), 'dead');
  assert.equal(await checkSite('https://a.ru', fail('ETIMEDOUT')), 'unknown');
});
