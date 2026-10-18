/** Monetary values in this module are integer minor units (paise/cents). */
export const CATEGORIES = Object.freeze([
  { id: 'groceries', label: 'Groceries', color: '#4C8B70' },
  { id: 'dining', label: 'Dining out', color: '#E4A05A' },
  { id: 'home', label: 'Home & bills', color: '#7788C3' },
  { id: 'transport', label: 'Transport', color: '#68A6B4' },
  { id: 'shopping', label: 'Shopping', color: '#C58C9C' },
  { id: 'entertainment', label: 'Entertainment', color: '#A48BC4' },
  { id: 'health', label: 'Health', color: '#91A869' },
  { id: 'other', label: 'Other', color: '#9C9B94' },
].map(Object.freeze));

export const CURRENCIES = Object.freeze([
  { code: 'INR', label: 'Indian rupee (INR)' },
  { code: 'USD', label: 'US dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British pound (GBP)' },
  { code: 'AED', label: 'UAE dirham (AED)' },
].map(Object.freeze));

const MAX_AMOUNT_MINOR = 999_999_999;
const MAX_MEMBERS = 50;
const MAX_EXPENSES = 10_000;
const categoryIds = new Set(CATEGORIES.map(({ id }) => id));
const currencyCodes = new Set(CURRENCIES.map(({ code }) => code));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertRecord(value, label, keys) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  assert(prototype === Object.prototype || prototype === null, `${label} must be a plain object.`);
  assert(keys.every((key) => hasOwn(value, key)), `${label} is missing a required field.`);
  assert(Object.keys(value).every((key) => keys.includes(key)), `${label} contains an unsupported field.`);
}

function assertText(value, label, maximum) {
  assert(typeof value === 'string' && value.trim().length > 0 && value.length <= maximum,
    `${label} must contain 1–${maximum} characters.`);
  assert(!/[\u0000-\u001f\u007f]/.test(value), `${label} contains an unsupported control character.`);
}

function assertId(value, label = 'ID') {
  assert(typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value),
    `${label} must contain 1–80 letters, numbers, hyphens, or underscores.`);
}

function assertAmount(value, label = 'Amount', allowZero = false) {
  assert(Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= MAX_AMOUNT_MINOR,
    `${label} must be ${allowZero ? 'zero or ' : ''}a positive integer in minor units, up to 999999999.`);
}

function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createEmptyState() {
  return { version: 1, groupName: 'Our household', currency: 'INR', members: [], expenses: [], isDemo: false };
}

/** A clearly flaggable demo: seven expenses in each of four calendar months. */
export function createSampleState(today = localToday()) {
  assert(isISODate(today), 'The sample date must be a real date in YYYY-MM-DD format.');
  const [year, month, day] = today.split('-').map(Number);
  assert(year >= 2, 'The sample date must be in year 0002 or later.');
  const members = [
    { id: 'maya', name: 'Maya', color: '#4C8B70' },
    { id: 'arjun', name: 'Arjun', color: '#C58C68' },
    { id: 'priya', name: 'Priya', color: '#8A84BA' },
  ];
  const all = members.map(({ id }) => id);
  const rows = [
    { description: 'Monthly rent', amount: 18_000, category: 'home', paidBy: 'maya', day: 1, split: all },
    { description: 'Weekly grocery run', amount: 2_480, category: 'groceries', paidBy: 'arjun', day: 4, split: all },
    { description: 'Internet bill', amount: 899, category: 'home', paidBy: 'priya', day: 6, split: all },
    { description: 'Dinner at the neighbourhood cafe', amount: 1_260, category: 'dining', paidBy: 'priya', day: 9, split: all },
    { description: 'Weekend cab rides', amount: 680, category: 'transport', paidBy: 'arjun', day: 12, split: ['arjun', 'priya'] },
    { description: 'Movie night', amount: 960, category: 'entertainment', paidBy: 'maya', day: 15, split: all },
    { description: 'Household essentials', amount: 1_450, category: 'shopping', paidBy: 'arjun', day: 18, split: all },
  ];
  const expenses = [];
  for (let offset = 0; offset < 4; offset += 1) {
    const index = year * 12 + month - 1 - offset;
    const rowYear = Math.floor(index / 12);
    const rowMonth = (index % 12) + 1;
    rows.forEach((row, rowIndex) => {
      const rowDay = offset === 0 ? Math.min(day, row.day) : row.day;
      const adjustment = rowIndex === 0 || rowIndex === 2 ? 0 : offset * (rowIndex + 1) * 37;
      expenses.push({
        id: `sample-${offset}-${rowIndex}`,
        description: row.description,
        amountMinor: (row.amount + adjustment) * 100,
        category: row.category,
        date: `${String(rowYear).padStart(4, '0')}-${String(rowMonth).padStart(2, '0')}-${String(rowDay).padStart(2, '0')}`,
        paidBy: row.paidBy,
        splitBetween: [...row.split],
      });
    });
  }
  return validateState({ ...createEmptyState(), members, expenses, isDemo: true });
}

/** Parse a user-entered decimal without binary floating-point multiplication. */
export function parseAmount(value) {
  assert(typeof value === 'string', 'Enter an amount such as 250 or 250.50.');
  const text = value.trim();
  assert(/^\d{1,8}(?:\.\d{1,2})?$/.test(text), 'Enter a positive amount with at most two decimal places, without commas.');
  const [whole, fraction = ''] = text.split('.');
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  assertAmount(amountMinor);
  return amountMinor;
}

/** Validate before accepting saved/imported data. This function never mutates it. */
export function validateState(state) {
  assertRecord(state, 'Backup', ['version', 'groupName', 'currency', 'members', 'expenses', 'isDemo']);
  assert(state.version === 1, 'This backup version is not supported.');
  assertText(state.groupName, 'Group name', 100);
  assert(currencyCodes.has(state.currency), 'Choose a supported currency: INR, USD, EUR, GBP, or AED.');
  assert(typeof state.isDemo === 'boolean', 'The sample-data flag must be true or false.');
  assert(Array.isArray(state.members) && state.members.length <= MAX_MEMBERS, 'A group can contain at most 50 members.');
  assert(Array.isArray(state.expenses) && state.expenses.length <= MAX_EXPENSES, 'A backup can contain at most 10,000 expenses.');

  const memberIds = new Set();
  const memberNames = new Set();
  state.members.forEach((member, index) => {
    const label = `Member ${index + 1}`;
    assertRecord(member, label, ['id', 'name', 'color']);
    assertId(member.id, `${label} ID`);
    assert(!memberIds.has(member.id), 'Member IDs must be unique.');
    assertText(member.name, `${label} name`, 60);
    const normalizedName = member.name.trim().toLocaleLowerCase('en');
    assert(!memberNames.has(normalizedName), 'Member names must be unique (ignoring case and surrounding spaces).');
    assert(typeof member.color === 'string' && /^#[\da-fA-F]{6}$/.test(member.color), `${label} color must be a six-digit hex color.`);
    memberIds.add(member.id);
    memberNames.add(normalizedName);
  });

  const expenseIds = new Set();
  state.expenses.forEach((expense, index) => {
    const label = `Expense ${index + 1}`;
    assertRecord(expense, label, ['id', 'description', 'amountMinor', 'category', 'date', 'paidBy', 'splitBetween']);
    assertId(expense.id, `${label} ID`);
    assert(!expenseIds.has(expense.id), 'Expense IDs must be unique.');
    expenseIds.add(expense.id);
    assertText(expense.description, `${label} description`, 240);
    assertAmount(expense.amountMinor, `${label} amount`);
    assert(categoryIds.has(expense.category), `${label} has an unknown category.`);
    assert(isISODate(expense.date), `${label} date must be a real date in YYYY-MM-DD format.`);
    assert(memberIds.has(expense.paidBy), `${label} payer does not belong to this group.`);
    assert(Array.isArray(expense.splitBetween) && expense.splitBetween.length > 0 && expense.splitBetween.length <= MAX_MEMBERS,
      `${label} must be shared with at least one group member.`);
    assert(new Set(expense.splitBetween).size === expense.splitBetween.length, `${label} contains a duplicate split member.`);
    assert(expense.splitBetween.every((id) => memberIds.has(id)), `${label} is shared with an unknown member.`);
  });
  return state;
}

/** Equal splits preserve the exact total. Earlier IDs receive remainder units. */
export function splitAmount(amountMinor, memberIds) {
  assertAmount(amountMinor, 'Split amount', true);
  assert(Array.isArray(memberIds) && memberIds.length > 0 && memberIds.length <= MAX_MEMBERS,
    'Choose between 1 and 50 members for a split.');
  memberIds.forEach((id) => assertId(id, 'Split member ID'));
  assert(new Set(memberIds).size === memberIds.length, 'Split members must be unique.');
  const each = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor % memberIds.length;
  return memberIds.map((memberId, index) => ({ memberId, amountMinor: each + (index < remainder ? 1 : 0) }));
}

/** A positive balance means the member is owed money; a negative one means they owe. */
export function calculateBalances(state, expenses = state.expenses) {
  const balances = new Map(state.members.map(({ id }) => [id, { memberId: id, paidMinor: 0, shareMinor: 0, balanceMinor: 0 }]));
  for (const expense of expenses) {
    assert(balances.has(expense.paidBy), 'An expense has an unknown payer.');
    balances.get(expense.paidBy).paidMinor += expense.amountMinor;
    for (const share of splitAmount(expense.amountMinor, expense.splitBetween)) {
      assert(balances.has(share.memberId), 'An expense is shared with an unknown member.');
      balances.get(share.memberId).shareMinor += share.amountMinor;
    }
  }
  return [...balances.values()].map((balance) => ({ ...balance, balanceMinor: balance.paidMinor - balance.shareMinor }));
}

/** Suggestions clear net balances; they do not record actual repayments. */
export function suggestSettlements(balances) {
  assert(Array.isArray(balances) && balances.length <= MAX_MEMBERS, 'Balances must be a list of up to 50 members.');
  const seen = new Set();
  let net = 0;
  for (const balance of balances) {
    assertId(balance.memberId, 'Balance member ID');
    assert(!seen.has(balance.memberId), 'Balance member IDs must be unique.');
    assert(Number.isSafeInteger(balance.balanceMinor), 'Balances must use integer minor units.');
    seen.add(balance.memberId);
    net += balance.balanceMinor;
    assert(Number.isSafeInteger(net), 'The balance total is too large.');
  }
  assert(net === 0, 'Balances must add up to zero before settlement.');
  const byAmount = (a, b) => b.amountMinor - a.amountMinor || a.memberId.localeCompare(b.memberId);
  const debtors = balances.filter((row) => row.balanceMinor < 0).map((row) => ({ memberId: row.memberId, amountMinor: -row.balanceMinor })).sort(byAmount);
  const creditors = balances.filter((row) => row.balanceMinor > 0).map((row) => ({ memberId: row.memberId, amountMinor: row.balanceMinor })).sort(byAmount);
  const result = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);
    result.push({ from: debtor.memberId, to: creditor.memberId, amountMinor });
    debtor.amountMinor -= amountMinor;
    creditor.amountMinor -= amountMinor;
    if (debtor.amountMinor === 0) debtorIndex += 1;
    if (creditor.amountMinor === 0) creditorIndex += 1;
  }
  return result;
}

/** Member filtering matches the payer; search also matches any participant name. */
export function filterExpenses(expenses, { search = '', category = 'all', member = 'all', from = '', to = '' } = {}, members = []) {
  const query = search.trim().toLocaleLowerCase('en');
  const memberNames = new Map(members.map(({ id, name }) => [id, name.toLocaleLowerCase('en')]));
  return expenses.filter((expense) => {
    if (category && category !== 'all' && expense.category !== category) return false;
    if (member && member !== 'all' && expense.paidBy !== member) return false;
    if (from && expense.date < from) return false;
    if (to && expense.date > to) return false;
    if (!query) return true;
    const people = [expense.paidBy, ...expense.splitBetween].map((id) => memberNames.get(id) || '').join(' ');
    return `${expense.description} ${people}`.toLocaleLowerCase('en').includes(query);
  });
}

/** Calendar-month buckets include empty months, ordered from oldest to newest. */
export function monthlyTotals(expenses, endingDate = localToday(), months = 6) {
  assert(isISODate(endingDate), 'The ending date must be a real date in YYYY-MM-DD format.');
  assert(Number.isInteger(months) && months >= 1 && months <= 120, 'Choose between 1 and 120 months.');
  const [year, month] = endingDate.split('-').map(Number);
  const lastIndex = year * 12 + month - 1;
  assert(lastIndex - months + 1 >= 12, 'The requested month range starts before year 0001.');
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const rows = Array.from({ length: months }, (_, offset) => {
    const index = lastIndex - months + 1 + offset;
    const rowYear = Math.floor(index / 12);
    const rowMonth = index % 12;
    return { key: `${String(rowYear).padStart(4, '0')}-${String(rowMonth + 1).padStart(2, '0')}`, label: labels[rowMonth], totalMinor: 0 };
  });
  const byMonth = new Map(rows.map((row) => [row.key, row]));
  for (const expense of expenses) {
    const row = byMonth.get(expense.date.slice(0, 7));
    if (row) row.totalMinor += expense.amountMinor;
  }
  return rows;
}
