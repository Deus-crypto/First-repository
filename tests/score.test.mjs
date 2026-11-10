import test from 'node:test';
import assert from 'node:assert/strict';
import { leadScore, LEVELS } from '../js/score.js';

const base = { name: 'Тест', kind: 'amenity=cafe', address: 'Москва, ул. Тестовая, 1', hours: 'Mo-Su 09:00-21:00' };
const withPhone = { ...base, phone: '+7 900 000-00-00' };
const STATUSES = ['none', 'dead', 'social', 'site'];

test('ordering none > dead > social > site for otherwise identical places', () => {
  for (const place of [{ name: 'Т', kind: 'amenity=cafe' }, base, withPhone]) {
    const s = Object.fromEntries(STATUSES.map((st) => [st, leadScore(place, st).score]));
    assert.ok(s.none > s.dead, `none ${s.none} > dead ${s.dead}`);
    assert.ok(s.dead > s.social, `dead ${s.dead} > social ${s.social}`);
    assert.ok(s.social > s.site, `social ${s.social} > site ${s.site}`);
  }
});

test('phone raises the score', () => {
  for (const st of ['none', 'dead', 'social']) {
    assert.ok(leadScore(withPhone, st).score > leadScore(base, st).score, st);
  }
});

test('email raises the score', () => {
  const withEmail = { ...base, email: 'info@example.ru' };
  assert.ok(leadScore(withEmail, 'none').score > leadScore(base, 'none').score);
});

test('brand lowers the score', () => {
  const chain = { ...withPhone, brand: 'Сеть Пример' };
  assert.ok(leadScore(chain, 'none').score < leadScore(withPhone, 'none').score);
});

test('category group matters: food scores above other', () => {
  const food = leadScore({ name: 'Т', kind: 'amenity=cafe' }, 'none').score;
  const other = leadScore({ name: 'Т', kind: 'amenity=unknown_thing' }, 'none').score;
  assert.ok(food > other, `food ${food} > other ${other}`);
});

test('a place with a working site is always cold and <= 20', () => {
  const rich = { ...withPhone, email: 'a@b.ru', brand: '', website: 'https://example.ru' };
  for (const place of [{}, base, withPhone, rich]) {
    const r = leadScore(place, 'site');
    assert.equal(r.level, 'cold');
    assert.ok(r.score <= 20, `score ${r.score} <= 20`);
  }
});

test('scores are integers in 0..100', () => {
  const places = [
    undefined, null, {}, base, withPhone,
    { ...withPhone, email: 'a@b.ru', brand: 'X', kind: 'office=company' },
    { ...withPhone, email: 'a@b.ru', kind: 'amenity=cafe' },
    { ...base, brand: 'Сеть', kind: 'shop=boutique' },
  ];
  for (const place of places) {
    for (const st of [...STATUSES, undefined, 'bogus']) {
      const { score } = leadScore(place, st);
      assert.ok(Number.isInteger(score), `integer: ${score}`);
      assert.ok(score >= 0 && score <= 100, `range: ${score}`);
    }
  }
});

test('level thresholds are consistent with LEVELS', () => {
  assert.ok(LEVELS.hot.min > LEVELS.warm.min && LEVELS.warm.min > LEVELS.cold.min);
  assert.equal(LEVELS.cold.min, 0);
  const expectLevel = (score) => {
    if (score >= LEVELS.hot.min) return 'hot';
    if (score >= LEVELS.warm.min) return 'warm';
    return 'cold';
  };
  const places = [base, withPhone, { ...withPhone, email: 'a@b.ru', kind: 'amenity=cafe' }, { ...base, brand: 'Сеть' }];
  for (const place of places) {
    for (const st of STATUSES) {
      const { score, level } = leadScore(place, st);
      assert.equal(level, expectLevel(score), `${st} score ${score}`);
    }
  }
});

test('a rich place without a site reaches hot; a chain without a site is not hot', () => {
  const rich = { ...withPhone, email: 'a@b.ru', kind: 'amenity=cafe' };
  assert.equal(leadScore(rich, 'none').level, 'hot');
  const chain = { ...rich, brand: 'Сеть' };
  assert.notEqual(leadScore(chain, 'none').level, 'hot');
});

test('reasons are non-empty strings, at most 5, status reason first', () => {
  const maximal = { ...withPhone, email: 'a@b.ru', brand: 'X', kind: 'amenity=cafe' };
  const cases = [
    [maximal, 'none'], [maximal, 'site'], [{}, 'none'], [undefined, undefined], [base, 'dead'],
  ];
  for (const [place, st] of cases) {
    const { reasons } = leadScore(place, st);
    assert.ok(Array.isArray(reasons));
    assert.ok(reasons.length >= 1 && reasons.length <= 5, `count ${reasons.length}`);
    for (const r of reasons) {
      assert.equal(typeof r, 'string');
      assert.ok(r.trim().length > 0);
    }
  }
  assert.equal(leadScore(maximal, 'none').reasons[0], 'Нет сайта и соцсетей');
  assert.equal(leadScore(maximal, 'site').reasons[0], 'Есть свой сайт');
});

test('robust to missing or invalid input', () => {
  for (const place of [undefined, null, {}, 42, 'строка', []]) {
    const r = leadScore(place, undefined);
    assert.ok(Number.isInteger(r.score));
    assert.ok(['hot', 'warm', 'cold'].includes(r.level));
    assert.ok(Array.isArray(r.reasons));
  }
  assert.doesNotThrow(() => leadScore());
  assert.doesNotThrow(() => leadScore({ kind: 42, phone: null, social: 'x', brand: 5 }, 'none'));
});

test('derives status when siteStatus is missing', () => {
  assert.equal(leadScore({ website: 'https://example.ru' }).reasons[0], 'Есть свой сайт');
  assert.equal(leadScore({ social: ['https://vk.com/x'] }).reasons[0], 'Только соцсети, нет своего сайта');
  assert.equal(leadScore({}).reasons[0], 'Нет сайта и соцсетей');
});
