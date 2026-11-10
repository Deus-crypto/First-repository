import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeHistory, isNew, diffSummary, hasWebPresence } from '../js/history.js';

const TODAY = '2026-11-10';

const site = { id: 'n1', name: 'A', kind: 'shop=bakery', website: 'https://a.example/' };
const social = { id: 'n2', name: 'B', kind: 'amenity=cafe', social: ['https://vk.com/b'] };
const bare = { id: 'n3', name: 'C', kind: 'amenity=cafe' };

test('hasWebPresence: сайт или непустой массив соцсетей', () => {
  assert.equal(hasWebPresence(site), true);
  assert.equal(hasWebPresence(social), true);
  assert.equal(hasWebPresence(bare), false);
  assert.equal(hasWebPresence({ social: [] }), false);
  assert.equal(hasWebPresence({ website: '' }), false);
});

test('mergeHistory: первый запуск (пустой prev или undefined) не ставит added', () => {
  const out = mergeHistory([], [site, bare], { today: TODAY });
  assert.equal(out.length, 2);
  assert.ok(!('added' in out[0]));
  assert.ok(!('added' in out[1]));
  assert.ok(!('changed' in out[0]));
  assert.ok(!('changeType' in out[0]));

  const out2 = mergeHistory(undefined, [site], { today: TODAY });
  assert.ok(!('added' in out2[0]));
  const out3 = mergeHistory(null, null, { today: TODAY });
  assert.deepEqual(out3, []);
});

test('mergeHistory: демо-данные в prev считаются первым запуском', () => {
  const prev = [{ id: 'n1', name: 'Demo', kind: 'shop=bakery', added: '2026-01-01' }];
  const out = mergeHistory(prev, [site, bare], { today: TODAY, prevIsDemo: true });
  assert.ok(!('added' in out[0]), 'демо-добавленные даты не переносятся');
  assert.ok(!('added' in out[1]));
});

test('mergeHistory: новое место получает added = today', () => {
  const prev = [site];
  const out = mergeHistory(prev, [site, bare], { today: TODAY, prevIsDemo: false });
  const newOne = out.find((p) => p.id === 'n3');
  assert.equal(newOne.added, TODAY);
});

test('mergeHistory: существующее место сохраняет прежний added', () => {
  const prev = [{ ...site, added: '2026-10-01' }];
  const out = mergeHistory(prev, [site], { today: TODAY });
  assert.equal(out[0].added, '2026-10-01');
});

test('mergeHistory: если у прежнего места не было added, он остаётся отсутствующим', () => {
  const prev = [{ ...site }];
  const out = mergeHistory(prev, [site], { today: TODAY });
  assert.ok(!('added' in out[0]));
});

test('mergeHistory: потеря сайта -> changed = today, site_lost', () => {
  const prev = [{ ...site, added: '2026-10-01' }];
  const now = { id: 'n1', name: 'A', kind: 'shop=bakery' };
  const out = mergeHistory(prev, [now], { today: TODAY });
  assert.equal(out[0].changed, TODAY);
  assert.equal(out[0].changeType, 'site_lost');
  assert.equal(out[0].added, '2026-10-01');
});

test('mergeHistory: сайт исчез, но остались соцсети — это не потеря', () => {
  const prev = [{ id: 'n1', name: 'A', kind: 'shop=bakery', website: 'https://a.example/', social: ['https://vk.com/a'] }];
  const now = { id: 'n1', name: 'A', kind: 'shop=bakery', social: ['https://vk.com/a'] };
  const out = mergeHistory(prev, [now], { today: TODAY });
  assert.ok(!('changed' in out[0]));
});

test('mergeHistory: появился сайт или соцсеть -> site_gained', () => {
  const siteless = { id: 'n1', name: 'A', kind: 'shop=bakery' };
  const out = mergeHistory([siteless], [site], { today: TODAY });
  assert.equal(out[0].changed, TODAY);
  assert.equal(out[0].changeType, 'site_gained');

  const socialless = { id: 'n2', name: 'B', kind: 'amenity=cafe' };
  const out2 = mergeHistory([socialless], [social], { today: TODAY });
  assert.equal(out2[0].changeType, 'site_gained');
});

test('mergeHistory: без изменения наличия сайта changed/changeType переносятся как были', () => {
  const prev = [{ ...site, added: '2026-10-01', changed: '2026-10-20', changeType: 'site_gained' }];
  const out = mergeHistory(prev, [site], { today: TODAY });
  assert.equal(out[0].changed, '2026-10-20');
  assert.equal(out[0].changeType, 'site_gained');
});

test('mergeHistory: при новом изменении старые changed перезаписываются', () => {
  const prev = [{ ...site, added: '2026-10-01', changed: '2026-10-20', changeType: 'site_gained' }];
  const now = { id: 'n1', name: 'A', kind: 'shop=bakery' };
  const out = mergeHistory(prev, [now], { today: TODAY });
  assert.equal(out[0].changed, TODAY);
  assert.equal(out[0].changeType, 'site_lost');
});

test('mergeHistory: changed переносится, даже если сейчас сайта нет и раньше не было', () => {
  const prev = [{ ...bare, added: '2026-10-01', changed: '2026-10-05', changeType: 'site_lost' }];
  const out = mergeHistory(prev, [bare], { today: TODAY });
  assert.equal(out[0].changed, '2026-10-05');
  assert.equal(out[0].changeType, 'site_lost');
});

test('mergeHistory: не мутирует входные массивы и объекты', () => {
  const prev = [{ ...site, added: '2026-10-01', social: ['https://vk.com/a'] }];
  const fresh = [{ id: 'n1', name: 'A', kind: 'shop=bakery', social: ['https://vk.com/a'] }, { ...bare }];
  const prevSnapshot = structuredClone(prev);
  const freshSnapshot = structuredClone(fresh);

  const out = mergeHistory(prev, fresh, { today: TODAY });

  assert.deepEqual(prev, prevSnapshot);
  assert.deepEqual(fresh, freshSnapshot);
  assert.notEqual(out, fresh);
  assert.notEqual(out[0], fresh[0]);
  assert.notEqual(out[0].social, fresh[0].social, 'массив social не разделяется со входом');
  out[0].social.push('x');
  assert.equal(fresh[0].social.length, 1);
});

test('mergeHistory: входящие added/changed в свежих данных не протекают в результат', () => {
  const fresh = [{ ...bare, added: '1999-01-01', changed: '1999-01-02', changeType: 'site_lost' }];
  const out = mergeHistory([], fresh, { today: TODAY });
  assert.ok(!('added' in out[0]));
  assert.ok(!('changed' in out[0]));
  assert.ok(!('changeType' in out[0]));
});

test('mergeHistory: today по умолчанию — текущая дата UTC', () => {
  const out = mergeHistory([site], [site, bare]);
  assert.equal(out[1].added, new Date().toISOString().slice(0, 10));
});

test('isNew: ровно N дней назад — новое, N+1 — уже нет', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  assert.equal(isNew({ added: '2026-10-27' }, 14, now), true);
  assert.equal(isNew({ added: '2026-10-26' }, 14, now), false);
});

test('isNew: по умолчанию 14 дней', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  assert.equal(isNew({ added: '2026-10-27' }, undefined, now), true);
  assert.equal(isNew({ added: '2026-10-20' }, undefined, now), false);
});

test('isNew: now может быть строкой ISO', () => {
  assert.equal(isNew({ added: '2026-11-05' }, 14, '2026-11-10T12:00:00Z'), true);
  assert.equal(isNew({ added: '2026-10-01' }, 14, '2026-11-10T12:00:00Z'), false);
});

test('isNew: нет added, мусорная или несуществующая дата -> false', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  assert.equal(isNew({}, 14, now), false);
  assert.equal(isNew({ added: '' }, 14, now), false);
  assert.equal(isNew({ added: 'вчера' }, 14, now), false);
  assert.equal(isNew({ added: '2026-02-30' }, 14, now), false);
  assert.equal(isNew({ added: '2026-11-10T10:00:00Z' }, 14, now), false, 'только формат YYYY-MM-DD');
  assert.equal(isNew({ added: 20261110 }, 14, now), false);
  assert.equal(isNew(null, 14, now), false);
  assert.equal(isNew(undefined, 14, now), false);
});

test('isNew: дата в будущем на сутки допустима, больше суток — нет', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  assert.equal(isNew({ added: '2026-11-11' }, 14, now), true, 'ровно сутки вперёд (начало дня) — допустимо');
  assert.equal(isNew({ added: '2026-11-12' }, 14, now), false, 'больше суток вперёд — нет');
  assert.equal(isNew({ added: '2026-11-10' }, 14, now), true);
});

test('isNew: на границе будущего — ровно сутки вперёд включительно', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const future1 = { added: '2026-11-11' };
  assert.equal(isNew(future1, 14, now), true);
  const future2 = { added: '2026-11-12' };
  assert.equal(isNew(future2, 14, now), false);
});

test('isNew: некорректное now -> false', () => {
  assert.equal(isNew({ added: '2026-11-10' }, 14, 'не дата'), false);
});

test('diffSummary: считает добавленные, удалённые, потерянные и полученные сайты', () => {
  const prev = [
    site, // останется с сайтом
    social, // потеряет всё -> siteLost
    { id: 'gone', name: 'G', kind: 'shop=bakery' }, // удалено
    bare, // получит сайт -> siteGained
  ];
  const fresh = [
    site,
    { id: 'n2', name: 'B', kind: 'amenity=cafe' }, // соцсети пропали
    { id: 'n3', name: 'C', kind: 'amenity=cafe', website: 'https://c.example/' },
    { id: 'new1', name: 'N', kind: 'shop=bakery' }, // добавлено
    { id: 'new2', name: 'M', kind: 'shop=bakery', website: 'https://m.example/' }, // добавлено
  ];
  assert.deepEqual(diffSummary(prev, fresh), { added: 2, removed: 1, siteLost: 1, siteGained: 1 });
});

test('diffSummary: пустой или демо prev -> все нули', () => {
  assert.deepEqual(diffSummary([], [site, bare]), { added: 0, removed: 0, siteLost: 0, siteGained: 0 });
  assert.deepEqual(diffSummary(undefined, [site]), { added: 0, removed: 0, siteLost: 0, siteGained: 0 });
  assert.deepEqual(
    diffSummary([site, social], [bare], { prevIsDemo: true }),
    { added: 0, removed: 0, siteLost: 0, siteGained: 0 },
  );
});

test('diffSummary: пустой новый список при непустом prev — все удалены', () => {
  assert.deepEqual(diffSummary([site, bare], []), { added: 0, removed: 2, siteLost: 0, siteGained: 0 });
});

test('diffSummary: не мутирует входные данные', () => {
  const prev = [{ ...site }];
  const fresh = [{ ...bare }];
  const p = structuredClone(prev);
  const f = structuredClone(fresh);
  diffSummary(prev, fresh);
  assert.deepEqual(prev, p);
  assert.deepEqual(fresh, f);
});

test('связка: mergeHistory и isNew дают ожидаемые «новые на этой неделе»', () => {
  const first = mergeHistory([], [site, bare], { today: '2026-11-01' });
  // первый запуск: без added, поэтому ничего не новое
  assert.equal(first.some((p) => isNew(p, 14, new Date('2026-11-10T00:00:00Z'))), false);

  const second = mergeHistory(first, [...first, { id: 'n9', name: 'Z', kind: 'amenity=cafe' }], { today: '2026-11-08' });
  const fresh = second.filter((p) => isNew(p, 14, new Date('2026-11-10T00:00:00Z')));
  assert.deepEqual(fresh.map((p) => p.id), ['n9']);
  assert.equal(second.find((p) => p.id === 'n9').added, '2026-11-08');
});
