import { CATEGORIES, CURRENCIES, createEmptyState, createSampleState, parseAmount, validateState, calculateBalances, suggestSettlements, filterExpenses, monthlyTotals } from './model.js';

const STORAGE_KEY = 'together-expenses.v1';
const $ = (selector, root = document) => root.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = () => crypto.randomUUID();
const paths = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  expenses: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
  members: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="17" r="3" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5"/>',
  upload: '<path d="M12 16V3m-4 4 4-4 4 4M5 16v5h14v-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  wallet: '<path d="M20 8H5a2 2 0 0 1 0-4h13v4M3 6v12a2 2 0 0 0 2 2h15V8M20 12h-6v4h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/>',
  chart: '<path d="M4 3v18h17M8 16v-5M13 16V7M18 16V4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  groceries: '<path d="M3 3h2l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  dining: '<path d="M5 3v7m3-7v7M2 3v7h6M5 10v11M16 3v18M16 3c6 3 6 9 0 9"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
  transport: '<rect x="4" y="5" width="16" height="13" rx="3"/><path d="M4 11h16M7 18v3M17 18v3M8 14h.01M16 14h.01"/>',
  shopping: '<path d="M4 7h16l-1 14H5L4 7ZM8 7V5a4 4 0 0 1 8 0v2"/>',
  entertainment: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="m10 9 5 3.5-5 3.5V9Z"/>',
  health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  other: '<circle cx="12" cy="12" r="9"/><path d="M7 12h.01M12 12h.01M17 12h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.other}</svg>`;
const category = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
let state, loadError = '', lastStored = null, view = 'overview', period = 'all', page = 1;
let filters = { search: '', category: 'all', member: 'all', from: '', to: '', sort: 'newest' };
try {
  lastStored = localStorage.getItem(STORAGE_KEY);
  state = lastStored ? validateState(JSON.parse(lastStored)) : createSampleState(today());
  if (!lastStored) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); lastStored = JSON.stringify(state); }
} catch (error) {
  state ||= createEmptyState();
  loadError = `Your browser data could not be opened or saved. ${error.message} Export a recovery copy or import a valid backup in Settings. Your existing data has not been overwritten.`;
}
const money = (minor, compact = false) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: state.currency, maximumFractionDigits: compact ? 1 : 2, minimumFractionDigits: compact ? 0 : 2, ...(compact ? { notation: 'compact' } : {}) }).format(minor / 100);
const dateLabel = (iso) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));
const member = (id) => state.members.find(m => m.id === id);
const initials = (name) => name.trim().split(/\s+/).map(p => Array.from(p)[0]).slice(0, 2).join('').toUpperCase();
const avatar = (m) => `<span class="avatar" style="--avatar-color:${escape(m.color)}" aria-hidden="true">${escape(initials(m.name))}</span>`;
function toast(message) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = message;
  $('#toast-container').replaceChildren(el); setTimeout(() => el.remove(), 5000);
}
function commit(next, { recovery = false } = {}) {
  if (loadError && !recovery) throw new Error('Resolve the storage problem in Settings before making changes.');
  validateState(next);
  const current = localStorage.getItem(STORAGE_KEY);
  if (!recovery && current !== lastStored) throw new Error('This workspace changed in another tab. Reload before saving your changes.');
  const serialized = JSON.stringify(next);
  try { localStorage.setItem(STORAGE_KEY, serialized); }
  catch { throw new Error('The browser could not save this change. Free some storage or allow site storage, then try again.'); }
  lastStored = serialized; state = next; loadError = ''; render();
}
function getPeriodExpenses() {
  if (period === 'all') return state.expenses;
  const now = new Date(`${today()}T12:00:00`);
  if (period === 'last') now.setMonth(now.getMonth() - 1, 1);
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return state.expenses.filter(e => e.date.startsWith(key));
}
function render() {
  const titles = { overview: ['Household overview', 'A clear picture of what you spend, together.'], expenses: ['Every expense, in one place', 'The little things. The big things. All accounted for.'], members: ['Your people', 'Shared costs, clear balances. Keep everyone in the picture.'], settings: ['Make it yours', 'Your household, your currency, your data.'] };
  $('#app').innerHTML = `<div class="app-shell">
    <aside class="sidebar" aria-label="Main navigation">
      <a class="brand" href="#overview" aria-label="Together home"><span class="logo-mark"><svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M8 12h20M13 6v23M23 12v17" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg></span><span class="wordmark">together<span>.</span></span></a>
      <div class="group-card"><span class="group-card-icon">${icon('home')}</span><div><strong>${escape(state.groupName)}</strong><span>${state.members.length} member${state.members.length === 1 ? '' : 's'} · ${state.currency}</span></div></div>
      <p class="nav-label">WORKSPACE</p><nav>${['overview', 'expenses', 'members', 'settings'].map(key => `<button class="nav-link ${view === key ? 'active' : ''}" data-view="${key}" ${view === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${key[0].toUpperCase() + key.slice(1)}</span>${key === 'expenses' ? `<span class="nav-count">${state.expenses.length}</span>` : ''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="storage-note">${icon('lock')}<strong>Stored on this browser</strong><p>Your household data stays here.<br>Back it up to keep it safe.</p><button class="text-button" data-action="backup">Download backup ${icon('arrow')}</button></div><span class="sidebar-credit">Small expenses. Shared understanding.</span></div>
    </aside>
    <main id="main" class="main-content" tabindex="-1">
      <header class="page-header"><div class="header-copy"><p class="eyebrow">YOUR SHARED SPACE <span> / </span> ${view.toUpperCase()}</p><h1>${titles[view][0]}</h1><p class="subtitle">${titles[view][1]}</p></div><div class="header-actions"><div class="member-avatars" aria-label="${state.members.length} household members">${state.members.slice(0, 3).map(avatar).join('')}</div><button class="btn btn-primary" data-action="add-expense">${icon('plus')} Add expense</button></div></header>
      ${loadError ? `<div class="error-banner" role="alert">${escape(loadError)} <button class="text-button" data-view="settings">Open Settings</button></div>` : ''}
      ${state.isDemo ? `<div class="demo-banner"><span class="demo-copy"><span class="sample-badge">SAMPLE DATA</span> Explore a sample household. Start fresh when you’re ready.</span><button class="text-button" data-action="fresh">Start fresh ${icon('arrow')}</button></div>` : ''}
      <section id="view-content" aria-label="${view}">${view === 'overview' ? overviewMarkup() : view === 'expenses' ? expensesMarkup() : view === 'members' ? membersMarkup() : settingsMarkup()}</section>
      <footer class="footer-note"><span><span class="status-dot"></span>${loadError ? 'Storage needs attention' : 'Saved in this browser'} · No cloud sync</span><span>Made for the way you share.</span></footer>
    </main></div>`;
  if (view === 'expenses') updateExpenseList();
}
function stat(label, value, foot, name, accent = false) {
  return `<article class="stat-card ${accent ? 'accent' : ''}"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon">${icon(name)}</span></div><strong class="stat-value">${value}</strong><span class="stat-foot">${foot}</span></article>`;
}
function overviewMarkup() {
  const expenses = getPeriodExpenses();
  const total = expenses.reduce((sum, e) => sum + e.amountMinor, 0);
  const month = state.expenses.filter(e => e.date.startsWith(today().slice(0, 7)));
  const monthTotal = month.reduce((sum, e) => sum + e.amountMinor, 0);
  const rows = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return `<div class="section-heading"><h2>The big picture <span class="muted">/ ${period === 'all' ? 'All time' : period === 'month' ? 'This month' : 'Last month'}</span></h2><label class="period-control">${icon('calendar')}<select id="period" aria-label="Overview period"><option value="all" ${period === 'all' ? 'selected' : ''}>All time</option><option value="month" ${period === 'month' ? 'selected' : ''}>This month</option><option value="last" ${period === 'last' ? 'selected' : ''}>Last month</option></select></label></div>
    <div class="stat-grid">${stat('Total spent', money(total), `${expenses.length} expenses in this period`, 'wallet', true)}${stat('This month', money(monthTotal), `${month.length} expenses in ${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date())}`, 'calendar')}${stat('Average expense', money(expenses.length ? Math.round(total / expenses.length) : 0), 'Per expense in this period', 'chart')}${stat('Household members', state.members.length, 'Sharing the everyday', 'members')}</div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Spending over time</h2><p class="panel-subtitle">All expenses · last 6 months</p></div><span class="chart-legend"><i class="legend-dot"></i>Total spent</span></div>${trendMarkup()}</section><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Where it goes</h2><p class="panel-subtitle">Spending by category · selected period</p></div>${icon('chart')}</div>${categoryMarkup(expenses)}</section></div>
    <div class="bottom-grid"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Recent expenses</h2><p class="panel-subtitle">Your latest shared moments · selected period</p></div><button class="text-button" data-view="expenses">View all ${icon('arrow')}</button></div>${rows.length ? expenseTable(rows, true) : emptyMarkup('A fresh page', 'Add an expense and start making sense of your shared spending.', 'add-expense', 'Add your first expense')}</section><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Who’s paid what</h2><p class="panel-subtitle">All-time household balances</p></div><button class="icon-button" data-view="members" aria-label="View member balances">${icon('arrow')}</button></div>${balanceMarkup()}<div class="panel-bottom-note">Positive balances should receive; negative balances owe.</div></section></div>`;
}
function trendMarkup() {
  const series = monthlyTotals(state.expenses, today(), 6);
  const max = Math.max(...series.map(x => x.totalMinor), 10000);
  const top = Math.ceil(max / 10000) * 10000;
  const width = 620, height = 230, left = 72, bottom = 195, chartHeight = 158;
  const grid = [0, .25, .5, .75, 1].map(p => `<line x1="${left}" x2="610" y1="${bottom - p * chartHeight}" y2="${bottom - p * chartHeight}" stroke="#e8eeea" stroke-dasharray="4 5"/><text x="${left - 12}" y="${bottom - p * chartHeight + 4}" text-anchor="end" fill="#7d8982" font-size="11">${escape(money(Math.round(top * p), true))}</text>`).join('');
  const bars = series.map((item, i) => { const h = item.totalMinor / top * chartHeight, x = left + 28 + i * 87; return `<g><rect x="${x}" y="${bottom - h}" width="39" height="${h}" rx="5" fill="${i === series.length - 1 ? '#185c43' : '#b7d5b8'}"><title>${escape(item.label)}: ${escape(money(item.totalMinor))}</title></rect><text x="${x + 19.5}" y="220" text-anchor="middle" fill="${i === series.length - 1 ? '#185c43' : '#7d8982'}" font-size="12">${escape(item.label)}</text></g>`; }).join('');
  return `<div class="chart-wrap"><svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly expense totals: ${escape(series.map(x => `${x.label} ${money(x.totalMinor)}`).join(', '))}">${grid}${bars}</svg></div><details class="chart-details"><summary>View monthly amounts</summary><div class="chart-data">${series.map(x => `<span>${escape(x.label)} <strong>${money(x.totalMinor)}</strong></span>`).join('')}</div></details>`;
}
function categoryMarkup(expenses) {
  const total = expenses.reduce((s, e) => s + e.amountMinor, 0);
  if (!total) return emptyMarkup('Nothing here yet', 'Your category breakdown will appear after the first expense.');
  const amounts = CATEGORIES.map(c => ({ ...c, amount: expenses.filter(e => e.category === c.id).reduce((s, e) => s + e.amountMinor, 0) })).filter(c => c.amount).sort((a, b) => b.amount - a.amount);
  let offset = 0;
  const segments = amounts.map(c => { const length = c.amount / total * 100; const circle = `<circle cx="70" cy="70" r="55" fill="none" stroke="${c.color}" stroke-width="17" pathLength="100" stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"><title>${escape(c.label)} ${money(c.amount)}</title></circle>`; offset += length; return circle; }).join('');
  return `<div class="category-layout"><div class="donut-wrap"><svg class="donut-chart" viewBox="0 0 140 140" role="img" aria-label="Expense category distribution">${segments}</svg><div class="donut-center"><strong>${amounts.length}</strong><span>categories</span></div></div><div class="category-list">${amounts.map(c => `<div class="category-row"><span class="category-dot" style="background:${c.color}"></span><span class="category-name">${c.label}</span><strong class="category-amount">${money(c.amount)}</strong><span class="category-share">${Math.round(c.amount / total * 100)}%</span></div>`).join('')}</div></div>`;
}
function expenseTable(expenses, compact = false) {
  return `<div class="table-wrap"><table class="expense-table"><thead><tr><th scope="col">Expense</th>${compact ? '' : '<th scope="col">Date</th>'}<th scope="col">Paid by</th>${compact ? '' : '<th scope="col">Category</th>'}<th scope="col" class="amount">Amount</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${expenses.map(e => { const c = category(e.category), m = member(e.paidBy); return `<tr><td><div class="description-cell"><span class="category-icon" style="--category-color:${c.color}">${icon(c.id)}</span><div><strong class="expense-description">${escape(e.description)}</strong><span class="expense-meta">${compact ? dateLabel(e.date) + ' · ' : ''}Split ${e.splitBetween.length} way${e.splitBetween.length === 1 ? '' : 's'}</span></div></div></td>${compact ? '' : `<td class="date-cell">${dateLabel(e.date)}</td>`}<td><span class="member-chip">${avatar(m)}<span>${escape(m.name)}</span></span></td>${compact ? '' : `<td><span class="category-tag">${c.label}</span></td>`}<td class="amount">${money(e.amountMinor)}</td><td><div class="row-actions"><button class="icon-button" data-action="edit-expense" data-id="${escape(e.id)}" aria-label="Edit ${escape(e.description)}">${icon('edit')}</button><button class="icon-button danger-hover" data-action="delete-expense" data-id="${escape(e.id)}" aria-label="Delete ${escape(e.description)}">${icon('trash')}</button></div></td></tr>`; }).join('')}</tbody></table></div>`;
}
function balanceMarkup() {
  if (!state.members.length) return emptyMarkup('Better together', 'Add the people you share expenses with.', 'add-member', 'Add a member');
  return `<div class="balances-list">${calculateBalances(state).map(b => { const m = member(b.memberId); return `<div class="balance-row">${avatar(m)}<div class="balance-info"><strong class="balance-name">${escape(m.name)}</strong><span class="balance-caption">Paid ${money(b.paidMinor)}</span></div><div class="balance-number ${b.balanceMinor > 0 ? 'positive' : b.balanceMinor < 0 ? 'negative' : ''}"><strong>${money(Math.abs(b.balanceMinor))}</strong><span>${b.balanceMinor > 0 ? 'should receive' : b.balanceMinor < 0 ? 'owes' : 'all balanced'}</span></div></div>`; }).join('')}</div>`;
}
function emptyMarkup(title, description, action, label) {
  return `<div class="empty-state"><span class="empty-icon">${icon('wallet')}</span><h3>${title}</h3><p>${description}</p>${action ? `<button class="btn btn-secondary btn-small" data-action="${action}">${icon('plus')} ${label}</button>` : ''}</div>`;
}
function expensesMarkup() {
  return `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Expense ledger</h2><p class="panel-subtitle">Search, filter, and keep the details tidy.</p></div><button class="btn btn-secondary btn-small" data-action="csv">${icon('download')} Export CSV</button></div>
    <div class="filter-bar"><label class="search-field">${icon('search')}<input type="search" id="search" placeholder="Search expenses or people…" aria-label="Search expenses or people" value="${escape(filters.search)}"></label><label class="filter-field"><span>Category</span><select id="filter-category"><option value="all">All categories</option>${CATEGORIES.map(c => `<option value="${c.id}" ${filters.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label><label class="filter-field"><span>Paid by</span><select id="filter-member"><option value="all">Anyone</option>${state.members.map(m => `<option value="${escape(m.id)}" ${filters.member === m.id ? 'selected' : ''}>${escape(m.name)}</option>`).join('')}</select></label></div>
    <div class="filter-bar secondary-filters"><label class="filter-field"><span>From</span><input type="date" id="filter-from" value="${filters.from}"></label><label class="filter-field"><span>To</span><input type="date" id="filter-to" value="${filters.to}"></label><label class="filter-field"><span>Sort</span><select id="filter-sort"><option value="newest" ${filters.sort === 'newest' ? 'selected' : ''}>Newest first</option><option value="oldest" ${filters.sort === 'oldest' ? 'selected' : ''}>Oldest first</option><option value="highest" ${filters.sort === 'highest' ? 'selected' : ''}>Highest amount</option><option value="lowest" ${filters.sort === 'lowest' ? 'selected' : ''}>Lowest amount</option></select></label><button class="text-button" data-action="clear-filters">Reset filters</button></div><div id="expense-results" aria-live="polite"></div></section>`;
}
function filtered() {
  const result = filterExpenses(state.expenses, filters, state.members);
  return result.sort((a, b) => filters.sort === 'oldest' ? a.date.localeCompare(b.date) : filters.sort === 'highest' ? b.amountMinor - a.amountMinor : filters.sort === 'lowest' ? a.amountMinor - b.amountMinor : b.date.localeCompare(a.date));
}
function updateExpenseList() {
  const root = $('#expense-results'); if (!root) return;
  if (filters.from && filters.to && filters.from > filters.to) { root.innerHTML = '<div class="field-error" role="alert">The start date must be on or before the end date.</div>'; return; }
  const rows = filtered(), pages = Math.max(1, Math.ceil(rows.length / 10)); page = Math.min(page, pages);
  root.innerHTML = `<div class="results-summary"><span>${rows.length} expense${rows.length === 1 ? '' : 's'} found</span><strong>${money(rows.reduce((s, e) => s + e.amountMinor, 0))} <span class="muted">total</span></strong></div>${rows.length ? expenseTable(rows.slice((page - 1) * 10, page * 10)) : emptyMarkup('No expenses found', state.expenses.length ? 'Try another search or reset the filters.' : 'Add your first shared expense to get started.', state.expenses.length ? 'clear-filters' : 'add-expense', state.expenses.length ? 'Reset filters' : 'Add expense')}<div class="pagination"><span>Page ${page} of ${pages}</span><div><button class="btn btn-secondary btn-small" data-action="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button><button class="btn btn-secondary btn-small" data-action="next" ${page >= pages ? 'disabled' : ''}>Next</button></div></div>`;
}
function membersMarkup() {
  const balances = calculateBalances(state), suggestions = suggestSettlements(balances);
  return `<div class="section-heading"><h2>Everyone at the table <span class="muted">/ ${state.members.length}</span></h2><button class="btn btn-secondary" data-action="add-member">${icon('plus')} Add member</button></div><div class="members-grid">${balances.map(b => { const m = member(b.memberId); return `<article class="member-card"><div class="member-card-header">${avatar(m)}<div><h2>${escape(m.name)}</h2><span class="muted">Household member</span></div><div class="row-actions"><button class="icon-button" data-action="edit-member" data-id="${escape(m.id)}" aria-label="Edit ${escape(m.name)}">${icon('edit')}</button><button class="icon-button danger-hover" data-action="delete-member" data-id="${escape(m.id)}" aria-label="Remove ${escape(m.name)}">${icon('trash')}</button></div></div><div class="member-stats"><div class="member-stat"><span>Total paid</span><strong>${money(b.paidMinor)}</strong></div><div class="member-stat"><span>Their share</span><strong>${money(b.shareMinor)}</strong></div></div><div class="member-balance ${b.balanceMinor > 0 ? 'positive' : b.balanceMinor < 0 ? 'negative' : ''}"><span>${b.balanceMinor > 0 ? 'Should receive' : b.balanceMinor < 0 ? 'Owes the group' : 'All balanced'}</span><strong>${money(Math.abs(b.balanceMinor))}</strong></div></article>`; }).join('')}</div>${!balances.length ? `<section class="panel">${emptyMarkup('Start with your people', 'Add friends, housemates, or family. You can use any names you like.', 'add-member', 'Add your first member')}</section>` : ''}
    <section class="panel settlements-panel"><div class="panel-header"><div><h2 class="panel-title">A simpler way to settle up</h2><p class="panel-subtitle">Suggested transfers based on all recorded expenses.</p></div><span class="badge">Suggestions only</span></div>${suggestions.length ? `<div class="settlements-list">${suggestions.map(s => `<div class="settlement-item"><div class="settlement-people"><span class="member-chip">${avatar(member(s.from))}<strong>${escape(member(s.from).name)}</strong></span><span class="settlement-arrow">${icon('arrow')}<span>pays</span></span><span class="member-chip">${avatar(member(s.to))}<strong>${escape(member(s.to).name)}</strong></span></div><strong>${money(s.amountMinor)}</strong></div>`).join('')}</div>` : `<div class="balanced-state">${icon('check')} No transfers needed. Your group is balanced.</div>`}<div class="panel-bottom-note">These are suggestions, not payments. This version does not record repayments; balances reflect expenses only. Each expense is split equally among its selected members.</div></section>`;
}
function settingsMarkup() {
  return `<div class="settings-grid"><section class="panel settings-section"><div class="panel-header"><div><h2 class="panel-title">Household details</h2><p class="panel-subtitle">Make this space feel like yours.</p></div>${icon('home')}</div><form id="settings-form" class="settings-form"><label class="form-field">Household name<input name="groupName" required maxlength="60" value="${escape(state.groupName)}"></label><label class="form-field">Currency<select name="currency">${CURRENCIES.map(c => `<option value="${c.code}" ${state.currency === c.code ? 'selected' : ''}>${c.code} — ${escape(c.label)}</option>`).join('')}</select><span class="field-help">One currency per household. Changing it relabels every amount; it does not convert exchange rates.</span></label><p class="field-error" id="settings-error" role="alert"></p><button class="btn btn-primary" type="submit">Save changes</button></form></section>
    <section class="panel settings-section"><div class="panel-header"><div><h2 class="panel-title">Keep a copy</h2><p class="panel-subtitle">Your data is yours to take with you.</p></div>${icon('download')}</div><div class="settings-body"><p>Expenses are saved automatically in this browser, on this address. Clearing site data removes them. Download a backup regularly.</p><div class="settings-buttons"><button class="btn btn-secondary" data-action="backup">${icon('download')} Export JSON backup</button><button class="btn btn-secondary" data-action="import">${icon('upload')} Restore from backup</button></div><p class="field-help">Restore replaces this workspace after confirmation. Backups contain member names and expense details. Keep them somewhere private.</p>${loadError ? '<button class="btn btn-secondary" data-action="recovery">Download original recovery data</button>' : ''}</div></section>
    <section class="panel settings-section"><div class="panel-header"><div><h2 class="panel-title">How this workspace works</h2><p class="panel-subtitle">Simple, local, and transparent.</p></div>${icon('lock')}</div><div class="settings-body"><ul class="plain-list"><li>Share one household ledger on this browser.</li><li>Data stays on this browser profile and site address.</li><li>No accounts, cloud storage, or automatic device sync.</li><li>The local server serves the website; it does not store expenses.</li><li>To move devices, export a backup and restore it there.</li></ul><p class="field-help">Another browser or a different port opens separate storage. Open tabs at the same address refresh when saved data changes.</p></div></section>
    <section class="panel settings-section"><div class="panel-header"><div><h2 class="panel-title">A clean slate</h2><p class="panel-subtitle">Start your household or explore the demo.</p></div>${icon('expenses')}</div><div class="settings-body"><p>Start fresh removes all expenses and members from this browser workspace. Export a backup first if you want to keep them.</p><div class="settings-buttons"><button class="btn btn-danger" data-action="fresh">Start fresh</button><button class="btn btn-secondary" data-action="demo">Load sample data</button></div><p class="field-help">Sample data is clearly marked and is never mixed into a fresh household automatically.</p></div></section></div>`;
}
function showModal(title, body, actions) {
  const dialog = $('#modal');
  if (dialog.open) dialog.close();
  dialog.innerHTML = `<div class="modal-header"><h2 id="modal-title">${escape(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>${body}${actions || ''}`;
  dialog.showModal();
}
function modalError(error) { const el = $('#modal-error'); if (el) { el.textContent = error.message; el.scrollIntoView({ block: 'nearest' }); } else toast(error.message); }
function confirmAction(title, message, label, action, danger = false) {
  showModal(title, `<div class="modal-body"><p>${message}</p><p id="modal-error" class="field-error" role="alert"></p></div>`, `<div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal" autofocus>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-action">${label}</button></div>`);
  $('#confirm-action').onclick = () => { try { action(); $('#modal').close(); } catch (error) { modalError(error); } };
}
function expenseModal(id) {
  if (!state.members.length) { memberModal(); toast('Add a household member first, then add an expense.'); return; }
  const e = state.expenses.find(x => x.id === id);
  showModal(e ? 'Edit expense' : 'Add an expense', `<form id="expense-form"><div class="modal-body"><p class="modal-intro">The details now. A clearer picture later.</p><div class="form-grid"><label class="form-field full-width">Description<input name="description" maxlength="120" placeholder="e.g. Weekly groceries" required autofocus value="${escape(e?.description || '')}"></label><label class="form-field">Amount (${state.currency})<input name="amount" inputmode="decimal" type="text" required placeholder="0.00" value="${e ? (e.amountMinor / 100).toFixed(2) : ''}"><span class="field-help">Positive amount, up to 2 decimal places.</span></label><label class="form-field">Date<input name="date" type="date" required value="${e?.date || today()}"></label><label class="form-field">Category<select name="category">${CATEGORIES.map(c => `<option value="${c.id}" ${e?.category === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label><label class="form-field">Paid by<select name="paidBy">${state.members.map(m => `<option value="${escape(m.id)}" ${e?.paidBy === m.id ? 'selected' : ''}>${escape(m.name)}</option>`).join('')}</select></label><fieldset class="form-field full-width split-field"><legend>Split equally between</legend><div class="checkbox-grid">${state.members.map(m => `<label class="checkbox-label"><input type="checkbox" name="splitBetween" value="${escape(m.id)}" ${!e || e.splitBetween.includes(m.id) ? 'checked' : ''}>${avatar(m)}<span>${escape(m.name)}</span></label>`).join('')}</div><span class="field-help">Choose at least one person. New expenses assign leftover paise/cents in the order shown. Editing preserves the original split order, with newly selected members added last.</span></fieldset></div><p class="field-error" id="modal-error" role="alert"></p></div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${e ? 'Save changes' : 'Add expense'}</button></div></form>`);
  $('#expense-form').onsubmit = event => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const nextExpense = { id: e?.id || uid(), description: form.get('description').trim(), amountMinor: parseAmount(form.get('amount')), date: form.get('date'), category: form.get('category'), paidBy: form.get('paidBy'), splitBetween: form.getAll('splitBetween') };
      if (!nextExpense.splitBetween.length) throw new Error('Choose at least one member to split this expense with.');
      if (e) nextExpense.splitBetween = [...e.splitBetween.filter(id => nextExpense.splitBetween.includes(id)), ...nextExpense.splitBetween.filter(id => !e.splitBetween.includes(id))];
      commit({ ...state, expenses: e ? state.expenses.map(x => x.id === e.id ? nextExpense : x) : [...state.expenses, nextExpense] });
      $('#modal').close(); toast(e ? 'Expense updated.' : 'Expense added and saved.');
    } catch (error) { modalError(error); }
  };
}
function memberModal(id) {
  const m = member(id), colors = ['#4f8065', '#ad7658', '#7776a5', '#4d879b', '#b68e35', '#aa6883'];
  if (m && !colors.includes(m.color)) colors.push(m.color);
  showModal(m ? 'Edit member' : 'Add a member', `<form id="member-form"><div class="modal-body"><label class="form-field">Name<input name="name" required maxlength="40" placeholder="e.g. Your name" autofocus value="${escape(m?.name || '')}"></label><label class="form-field">Avatar color<select name="color">${colors.map((c, i) => `<option value="${c}" ${(m?.color || colors[state.members.length % colors.length]) === c ? 'selected' : ''}>${(['Forest', 'Terracotta', 'Lavender', 'Ocean', 'Honey', 'Rose'][i] || 'Current color')}</option>`).join('')}</select></label><p class="field-help">Members are people in this ledger, not separate login accounts.</p><p class="field-error" id="modal-error" role="alert"></p></div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${m ? 'Save changes' : 'Add member'}</button></div></form>`);
  $('#member-form').onsubmit = event => { event.preventDefault(); try { const f = new FormData(event.currentTarget), name = f.get('name').trim(); if (state.members.some(x => x.id !== m?.id && x.name.toLowerCase() === name.toLowerCase())) throw new Error('Use a different name so members are easy to tell apart.'); const next = { id: m?.id || uid(), name, color: f.get('color') }; commit({ ...state, members: m ? state.members.map(x => x.id === m.id ? next : x) : [...state.members, next] }); $('#modal').close(); toast(m ? 'Member updated.' : 'Member added.'); } catch (error) { modalError(error); } };
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportCSV() {
  if (filters.from && filters.to && filters.from > filters.to) { toast('Fix the date range before exporting.'); return; }
  const cell = value => { let s = String(value); if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  const rows = [['Date', 'Description', 'Amount', 'Currency', 'Category', 'Paid by', 'Split between', 'Sample data'], ...filtered().map(e => [e.date, e.description, (e.amountMinor / 100).toFixed(2), state.currency, category(e.category).label, member(e.paidBy).name, e.splitBetween.map(id => member(id).name).join('; '), state.isDemo ? 'Yes' : 'No'])];
  download('\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n'), `together-expenses-${today()}.csv`, 'text/csv;charset=utf-8'); toast('Filtered expenses exported.');
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action], [data-view]'); if (!button) return;
  if (button.dataset.view) { view = button.dataset.view; location.hash = view; render(); $('#main').focus({ preventScroll: true }); return; }
  const id = button.dataset.id;
  switch (button.dataset.action) {
    case 'add-expense': expenseModal(); break;
    case 'edit-expense': expenseModal(id); break;
    case 'delete-expense': { const e = state.expenses.find(x => x.id === id); confirmAction('Delete this expense?', `<strong>${escape(e.description)}</strong> · ${money(e.amountMinor)}<br>This removes it from totals and everyone’s balances.`, 'Delete expense', () => { commit({ ...state, expenses: state.expenses.filter(x => x.id !== id) }); toast('Expense deleted.'); }, true); break; }
    case 'add-member': memberModal(); break;
    case 'edit-member': memberModal(id); break;
    case 'delete-member': { if (state.expenses.some(e => e.paidBy === id || e.splitBetween.includes(id))) { toast('This member has expense history. Reassign or delete those expenses before removing them.'); break; } confirmAction('Remove this member?', `Remove <strong>${escape(member(id).name)}</strong> from this household?`, 'Remove member', () => { commit({ ...state, members: state.members.filter(m => m.id !== id) }); toast('Member removed.'); }, true); break; }
    case 'close-modal': $('#modal').close(); break;
    case 'backup': download(JSON.stringify(state, null, 2), `together-backup-${today()}.json`, 'application/json'); toast('Backup downloaded.'); break;
    case 'recovery': download(lastStored || '', `together-recovery-${today()}.txt`, 'text/plain'); break;
    case 'import': $('#import-file').click(); break;
    case 'csv': exportCSV(); break;
    case 'fresh': confirmAction('Start a fresh household?', 'This replaces all current expenses and members. Download a backup first if you want to keep them. Your new workspace starts empty.', 'Start fresh', () => { view = 'members'; filters = { search: '', category: 'all', member: 'all', from: '', to: '', sort: 'newest' }; commit(createEmptyState(), { recovery: true }); location.hash = view; toast('A fresh start. Add your household members.'); }, true); break;
    case 'demo': confirmAction('Load sample data?', 'This replaces the current workspace with a clearly labeled demo household. Download a backup first if you want to keep your current data.', 'Load sample data', () => { view = 'overview'; commit(createSampleState(today()), { recovery: true }); location.hash = view; toast('Sample household loaded.'); }); break;
    case 'clear-filters': filters = { search: '', category: 'all', member: 'all', from: '', to: '', sort: 'newest' }; page = 1; render(); break;
    case 'prev': page--; updateExpenseList(); break;
    case 'next': page++; updateExpenseList(); break;
  }
});
document.addEventListener('input', event => { if (event.target.id === 'search') { filters.search = event.target.value; page = 1; updateExpenseList(); } });
document.addEventListener('change', event => {
  const id = event.target.id;
  if (id === 'period') { period = event.target.value; render(); }
  if (id.startsWith('filter-')) { filters[id.slice(7)] = event.target.value; page = 1; updateExpenseList(); }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'settings-form') return;
  event.preventDefault(); const f = new FormData(event.target), next = { ...state, groupName: f.get('groupName').trim(), currency: f.get('currency') };
  const save = () => { commit(next); toast('Household settings saved.'); };
  if (next.currency !== state.currency && state.expenses.length) confirmAction('Change the currency label?', `All amounts will be relabeled from <strong>${state.currency}</strong> to <strong>${escape(next.currency)}</strong>. For example, ${money(10000)} becomes 100.00 ${escape(next.currency)}. No exchange-rate conversion takes place.`, 'Change currency', save);
  else try { save(); } catch (error) { $('#settings-error').textContent = error.message; }
});
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose a JSON backup smaller than 5 MB.');
    const imported = validateState(JSON.parse(await file.text()));
    confirmAction('Restore this backup?', `<strong>${escape(imported.groupName)}</strong><br>${imported.members.length} members · ${imported.expenses.length} expenses · ${imported.currency}${imported.isDemo ? ' · Sample data' : ''}<br><br>This replaces the current workspace. Download a backup of your current data first if you want to keep it.`, 'Restore backup', () => { filters = { search: '', category: 'all', member: 'all', from: '', to: '', sort: 'newest' }; commit(imported, { recovery: true }); toast('Backup restored.'); });
  } catch (error) { toast(`Import failed: ${error.message}`); }
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) throw new Error('This workspace was removed in another tab. Reload or restore a backup in Settings.'); state = validateState(JSON.parse(raw)); lastStored = raw; loadError = ''; $('#modal').close(); render(); toast('Workspace refreshed from another tab.'); }
  catch (error) { loadError = error.message; render(); }
});
window.addEventListener('hashchange', () => { const next = location.hash.slice(1); if (['overview', 'expenses', 'members', 'settings'].includes(next) && next !== view) { view = next; render(); } });
if (['overview', 'expenses', 'members', 'settings'].includes(location.hash.slice(1))) view = location.hash.slice(1);
render();
