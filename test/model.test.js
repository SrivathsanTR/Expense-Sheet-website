import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES, CURRENCIES, createEmptyState, createSampleState, parseAmount,
  validateState, splitAmount, calculateBalances, suggestSettlements, filterExpenses, monthlyTotals,
} from '../src/model.js';

function fixture() {
  return {
    ...createEmptyState(),
    members: [
      { id: 'a', name: 'Anya', color: '#123456' },
      { id: 'b', name: 'Ben', color: '#ABCDEF' },
      { id: 'c', name: 'Chen', color: '#789abc' },
    ],
    expenses: [
      { id: 'e1', description: 'Vegetables', amountMinor: 100, category: 'groceries', date: '2024-02-29', paidBy: 'a', splitBetween: ['a', 'b', 'c'] },
      { id: 'e2', description: 'Train tickets', amountMinor: 250, category: 'transport', date: '2024-03-01', paidBy: 'b', splitBetween: ['a', 'c'] },
      { id: 'e3', description: 'Dinner', amountMinor: 99, category: 'dining', date: '2024-03-31', paidBy: 'c', splitBetween: ['b', 'c'] },
    ],
  };
}

test('empty state is independent, valid, and contains no assumed household members', () => {
  const one = createEmptyState();
  const two = createEmptyState();
  assert.equal(validateState(one), one);
  assert.equal(one.currency, 'INR');
  assert.equal(one.isDemo, false);
  assert.deepEqual(one.members, []);
  one.members.push('changed');
  assert.deepEqual(two.members, []);
  assert.equal(CATEGORIES.length, 8);
  assert.deepEqual(CURRENCIES.map((row) => row.code), ['INR', 'USD', 'EUR', 'GBP', 'AED']);
});

test('decimal parsing is exact and rejects ambiguous or invalid monetary input', () => {
  for (const [input, expected] of [['0.01', 1], ['0.29', 29], ['12.3', 1230], [' 250 ', 25000], ['9999999.99', 999999999]]) {
    assert.equal(parseAmount(input), expected);
  }
  for (const input of ['0', '-1', '+1', '1e2', '1,000', '1.001', '', '.', '1.', 'Infinity', '10000000', '100000000000000000', 25, null]) {
    assert.throws(() => parseAmount(input), Error, `Expected ${String(input)} to fail`);
  }
});

test('equal splits conserve every minor unit, stay within one unit, and keep order', () => {
  assert.deepEqual(splitAmount(100, ['b', 'a', 'c']), [
    { memberId: 'b', amountMinor: 34 }, { memberId: 'a', amountMinor: 33 }, { memberId: 'c', amountMinor: 33 },
  ]);
  for (let count = 1; count <= 50; count += 1) {
    const ids = Array.from({ length: count }, (_, index) => `m${index}`);
    for (const total of [0, 1, 2, 99, 100, 101, 999999999]) {
      const splits = splitAmount(total, ids);
      assert.equal(splits.reduce((sum, row) => sum + row.amountMinor, 0), total);
      assert.ok(Math.max(...splits.map((row) => row.amountMinor)) - Math.min(...splits.map((row) => row.amountMinor)) <= 1);
      assert.deepEqual(splits.map((row) => row.memberId), ids);
    }
  }
  assert.throws(() => splitAmount(100, []));
  assert.throws(() => splitAmount(100, ['a', 'a']));
  assert.throws(() => splitAmount(1.5, ['a']));
});

test('balances account for unequal membership in splits, including payers outside the split', () => {
  const state = fixture();
  assert.deepEqual(calculateBalances(state), [
    { memberId: 'a', paidMinor: 100, shareMinor: 159, balanceMinor: -59 },
    { memberId: 'b', paidMinor: 250, shareMinor: 83, balanceMinor: 167 },
    { memberId: 'c', paidMinor: 99, shareMinor: 207, balanceMinor: -108 },
  ]);
  const rows = calculateBalances(state);
  assert.equal(rows.reduce((sum, row) => sum + row.balanceMinor, 0), 0);
  assert.equal(rows.reduce((sum, row) => sum + row.shareMinor, 0), 449);
  assert.equal(rows.reduce((sum, row) => sum + row.paidMinor, 0), 449);
  assert.equal(calculateBalances(state, []).every((row) => row.balanceMinor === 0), true);
  assert.deepEqual(calculateBalances(createEmptyState()), []);
});

test('suggested transfers exactly settle balances without mutating them', () => {
  for (const state of [fixture(), createSampleState('2026-01-02')]) {
    const balances = calculateBalances(state);
    const before = structuredClone(balances);
    const remaining = new Map(balances.map((row) => [row.memberId, row.balanceMinor]));
    for (const transfer of suggestSettlements(balances)) {
      assert.ok(transfer.amountMinor > 0 && Number.isSafeInteger(transfer.amountMinor));
      assert.notEqual(transfer.from, transfer.to);
      remaining.set(transfer.from, remaining.get(transfer.from) + transfer.amountMinor);
      remaining.set(transfer.to, remaining.get(transfer.to) - transfer.amountMinor);
    }
    assert.ok([...remaining.values()].every((amount) => amount === 0));
    assert.deepEqual(balances, before);
  }
  assert.deepEqual(suggestSettlements([]), []);
  assert.throws(() => suggestSettlements([{ memberId: 'a', balanceMinor: 1 }]), /zero/);
  assert.throws(() => suggestSettlements([{ memberId: 'a', balanceMinor: 1.2 }]), /integer/);
});

test('filtering combines inclusive dates, category, payer, and case-insensitive participant search', () => {
  const { expenses, members } = fixture();
  assert.deepEqual(filterExpenses(expenses, { from: '2024-03-01', to: '2024-03-31' }).map((row) => row.id), ['e2', 'e3']);
  assert.deepEqual(filterExpenses(expenses, { search: '  VEGEtables  ' }, members).map((row) => row.id), ['e1']);
  assert.deepEqual(filterExpenses(expenses, { search: 'ANYA' }, members).map((row) => row.id), ['e1', 'e2']);
  assert.deepEqual(filterExpenses(expenses, { category: 'transport', member: 'b', search: 'chen', from: '2024-03-01', to: '2024-03-01' }, members).map((row) => row.id), ['e2']);
  assert.deepEqual(filterExpenses(expenses, { member: 'a' }).map((row) => row.id), ['e1']);
  assert.deepEqual(filterExpenses(expenses, { from: '2024-04-01', to: '2024-03-01' }), []);
  assert.deepEqual(filterExpenses(expenses, { category: 'all', member: 'all' }), expenses);
  assert.notEqual(filterExpenses(expenses), expenses);
});

test('monthly buckets include zero months and correctly cross the year boundary', () => {
  const expenses = [...fixture().expenses,
    { ...fixture().expenses[0], id: 'old', date: '2023-12-30', amountMinor: 72 },
    { ...fixture().expenses[0], id: 'future', date: '2024-04-01', amountMinor: 999 },
  ];
  assert.deepEqual(monthlyTotals(expenses, '2024-03-15', 4), [
    { key: '2023-12', label: 'Dec', totalMinor: 72 },
    { key: '2024-01', label: 'Jan', totalMinor: 0 },
    { key: '2024-02', label: 'Feb', totalMinor: 100 },
    { key: '2024-03', label: 'Mar', totalMinor: 349 },
  ]);
  assert.throws(() => monthlyTotals([], '2024-02-30'));
  assert.throws(() => monthlyTotals([], '2024-03-01', 0));
});

test('sample data is labelled, valid, dynamic, and never future-dated', () => {
  for (const today of ['2026-01-01', '2024-02-29', '2026-10-18']) {
    const state = createSampleState(today);
    assert.equal(validateState(state), state);
    assert.equal(state.isDemo, true);
    assert.equal(state.expenses.length, 28);
    assert.deepEqual(state.members.map(({ name }) => name), ['Maya', 'Arjun', 'Priya']);
    assert.equal(new Set(state.expenses.map((row) => row.date.slice(0, 7))).size, 4);
    assert.ok(state.expenses.every((row) => row.date <= today));
    assert.equal(calculateBalances(state).reduce((sum, row) => sum + row.balanceMinor, 0), 0);
  }
});

test('validation accepts real leap dates and rejects invalid dates, references, and identifiers', () => {
  assert.equal(validateState(fixture()).expenses[0].date, '2024-02-29');
  const cases = [
    [(state) => { state.expenses[0].date = '2023-02-29'; }, /real date/],
    [(state) => { state.expenses[0].date = '1900-02-29'; }, /real date/],
    [(state) => { state.expenses[0].date = '2024-04-31'; }, /real date/],
    [(state) => { state.expenses[0].date = '2024-2-01'; }, /real date/],
    [(state) => { state.expenses[0].date = '0000-01-01'; }, /real date/],
    [(state) => { state.members[1].id = 'a'; }, /unique/],
    [(state) => { state.members[1].name = ' ANYA '; }, /unique/],
    [(state) => { state.expenses[1].id = 'e1'; }, /unique/],
    [(state) => { state.expenses[0].paidBy = 'missing'; }, /payer/],
    [(state) => { state.expenses[0].splitBetween = ['missing']; }, /unknown member/],
    [(state) => { state.expenses[0].splitBetween = ['a', 'a']; }, /duplicate/],
    [(state) => { state.expenses[0].splitBetween = []; }, /at least one/],
    [(state) => { state.expenses[0].amountMinor = 10.5; }, /integer/],
    [(state) => { state.expenses[0].amountMinor = 0; }, /positive/],
    [(state) => { state.expenses[0].amountMinor = 1_000_000_000; }, /up to/],
    [(state) => { state.expenses[0].category = 'unknown'; }, /category/],
    [(state) => { state.currency = 'XXX'; }, /currency/],
    [(state) => { state.version = 2; }, /version/],
    [(state) => { state.isDemo = 'false'; }, /flag/],
    [(state) => { state.members[0].color = 'red'; }, /hex/],
    [(state) => { state.members[0].id = 'a b'; }, /ID/],
  ];
  for (const [mutate, message] of cases) {
    const state = fixture();
    mutate(state);
    assert.throws(() => validateState(state), message);
  }
  const millennium = fixture();
  millennium.expenses[0].date = '2000-02-29';
  assert.doesNotThrow(() => validateState(millennium));
});

test('validation rejects untrusted shapes, oversized fields, control characters, and prototype fields', () => {
  for (const state of [null, [], {}, 'hello', { ...fixture(), members: null }, { ...fixture(), expenses: {} }]) {
    assert.throws(() => validateState(state), Error);
  }
  const mutations = [
    (state) => { state.groupName = ' '; },
    (state) => { state.groupName = 'x'.repeat(101); },
    (state) => { state.expenses[0].description = 'x'.repeat(241); },
    (state) => { state.members[0].name = 'Hidden\u0000Name'; },
    (state) => { state.members = Array(51).fill(state.members[0]); },
    (state) => { state.expenses = Array(10_001).fill(state.expenses[0]); },
    (state) => { delete state.expenses[0].date; },
    (state) => { state.extra = true; },
    (state) => { state.members[0].color = '#123456;position:fixed'; },
    (state) => { Object.setPrototypeOf(state, { polluted: true }); },
  ];
  for (const mutate of mutations) {
    const state = fixture();
    mutate(state);
    assert.throws(() => validateState(state));
  }
  const unsafe = JSON.parse(JSON.stringify(fixture()).replace('"version":1', '"version":1,"__proto__":{"polluted":true}'));
  assert.throws(() => validateState(unsafe), /unsupported/);
  assert.equal({}.polluted, undefined);
});

test('validated input round-trips through a JSON backup without mutation', () => {
  const source = createSampleState('2026-10-18');
  const original = JSON.stringify(source);
  const restored = JSON.parse(original);
  assert.equal(validateState(restored), restored);
  assert.equal(JSON.stringify(restored), original);
  assert.deepEqual(calculateBalances(restored), calculateBalances(source));
});
