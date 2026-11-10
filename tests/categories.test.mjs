import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, KINDS, classify, groupById } from '../js/categories.js';

const KEY_RE = /^(amenity|shop|tourism|leisure|craft|office|healthcare)=[a-z0-9_]+$/;
const groupIds = new Set(GROUPS.map((g) => g.id));

test('every KINDS group exists in GROUPS', () => {
  for (const [key, entry] of Object.entries(KINDS)) {
    assert.ok(groupIds.has(entry.group), `${key} has unknown group ${entry.group}`);
  }
});

test('every KINDS key matches the expected pattern', () => {
  for (const key of Object.keys(KINDS)) {
    assert.match(key, KEY_RE, `bad key: ${key}`);
  }
});

test('every KINDS entry has non-empty label and icon', () => {
  for (const [key, entry] of Object.entries(KINDS)) {
    assert.ok(typeof entry.label === 'string' && entry.label.trim() !== '', `${key} label`);
    assert.ok(typeof entry.icon === 'string' && entry.icon.trim() !== '', `${key} icon`);
  }
});

test('GROUPS ids are unique and the last group is other', () => {
  assert.equal(groupIds.size, GROUPS.length);
  assert.equal(GROUPS.at(-1).id, 'other');
  for (const g of GROUPS) {
    assert.ok(g.label && g.icon, `group ${g.id} needs label and icon`);
  }
});

test('fallback groups shops, craft, office exist', () => {
  for (const id of ['shops', 'craft', 'office', 'other']) {
    assert.ok(groupIds.has(id), `missing group ${id}`);
  }
});

test('KINDS has at least 180 kinds', () => {
  assert.ok(Object.keys(KINDS).length >= 180, `only ${Object.keys(KINDS).length}`);
});

test('classify returns the full shape for a known kind', () => {
  assert.deepEqual(classify('amenity=cafe'), {
    kind: 'amenity=cafe',
    label: 'Кафе',
    group: 'food',
    icon: '☕',
  });
});

test('classify falls back for unknown shop, craft and office values', () => {
  assert.deepEqual(classify('shop=definitely_unknown_xyz'), {
    kind: 'shop=definitely_unknown_xyz',
    label: 'Магазин',
    group: 'shops',
    icon: '🛍️',
  });
  assert.equal(classify('craft=unknown_thing').group, 'craft');
  assert.equal(classify('craft=unknown_thing').label, 'Мастерская');
  assert.equal(classify('office=unknown_thing').group, 'office');
  assert.equal(classify('office=unknown_thing').label, 'Офис');
});

test('classify does not throw and uses the other fallback for garbage', () => {
  for (const input of [undefined, null, '', 42, {}, 'garbage', 'amenity=', 'shop=', '=x']) {
    const result = classify(input);
    assert.equal(result.group, 'other', `input ${String(input)}`);
    assert.equal(result.label, 'Заведение');
    assert.equal(result.icon, '📍');
  }
});

test('classify does not resolve inherited object properties', () => {
  for (const input of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.equal(classify(input).group, 'other', input);
  }
});

test('groupById returns the matching group', () => {
  assert.equal(groupById('food').label, 'Еда и напитки');
});

test('groupById falls back to other for unknown or missing ids', () => {
  assert.equal(groupById('nope').id, 'other');
  assert.equal(groupById(undefined).id, 'other');
});
