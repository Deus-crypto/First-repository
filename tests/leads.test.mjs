import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUSES, createLeadStore, placesToCSV, buildPitch, downloadText } from '../js/leads.js';

const KEY = 'sitemap-leads-v1';

/** Фейковое хранилище поверх Map. */
function fakeStorage(map = new Map()) {
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
  };
}

test('get returns default record for unknown id', () => {
  const store = createLeadStore(fakeStorage());
  assert.deepEqual(store.get('x'), { status: 'none', note: '', updated: null });
});

test('set merges patch, sets updated and persists for another store', () => {
  const storage = fakeStorage();
  const s1 = createLeadStore(storage);
  s1.set('a', { status: 'planned' });
  s1.set('a', { note: 'позвонить' });
  const rec = s1.get('a');
  assert.equal(rec.status, 'planned');
  assert.equal(rec.note, 'позвонить');
  assert.equal(typeof rec.updated, 'string');
  assert.ok(!Number.isNaN(Date.parse(rec.updated)));

  const s2 = createLeadStore(storage);
  assert.deepEqual(s2.get('a'), rec);
  assert.ok(storage.map.has(KEY));
});

test('record is deleted when status is none and note is empty', () => {
  const storage = fakeStorage();
  const store = createLeadStore(storage);
  store.set('a', { status: 'planned' });
  assert.equal(store.count(), 1);
  store.set('a', { status: 'none', note: '   ' });
  assert.equal(store.count(), 0);
  assert.deepEqual(JSON.parse(storage.map.get(KEY)), {});
});

test('record is kept when status is none but note is not empty', () => {
  const store = createLeadStore(fakeStorage());
  store.set('a', { status: 'planned', note: 'x' });
  store.set('a', { status: 'none', note: 'осталась заметка' });
  assert.equal(store.count(), 1);
  assert.equal(store.get('a').status, 'none');
});

test('set throws TypeError for unknown status', () => {
  const store = createLeadStore(fakeStorage());
  assert.throws(() => store.set('a', { status: 'bogus' }), TypeError);
  assert.equal(store.count(), 0);
});

test('subscribe is called on change and unsubscribe stops it', () => {
  const store = createLeadStore(fakeStorage());
  let calls = 0;
  const unsubscribe = store.subscribe(() => {
    calls += 1;
  });
  store.set('a', { status: 'done' });
  assert.equal(calls, 1);
  unsubscribe();
  store.set('a', { status: 'rejected' });
  assert.equal(calls, 1);
});

test('corrupted storage JSON is treated as empty', () => {
  const map = new Map([[KEY, '{not json']]);
  const store = createLeadStore(fakeStorage(map));
  assert.equal(store.count(), 0);
  assert.deepEqual(store.all(), {});
  store.set('a', { status: 'planned' });
  assert.equal(store.get('a').status, 'planned');
});

test('storage.setItem throwing is ignored', () => {
  const storage = {
    getItem: () => null,
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  const store = createLeadStore(storage);
  assert.doesNotThrow(() => store.set('a', { status: 'planned' }));
});

test('countByStatus counts stored records only', () => {
  const store = createLeadStore(fakeStorage());
  store.set('a', { status: 'planned' });
  store.set('b', { status: 'planned' });
  store.set('c', { status: 'done' });
  store.set('d', { status: 'none', note: 'только заметка' });
  assert.deepEqual(store.countByStatus(), { planned: 2, done: 1, none: 1 });
});

test('export then import into a fresh store restores all leads', () => {
  const s1 = createLeadStore(fakeStorage());
  s1.set('a', { status: 'planned', note: 'первый' });
  s1.set('b', { status: 'done' });
  const text = s1.exportJSON();
  const parsed = JSON.parse(text);
  assert.equal(parsed.version, 1);
  assert.ok(!Number.isNaN(Date.parse(parsed.exported)));

  const s2 = createLeadStore(fakeStorage());
  assert.equal(s2.importJSON(text), 2);
  assert.deepEqual(s2.all(), s1.all());
});

test('import conflict: record with newer updated wins', () => {
  const store = createLeadStore(fakeStorage());
  store.set('a', { status: 'planned' });
  const local = store.get('a');

  const older = JSON.stringify({
    leads: { a: { status: 'done', note: 'старое', updated: '2000-01-01T00:00:00.000Z' } },
  });
  assert.equal(store.importJSON(older), 0);
  assert.equal(store.get('a').status, 'planned');
  assert.equal(store.get('a').updated, local.updated);

  const newer = JSON.stringify({
    leads: { a: { status: 'rejected', note: 'новое', updated: '2999-01-01T00:00:00.000Z' } },
  });
  assert.equal(store.importJSON(newer), 1);
  assert.deepEqual(store.get('a'), {
    status: 'rejected',
    note: 'новое',
    updated: '2999-01-01T00:00:00.000Z',
  });
});

test('import skips invalid records', () => {
  const store = createLeadStore(fakeStorage());
  const text = JSON.stringify({
    leads: {
      bad: { status: 'bogus', note: '', updated: '2024-01-01T00:00:00.000Z' },
      num: 5,
      arr: [1],
      ok: { status: 'done', note: '', updated: '2024-01-01T00:00:00.000Z' },
    },
  });
  assert.equal(store.importJSON(text), 1);
  assert.deepEqual(Object.keys(store.all()), ['ok']);
});

test('import of garbage throws Russian error', () => {
  const store = createLeadStore(fakeStorage());
  const msg = 'Файл не похож на экспорт лидов';
  assert.throws(() => store.importJSON('не json'), { message: msg });
  assert.throws(() => store.importJSON('{}'), { message: msg });
  assert.throws(() => store.importJSON('{"leads":[1]}'), { message: msg });
  assert.throws(() => store.importJSON('null'), { message: msg });
});

test('placesToCSV: BOM, header, CRLF and ";" separator', () => {
  const csv = placesToCSV([{ id: 'node/1', name: 'Кафе' }]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.endsWith('\r\n'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 3); // header, row, trailing empty
  assert.equal(
    lines[0],
    [
      'Название', 'Категория', 'Сайт (статус)', 'Сайт', 'Соцсети', 'Телефон', 'Email',
      'Адрес', 'Часы работы', 'Сеть', 'Статус лида', 'Заметка', 'Широта', 'Долгота',
      'Яндекс Карты', 'OSM ID',
    ]
      .map((h) => `"${h}"`)
      .join(';'),
  );
});

test('placesToCSV: quoting of quotes and semicolons', () => {
  const csv = placesToCSV([
    { id: 'node/1', name: 'Кофейня "Уют"', address: 'ул. Ленина; 1' },
  ]);
  assert.ok(csv.includes('"Кофейня ""Уют"""'));
  assert.ok(csv.includes('"ул. Ленина; 1"'));
});

test('placesToCSV: formula injection is neutralised, phone is kept as text', () => {
  const csv = placesToCSV([
    { id: 'node/1', name: 'Кафе', email: '=CMD()', phone: '+7 900 123-45-67', hours: '  -@x' },
  ]);
  assert.ok(csv.includes(`"'=CMD()"`));
  assert.ok(csv.includes(`"'+7 900 123-45-67"`));
  assert.ok(csv.includes(`"'  -@x"`));
});

test('placesToCSV: social links joined with ", "', () => {
  const csv = placesToCSV([
    { id: 'node/1', social: ['https://vk.com/x', 'https://instagram.com/y'] },
  ]);
  assert.ok(csv.includes('"https://vk.com/x, https://instagram.com/y"'));
});

test('placesToCSV: coordinates, yandex link, osm id, and lead columns when store given', () => {
  const store = createLeadStore(fakeStorage());
  store.set('node/1', { status: 'planned', note: 'позвонить' });
  const place = { id: 'node/1', name: 'Кафе', lat: 55.75, lon: -37.61 };

  const withStore = placesToCSV([place], store);
  assert.ok(withStore.includes('"55.75"'));
  assert.ok(withStore.includes('"-37.61"'), 'negative longitude must not be prefixed');
  assert.ok(withStore.includes('"https://yandex.ru/maps/?pt=-37.61,55.75&z=18&l=map"'));
  assert.ok(withStore.includes('"node/1"'));
  assert.ok(withStore.includes('"В планах";"позвонить"'));

  const withoutStore = placesToCSV([place]);
  assert.ok(!withoutStore.includes('В планах'));
  assert.ok(withoutStore.includes(';"";"";'));
});

test('placesToCSV tolerates empty input and missing fields', () => {
  assert.equal(placesToCSV([]).split('\r\n').length, 2);
  assert.doesNotThrow(() => placesToCSV([{}]));
});

const STATUS_IDS = ['none', 'social', 'dead', 'site'];

for (const siteStatus of STATUS_IDS) {
  test(`buildPitch(${siteStatus}) has name, 3 bullets and valid length`, () => {
    const place = { name: 'Кофейня Уют', categoryLabel: 'Кафе', siteStatus };
    const text = buildPitch(place);
    assert.ok(text.includes('Кофейня Уют'));
    const bullets = text.split('\n').filter((l) => l.startsWith('• '));
    assert.equal(bullets.length, 3);
    assert.ok(text.length >= 500 && text.length <= 900, `length ${text.length}`);

    const withOpts = buildPitch(place, { author: 'Иван Петров', contact: '@ivan, +7 900 000-00-00' });
    assert.ok(withOpts.includes('Иван Петров'));
    assert.ok(withOpts.length >= 500 && withOpts.length <= 900, `length ${withOpts.length}`);
    assert.equal(withOpts.split('\n').filter((l) => l.startsWith('• ')).length, 3);
  });
}

test('buildPitch texts differ by siteStatus', () => {
  const texts = new Set(
    STATUS_IDS.map((siteStatus) => buildPitch({ name: 'Кафе', siteStatus })),
  );
  assert.equal(texts.size, 4);
});

test('buildPitch falls back to "ваше заведение" without a name', () => {
  const text = buildPitch({ siteStatus: 'none' });
  assert.ok(text.includes('ваше заведение'));
  assert.ok(text.length >= 500 && text.length <= 900, `length ${text.length}`);
});

test('downloadText returns false in Node', () => {
  assert.equal(downloadText('a.txt', 'text'), false);
});

test('STATUSES ids are unique and cover the spec', () => {
  assert.deepEqual(
    STATUSES.map((s) => s.id),
    ['none', 'planned', 'contacted', 'negotiation', 'in_progress', 'done', 'rejected'],
  );
});
