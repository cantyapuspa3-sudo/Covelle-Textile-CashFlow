(function () {
  const modules = Object.create(null);
  modules.utils = (function () {
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
const formatDate = (value) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const localDateValue = (date = new Date()) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
const getMonthTransactions = (transactions, date = new Date()) => transactions.filter((transaction) => transaction.date?.slice(0, 7) === localDateValue(date).slice(0, 7));
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
const monthKey = (value) => value.slice(0, 7);
const statusBadge = (status) => `<span class="status ${String(status).toLowerCase()}">${escapeHtml(status)}</span>`;

    return { formatCurrency, formatDate, localDateValue, getMonthTransactions, escapeHtml, monthKey, statusBadge };
  })();
  modules.supabase = (function () {
const config = window.CASHFLOW_SUPABASE_CONFIG || {
  url: 'https://fgjckvrvoaripvgsegfd.supabase.co',
  anonKey: 'sb_publishable_xsq8qPXWLEgTGX2ZIbdWGQ_EE6hJDy2'
};
const supabaseUrl = String(config.url || '').replace(/\/$/, '');
const supabaseAnonKey = config.anonKey || '';

function getHeaders(extra = {}) {
	if (!supabaseUrl) throw new Error('SUPABASE_URL belum dikonfigurasi.');
	if (!supabaseAnonKey) throw new Error('SUPABASE_ANON_KEY belum dikonfigurasi.');
	return { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, ...extra };
}

async function request(path, options = {}) {
	const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
		...options,
		headers: getHeaders(options.headers)
	});
	if (!response.ok) {
		const details = await response.text();
		throw new Error(`Supabase HTTP ${response.status}: ${details}`);
	}
  const prefer = options.headers?.Prefer || options.headers?.prefer || '';
  return response.status === 204 || /return=minimal/i.test(prefer) ? null : response.json();
}

async function supabaseRequest(table) {
	return request(`${encodeURIComponent(table)}?select=*`);
}

async function syncDepartments(departments) {
  const updatedAt = new Date().toISOString();
  const rows = (departments || []).map((department) => ({
    id: department.id,
    code: department.code,
    name: department.name,
    description: department.head || null,
    is_active: String(department.status || '').toLowerCase() === 'active',
    updated_at: updatedAt
  }));
  if (!rows.length) return;
  await request('departments?on_conflict=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
}

async function deleteDepartment(id) {
  await request(`departments?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}

async function loadDepartments() {
  return request('departments?select=id,code,name,description,is_active&order=id.asc');
}

async function loadApplicationState() {
	const rows = await request('application_state?select=state&id=eq.cashflow');
	return rows[0]?.state ?? null;
}

async function saveApplicationState(state) {
	await request('application_state?on_conflict=id', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
		body: JSON.stringify({ id: 'cashflow', state, updated_at: new Date().toISOString() })
	});
}

async function testSupabaseConnection() {
	const data = await request('cash_accounts?select=id');
	return { rowCount: data.length };
}
    return { supabaseRequest, syncDepartments, deleteDepartment, loadDepartments, loadApplicationState, saveApplicationState, testSupabaseConnection };
  })();
  modules.data = (function () {
const { loadApplicationState, loadDepartments, saveApplicationState, syncDepartments } = modules.supabase;
const STORAGE_KEY = 'kasflow-state-v1';
const SYNC_EVENT = 'cashflow:supabase-sync';
let cloudSyncReady = false;
let saveTimer;
let saveQueue = Promise.resolve();

function notifySync(status, message) {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { status, message } }));
}

async function refreshDepartmentsFromSupabase(state) {
  const departments = (await loadDepartments()).map((department) => ({
    id: department.id,
    code: department.code,
    name: department.name,
    head: department.description || '',
    status: department.is_active ? 'Active' : 'Inactive'
  }));
  const currentDepartments = [...(state.departments || [])].sort((first, second) => first.id.localeCompare(second.id));
  const sortedDepartments = departments.sort((first, second) => first.id.localeCompare(second.id));
  if (JSON.stringify(currentDepartments) === JSON.stringify(sortedDepartments)) return false;

  state.departments = sortedDepartments;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  await saveApplicationState(state);
  return true;
}

const initialState = {
  currentUser: { id: 'USR-001', name: 'Cantya Puspa', role: 'Admin' },
  departments: [
    { id: 'DEP-001', code: 'PRD', name: 'Produksi', head: 'Rina Pratiwi', status: 'Active' },
    { id: 'DEP-002', code: 'MTC', name: 'Maintenance', head: 'Dimas Saputra', status: 'Active' },
    { id: 'DEP-003', code: 'WH', name: 'Warehouse', head: 'Agus Setiawan', status: 'Active' },
    { id: 'DEP-004', code: 'QC', name: 'Quality Control', head: 'Maya Lestari', status: 'Active' },
    { id: 'DEP-005', code: 'HGA', name: 'HR & GA', head: 'Sari Wulandari', status: 'Active' },
    { id: 'DEP-006', code: 'FIN', name: 'Finance', head: 'Cantya Puspa', status: 'Active' },
    { id: 'DEP-007', code: 'ACC', name: 'Accounting', head: 'Budi Hartono', status: 'Active' }
  ],
  categories: [
    { id: 'CAT-001', name: 'ATK', group: 'Office', account: 'Beban ATK', status: 'Active' },
    { id: 'CAT-002', name: 'Maintenance Mesin', group: 'Maintenance', account: 'Beban Maintenance', status: 'Active' },
    { id: 'CAT-003', name: 'Sparepart', group: 'Maintenance', account: 'Beban Maintenance', status: 'Active' },
    { id: 'CAT-004', name: 'Transportasi', group: 'Operational', account: 'Beban Transportasi', status: 'Active' },
    { id: 'CAT-005', name: 'Konsumsi', group: 'Employee Welfare', account: 'Beban Konsumsi', status: 'Active' },
    { id: 'CAT-006', name: 'Utility', group: 'Facility', account: 'Beban Utility', status: 'Active' },
    { id: 'CAT-007', name: 'Pengiriman', group: 'Logistics', account: 'Beban Pengiriman', status: 'Active' }
  ],
  coa: [
    { id: 'COA-001', code: '1101', name: 'Cash', type: 'Asset', parent: '-', status: 'Active' },
    { id: 'COA-002', code: '1102', name: 'Petty Cash', type: 'Asset', parent: 'Cash', status: 'Active' },
    { id: 'COA-003', code: '1103', name: 'Bank', type: 'Asset', parent: 'Cash', status: 'Active' },
    { id: 'COA-005', code: '2101', name: 'Accounts Payable', type: 'Liability', parent: '-', status: 'Active' },
    { id: 'COA-006', code: '5101', name: 'Beban ATK', type: 'Expense', parent: '-', status: 'Active' },
    { id: 'COA-007', code: '5102', name: 'Beban Maintenance', type: 'Expense', parent: '-', status: 'Active' },
    { id: 'COA-008', code: '5103', name: 'Beban Transportasi', type: 'Expense', parent: '-', status: 'Active' },
    { id: 'COA-009', code: '5104', name: 'Beban Konsumsi', type: 'Expense', parent: '-', status: 'Active' },
    { id: 'COA-010', code: '5105', name: 'Beban Utility', type: 'Expense', parent: '-', status: 'Active' }
  ],
  cashAccounts: [
    { id: 'CASH-001', code: 'PC-001', name: 'Petty Cash Finance', type: 'Petty Cash', location: 'Finance Room', custodian: 'Cantya Puspa', openingBalance: 5000000, minimumBalance: 1500000, maximumBalance: 5000000, status: 'Active' },
    { id: 'CASH-002', code: 'CS-001', name: 'Kas Operasional Pabrik', type: 'Cash', location: 'Cashier Room', custodian: 'Cashier', openingBalance: 12500000, minimumBalance: 3000000, maximumBalance: 20000000, status: 'Active' },
    { id: 'CASH-003', code: 'BNK-001', name: 'Bank Operasional', type: 'Bank', location: 'Bank Account', custodian: 'Finance Manager', openingBalance: 85000000, minimumBalance: 0, maximumBalance: 0, status: 'Active' }
  ],
  users: [
    { id: 'USR-001', name: 'Cantya Puspa', email: 'finance.admin@kasflow.local', role: 'Admin', status: 'Active' },
    { id: 'USR-002', name: 'Dimas Saputra', email: 'dimas@kasflow.local', role: 'Supervisor', status: 'Active' },
    { id: 'USR-003', name: 'Budi Hartono', email: 'budi@kasflow.local', role: 'Accounting', status: 'Active' },
    { id: 'USR-004', name: 'Cashier Pabrik', email: 'cashier@kasflow.local', role: 'Cashier', status: 'Active' }
  ],
  transactions: [
    { id: 'PCT-260901', type: 'petty-topup', date: '2026-09-01', sourceCashAccountId: 'CASH-003', cashAccountId: 'CASH-001', amount: 2000000, description: 'Penambahan dana operasional petty cash', status: 'Posted' },
    { id: 'CIN-260902', type: 'cash-in', date: '2026-09-02', cashAccountId: 'CASH-002', category: 'Pengembalian Uang Muka', amount: 1250000, description: 'Pengembalian uang muka pembelian perlengkapan produksi', status: 'Posted' },
    { id: 'TRF-260903', type: 'cash-transfer', date: '2026-09-03', sourceCashAccountId: 'CASH-003', cashAccountId: 'CASH-002', amount: 8000000, description: 'Pengisian kas operasional mingguan', status: 'Posted' },
    { id: 'PCV-260904', type: 'petty-expense', date: '2026-09-04', cashAccountId: 'CASH-001', department: 'Maintenance', category: 'Sparepart', amount: 850000, description: 'Penggantian bearing mesin winding', status: 'Approved', requester: 'Dimas Saputra' },
    { id: 'COUT-260905', type: 'cash-out', date: '2026-09-05', cashAccountId: 'CASH-002', department: 'Warehouse', category: 'Pengiriman', amount: 1250000, description: 'Ongkos kirim gulungan kain ke pelanggan', status: 'Approved', requester: 'Agus Setiawan' },
    { id: 'REQ-260906', type: 'cash-request', date: '2026-09-06', department: 'Produksi', category: 'Maintenance Mesin', amount: 3200000, description: 'Servis berkala mesin weaving', status: 'Approved', requester: 'Rina Pratiwi' },
    { id: 'CIN-260908', type: 'cash-in', date: '2026-09-08', cashAccountId: 'CASH-003', category: 'Penjualan Sisa Produksi', amount: 2750000, description: 'Penerimaan penjualan sisa kain produksi', status: 'Posted' },
    { id: 'PCV-260909', type: 'petty-expense', date: '2026-09-09', cashAccountId: 'CASH-001', department: 'HR & GA', category: 'Konsumsi', amount: 420000, description: 'Konsumsi lembur tim produksi', status: 'Approved', requester: 'Sari Wulandari' },
    { id: 'TRF-260910', type: 'cash-transfer', date: '2026-09-10', sourceCashAccountId: 'CASH-002', cashAccountId: 'CASH-001', amount: 1500000, description: 'Replenishment petty cash dari kas operasional', status: 'Posted' },
    { id: 'COUT-260912', type: 'cash-out', date: '2026-09-12', cashAccountId: 'CASH-003', department: 'Produksi', category: 'Bahan Baku', amount: 18500000, description: 'Pembayaran uang muka benang polyester kepada pemasok', status: 'Approved', requester: 'Maya Lestari' },
    { id: 'PCV-260914', type: 'petty-expense', date: '2026-09-14', cashAccountId: 'CASH-001', department: 'Quality Control', category: 'ATK', amount: 365000, description: 'Pembelian label dan alat tulis inspeksi kain', status: 'Rejected', requester: 'Maya Lestari' },
    { id: 'PCR-260916', type: 'petty-replenishment', date: '2026-09-16', sourceCashAccountId: 'CASH-003', cashAccountId: 'CASH-001', amount: 1480000, description: 'Pengisian kembali dana petty cash berdasarkan bukti pengeluaran', status: 'Posted' },
    { id: 'REQ-260918', type: 'cash-request', date: '2026-09-18', department: 'Maintenance', category: 'Sparepart', amount: 2750000, description: 'Pembelian belt conveyor pengangkut bahan', status: 'Rejected', requester: 'Dimas Saputra' },
    { id: 'CIN-260920', type: 'cash-in', date: '2026-09-20', cashAccountId: 'CASH-002', category: 'Pengembalian Biaya Pengiriman', amount: 950000, description: 'Koreksi kelebihan pembayaran ekspedisi bahan baku', status: 'Posted' },
    { id: 'COUT-260922', type: 'cash-out', date: '2026-09-22', cashAccountId: 'CASH-002', department: 'Utility', category: 'Utility', amount: 3250000, description: 'Pembayaran tagihan listrik area produksi', status: 'Approved', requester: 'Agus Setiawan' },
    { id: 'PCV-260923', type: 'petty-expense', date: '2026-09-23', cashAccountId: 'CASH-001', department: 'Maintenance', category: 'Maintenance Mesin', amount: 675000, description: 'Jasa penyetelan mesin rajut circular', status: 'Approved', requester: 'Dimas Saputra' },
    { id: 'TRF-260924', type: 'cash-transfer', date: '2026-09-24', sourceCashAccountId: 'CASH-003', cashAccountId: 'CASH-002', amount: 6000000, description: 'Pengisian kas operasional untuk kebutuhan pengiriman', status: 'Posted' },
    { id: 'COUT-260925', type: 'cash-out', date: '2026-09-25', cashAccountId: 'CASH-003', department: 'Warehouse', category: 'Bahan Baku', amount: 12400000, description: 'Pelunasan pembelian benang untuk jadwal produksi', status: 'Approved', requester: 'Agus Setiawan' },
    { id: 'PCV-260926', type: 'petty-expense', date: '2026-09-26', cashAccountId: 'CASH-001', department: 'Produksi', category: 'Sparepart', amount: 735000, description: 'Penggantian nozzle mesin pewarnaan', status: 'Pending', requester: 'Rina Pratiwi' },
    { id: 'REQ-260927', type: 'cash-request', date: '2026-09-27', department: 'Quality Control', category: 'Utility', amount: 1850000, description: 'Kalibrasi alat ukur ketebalan kain', status: 'Pending', requester: 'Maya Lestari' },
  ],
  settings: { pettyFund: 5000000, minimumBalance: 1500000, maximumBalance: 5000000, approvalMatrix: [{ max: 500000, role: 'Supervisor' }, { max: 5000000, role: 'Manager' }, { max: null, role: 'Finance Manager' }] }
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) { localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState)); return structuredClone(initialState); }
  const state = JSON.parse(saved);
  state.transactions ||= [];
  const transactionIds = new Set(state.transactions.map((transaction) => transaction.id));
  state.transactions.push(...initialState.transactions.filter((transaction) => !transactionIds.has(transaction.id)));
  state.currentUser = { ...state.currentUser, name: 'Cantya Puspa' };
  const financeUser = state.users?.find((user) => user.id === 'USR-001');
  if (financeUser) financeUser.name = 'Cantya Puspa';
  const financeDepartment = state.departments?.find((department) => department.id === 'DEP-006');
  if (financeDepartment) financeDepartment.head = 'Cantya Puspa';
  const pettyCash = state.cashAccounts?.find((account) => account.id === 'CASH-001');
  if (pettyCash) pettyCash.custodian = 'Cantya Puspa';
  state.transactions = state.transactions.filter((transaction) => !['cash-advance', 'settlement', 'reimbursement'].includes(transaction.type));
  delete state.vendors;
  delete state.auditTrail;
  delete state.budgets;
  state.cashCounts ||= [];
  state.journals ||= [];
  state.reconciliations ||= [];
  state.reportFilters ||= {};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}
async function initializeSupabaseState(state) {
  notifySync('syncing', 'Menyinkronkan seluruh data ke Supabase...');
  const remoteState = await loadApplicationState();

  if (remoteState) {
    Object.assign(state, remoteState);
    state.transactions ||= [];
    state.cashCounts ||= [];
    state.journals ||= [];
    state.reconciliations ||= [];
    state.reportFilters ||= {};
  } else {
    await syncDepartments(state.departments || []);
  }

  await refreshDepartmentsFromSupabase(state);
  await saveApplicationState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  cloudSyncReady = true;
  notifySync('synced', 'Seluruh data tersinkron ke Supabase');
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!cloudSyncReady) return;

  clearTimeout(saveTimer);
  const snapshot = structuredClone(state);
  saveTimer = setTimeout(() => {
    notifySync('syncing', 'Menyinkronkan perubahan ke Supabase...');
    saveQueue = saveQueue.catch(() => {})
      .then(() => syncDepartments(snapshot.departments || []))
      .then(() => saveApplicationState(snapshot))
      .then(() => notifySync('synced', 'Seluruh data tersinkron ke Supabase'))
      .catch((error) => notifySync('error', error.message));
  }, 400);
}
function createId(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}`; }

    return { loadState, initializeSupabaseState, refreshDepartmentsFromSupabase, saveState, createId, STORAGE_KEY };
  })();
  modules.transactions = (function () {
const { createId, saveState } = modules.data;
const { escapeHtml, formatCurrency, formatDate, localDateValue, statusBadge } = modules.utils;
const definitions = {
  'petty-topup': { title: 'Pembentukan / Top-Up Dana', eyebrow: 'PETTY CASH', type: 'petty-topup', idPrefix: 'PCT', submitLabel: 'Simpan Top-Up', fields: [['date', 'Tanggal', 'date'], ['sourceCashAccountId', 'Kas / Bank Sumber', 'cash'], ['cashAccountId', 'Petty Cash Tujuan', 'petty-cash'], ['amount', 'Nominal', 'number'], ['description', 'Keterangan', 'text']] },
  'petty-expenses': { title: 'Pengeluaran Petty Cash', eyebrow: 'PETTY CASH', type: 'petty-expense', idPrefix: 'PCV', submitLabel: 'Simpan Voucher', fields: [['date', 'Tanggal', 'date'], ['department', 'Departemen', 'department'], ['category', 'Kategori', 'category'], ['cashAccountId', 'Petty Cash', 'petty-cash'], ['vendor', 'Vendor / Supplier (manual)', 'text'], ['amount', 'Nominal', 'number'], ['description', 'Keterangan', 'text']] },
  'petty-replenishment': { title: 'Replenishment Petty Cash', eyebrow: 'PETTY CASH', type: 'petty-replenishment', idPrefix: 'PCR', submitLabel: 'Hitung & Simpan Replenishment', fields: [['date', 'Tanggal', 'date'], ['sourceCashAccountId', 'Kas / Bank Sumber', 'cash'], ['cashAccountId', 'Petty Cash', 'petty-cash'], ['description', 'Keterangan', 'text']] },
  'cash-in': { title: 'Kas Masuk', eyebrow: 'KAS OPERASIONAL', type: 'cash-in', idPrefix: 'CIN', submitLabel: 'Simpan Kas Masuk', fields: [['date', 'Tanggal', 'date'], ['cashAccountId', 'Kas Tujuan', 'cash-any'], ['category', 'Kategori / Sumber', 'text'], ['amount', 'Nominal', 'number'], ['description', 'Keterangan', 'text']] },
  'cash-out': { title: 'Kas Keluar', eyebrow: 'KAS OPERASIONAL', type: 'cash-out', idPrefix: 'COUT', submitLabel: 'Simpan Kas Keluar', fields: [['date', 'Tanggal', 'date'], ['cashAccountId', 'Kas Sumber', 'cash-any'], ['department', 'Departemen', 'department'], ['category', 'Kategori', 'category'], ['vendor', 'Vendor / Supplier (manual)', 'text'], ['amount', 'Nominal', 'number'], ['description', 'Keterangan', 'text']] },
  'cash-transfer': { title: 'Transfer Kas / Bank-to-Cash', eyebrow: 'KAS OPERASIONAL', type: 'cash-transfer', idPrefix: 'TRF', submitLabel: 'Simpan Transfer', fields: [['date', 'Tanggal', 'date'], ['sourceCashAccountId', 'Kas / Bank Sumber', 'cash-any'], ['cashAccountId', 'Kas / Bank Tujuan', 'cash-any'], ['amount', 'Nominal', 'number'], ['description', 'Keterangan', 'text']] },
  'cash-request': { title: 'Cash Request', eyebrow: 'TRANSAKSI', type: 'cash-request', idPrefix: 'CR', submitLabel: 'Submit Cash Request', fields: [['date', 'Tanggal Pengajuan', 'date'], ['requester', 'Requester', 'text'], ['department', 'Departemen', 'department'], ['category', 'Kategori', 'category'], ['amount', 'Estimasi Nominal', 'number'], ['requiredDate', 'Diperlukan Pada', 'date'], ['description', 'Tujuan / Keperluan', 'text']] },
};

function cashMovement(transaction, accountId) {
  if (transaction.status !== 'Approved' && transaction.status !== 'Posted') return 0;
  if (transaction.type === 'cash-transfer') return transaction.cashAccountId === accountId ? transaction.amount : transaction.sourceCashAccountId === accountId ? -transaction.amount : 0;
  if (transaction.cashAccountId !== accountId) return 0;
  return ['cash-in', 'petty-topup', 'petty-replenishment'].includes(transaction.type) ? transaction.amount : ['cash-out', 'petty-expense'].includes(transaction.type) ? -transaction.amount : 0;
}
function calculateBalance(state, accountId) { const account = state.cashAccounts.find((item) => item.id === accountId); return (account?.openingBalance || 0) + state.transactions.reduce((sum, transaction) => sum + cashMovement(transaction, accountId), 0); }
function options(type, state, currentValue = '') { const list = type === 'department' ? state.departments.map((item) => item.name) : type === 'category' ? state.categories.map((item) => item.name) : state.cashAccounts.filter((item) => type === 'petty-cash' ? item.type === 'Petty Cash' : true).map((item) => item.id); return list.map((value) => `<option value="${escapeHtml(value)}" ${value === currentValue ? 'selected' : ''}>${escapeHtml(type.includes('cash') ? state.cashAccounts.find((item) => item.id === value)?.name || value : value)}</option>`).join(''); }
function inputFor([key, label, type], state, transaction = {}) { if (['department', 'category', 'vendor', 'cash', 'petty-cash', 'cash-any'].includes(type)) return `<select name="${key}" id="${key}" required><option value="">Pilih ${label}</option>${options(type, state, transaction[key])}</select>`; const value = transaction[key] ?? (type === 'date' ? localDateValue() : ''); const extra = type === 'number' ? 'min="1" step="1"' : ''; return `<input id="${key}" name="${key}" type="${type}" value="${escapeHtml(value)}" ${extra} required>`; }
function tableFor(view, state) { const definition = definitions[view]; const rows = state.transactions.filter((transaction) => transaction.type === definition.type).slice().reverse(); if (!rows.length) return '<div class="empty-state">Belum ada transaksi pada modul ini.</div>'; return `<div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>Tanggal</th><th>Detail</th><th>Nominal</th><th>Status</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.id)}</strong></td><td>${formatDate(row.date)}</td><td>${escapeHtml(row.description || row.purpose || row.employee || row.requester || '-')}</td><td>${formatCurrency(row.amount)}</td><td>${statusBadge(row.status)}</td></tr>`).join('')}</tbody></table></div>`; }
function renderTransaction(view, state) { const definition = definitions[view]; const petty = state.cashAccounts.find((account) => account.type === 'Petty Cash'); const balance = petty ? calculateBalance(state, petty.id) : 0; const isReplenishment = view === 'petty-replenishment'; return `<div class="section-head"><div><span class="eyebrow">${definition.eyebrow}</span><h2>${definition.title}</h2></div><span class="date-pill">${isReplenishment ? `Saldo saat ini: ${formatCurrency(balance)}` : 'Draft tersimpan di LocalStorage'}</span></div><div class="transaction-layout"><form class="panel transaction-form" data-transaction-form="${view}"><div class="panel-header"><div><h3>Input Transaksi</h3><p>Field bertanda wajib harus diisi sebelum disimpan.</p></div></div><div class="form-grid">${definition.fields.map((field) => `<div class="field ${field[0] === 'description' || field[0] === 'purpose' ? 'full' : ''}"><label for="${field[0]}">${field[1]}</label>${inputFor(field, state)}</div>`).join('')}${isReplenishment ? '<div class="field full"><div class="alert">Nominal replenishment dihitung dari dana imprest dikurangi saldo saat ini.</div></div>' : ''}<div class="form-actions"><button type="reset" class="button-secondary">Reset</button><button class="button-primary">${definition.submitLabel}</button></div></div></form><div class="panel"><div class="panel-header"><div><h3>Riwayat ${definition.title}</h3><p>Status awal transaksi mengikuti segregation of duties.</p></div></div>${tableFor(view, state)}</div></div>`; }
function bindTransaction(view, state, render, showToast) { const form = document.querySelector(`[data-transaction-form="${view}"]`); if (!form) return; form.addEventListener('submit', (event) => { event.preventDefault(); const definition = definitions[view]; const values = Object.fromEntries(new FormData(form).entries()); const amount = view === 'petty-replenishment' ? Math.max(0, calculateBalance(state, values.cashAccountId) ? (state.settings.pettyFund - calculateBalance(state, values.cashAccountId)) : 0) : Number(values.amount); if (['cash-transfer'].includes(view) && values.sourceCashAccountId === values.cashAccountId) return showToast('Kas sumber dan tujuan tidak boleh sama.'); if (!amount || amount <= 0) return showToast('Nominal harus lebih besar dari 0.'); if (view === 'petty-replenishment' && amount <= 0) return showToast('Saldo petty cash sudah mencapai fund imprest.'); const pendingTypes = ['petty-expense', 'cash-out', 'cash-request']; const transaction = { id: createId(definition.idPrefix), type: definition.type, ...values, amount, status: pendingTypes.includes(definition.type) ? 'Pending' : 'Posted', createdBy: state.currentUser.name }; state.transactions.push(transaction); saveState(state); showToast(`${transaction.id} berhasil disimpan dengan status ${transaction.status}`); render(view); }); }

    return { cashMovement, calculateBalance, renderTransaction, bindTransaction };
  })();
  modules.accounting = (function () {
const { createId, saveState } = modules.data;
const { calculateBalance, cashMovement } = modules.transactions;
const { escapeHtml, formatCurrency, formatDate, localDateValue, statusBadge } = modules.utils;
const today = localDateValue();
const journalStatuses = ['Approved', 'Posted'];
function cashName(state, accountId) { return state.cashAccounts.find((account) => account.id === accountId)?.name || 'Cash'; }
function expenseAccount(state, category) { return state.categories.find((item) => item.name === category)?.account || 'Beban Lain-lain'; }
function line(journalId, transaction, account, debit, credit, description) { return { journalId, date: transaction.date, referenceNumber: transaction.id, sourceTransaction: transaction.id, account, debit, credit, description, createdBy: transaction.createdBy || 'Cantya Puspa' }; }
function pair(journalId, transaction, debitAccount, creditAccount, amount, description) { return [line(journalId, transaction, debitAccount, amount, 0, description), line(journalId, transaction, creditAccount, 0, amount, description)]; }
function transactionJournal(state, transaction) { if (!journalStatuses.includes(transaction.status)) return []; const journalId = `JRN-${transaction.id}`; const cashAccount = cashName(state, transaction.cashAccountId); if (transaction.type === 'petty-expense') return pair(journalId, transaction, expenseAccount(state, transaction.category), cashAccount, transaction.amount, transaction.description); if (transaction.type === 'petty-topup' || transaction.type === 'petty-replenishment') return pair(journalId, transaction, cashAccount, cashName(state, transaction.sourceCashAccountId), transaction.amount, transaction.description); if (transaction.type === 'cash-in') return pair(journalId, transaction, cashAccount, transaction.category || 'Pendapatan Lain-lain', transaction.amount, transaction.description); if (transaction.type === 'cash-out') return pair(journalId, transaction, expenseAccount(state, transaction.category), cashAccount, transaction.amount, transaction.description); if (transaction.type === 'cash-transfer') return pair(journalId, transaction, cashName(state, transaction.cashAccountId), cashName(state, transaction.sourceCashAccountId), transaction.amount, transaction.description); return []; }
function syncJournals(state) { state.journals = state.transactions.flatMap((transaction) => transactionJournal(state, transaction)); return state.journals; }
function journalTotals(state) { return syncJournals(state).reduce((total, row) => ({ debit: total.debit + row.debit, credit: total.credit + row.credit }), { debit: 0, credit: 0 }); }
function renderJournal(state) { const totals = journalTotals(state); const journals = syncJournals(state).slice().reverse(); return `<div class="section-head"><div><span class="eyebrow">ACCOUNTING</span><h2>Jurnal Umum</h2><p>Jurnal otomatis hanya dibuat dari transaksi yang memenuhi status posting.</p></div><span class="status approved">${totals.debit === totals.credit ? 'Balanced' : 'Unbalanced'}</span></div><div class="metrics"><article class="metric-card"><span class="label">Total Debit</span><div class="value">${formatCurrency(totals.debit)}</div></article><article class="metric-card"><span class="label">Total Credit</span><div class="value">${formatCurrency(totals.credit)}</div></article><article class="metric-card"><span class="label">Selisih</span><div class="value">${formatCurrency(totals.debit - totals.credit)}</div></article></div><div class="panel"><div class="panel-header"><div><h3>Automatic General Journal</h3><p>Source transaction tidak digandakan saat halaman dibuka ulang.</p></div></div>${journals.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Journal ID</th><th>Date</th><th>Reference</th><th>Account</th><th>Debit</th><th>Credit</th><th>Description</th></tr></thead><tbody>${journals.map((row) => `<tr><td>${escapeHtml(row.journalId)}</td><td>${formatDate(row.date)}</td><td>${escapeHtml(row.referenceNumber)}</td><td>${escapeHtml(row.account)}</td><td>${formatCurrency(row.debit)}</td><td>${formatCurrency(row.credit)}</td><td>${escapeHtml(row.description)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">Belum ada jurnal posted.</div>'}</div>`; }
function cashBookRows(state) { const rows = []; state.cashAccounts.forEach((account) => rows.push({ date: '1900-01-01', id: `OPEN-${account.id}`, description: `Opening balance - ${account.name}`, cashIn: account.openingBalance, cashOut: 0, accountId: account.id })); state.transactions.filter((transaction) => journalStatuses.includes(transaction.status)).forEach((transaction) => state.cashAccounts.forEach((account) => { const movement = cashMovement(transaction, account.id); if (movement) rows.push({ date: transaction.date, id: transaction.id, description: transaction.description || transaction.id, cashIn: movement > 0 ? movement : 0, cashOut: movement < 0 ? Math.abs(movement) : 0, accountId: account.id }); })); return rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)); }
function renderCashBook(state) { const balances = {}; const rows = cashBookRows(state).map((row) => { balances[row.accountId] = (balances[row.accountId] || 0) + row.cashIn - row.cashOut; return { ...row, balance: balances[row.accountId] }; }); return `<div class="section-head"><div><span class="eyebrow">ACCOUNTING</span><h2>Buku Kas</h2><p>Running balance dihitung terpisah untuk setiap akun kas.</p></div></div><div class="panel"><div class="panel-header"><div><h3>Cash Book</h3><p>${rows.length} baris pergerakan kas.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Cash Account</th><th>Reference</th><th>Description</th><th>Cash In</th><th>Cash Out</th><th>Balance</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.date === '1900-01-01' ? '-' : formatDate(row.date)}</td><td>${escapeHtml(cashName(state, row.accountId))}</td><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.description)}</td><td>${formatCurrency(row.cashIn)}</td><td>${formatCurrency(row.cashOut)}</td><td>${formatCurrency(row.balance)}</td></tr>`).join('')}</tbody></table></div></div>`; }
function renderReconciliation(state) { const rows = (state.reconciliations || []).slice().reverse(); return `<div class="section-head"><div><span class="eyebrow">ACCOUNTING</span><h2>Rekonsiliasi Kas</h2><p>Bandingkan saldo sistem dengan saldo fisik atau bank statement.</p></div></div><div class="transaction-layout"><form class="panel transaction-form" data-reconciliation-form><div class="panel-header"><div><h3>Input Rekonsiliasi</h3><p>Difference = Actual Balance - System Balance.</p></div></div><div class="form-grid"><div class="field full"><label for="reconCashAccountId">Cash Account</label><select id="reconCashAccountId" name="cashAccountId" required><option value="">Pilih Cash Account</option>${state.cashAccounts.map((account) => `<option value="${account.id}">${escapeHtml(account.name)}</option>`).join('')}</select></div><div class="field"><label for="reconDate">Tanggal</label><input id="reconDate" name="reconDate" type="date" value="${today}" required></div><div class="field"><label for="actualBalance">Actual / Bank Balance</label><input id="actualBalance" name="actualBalance" type="number" min="0" step="1" required></div><div class="field full"><label for="reconcilingItem">Reconciling Item</label><input id="reconcilingItem" name="reconcilingItem" type="text" required></div><div class="field full"><label for="reconNotes">Notes</label><input id="reconNotes" name="notes" type="text" required></div><div class="form-actions"><button class="button-primary">Simpan Rekonsiliasi</button></div></div></form><div class="panel"><div class="panel-header"><div><h3>Reconciliation History</h3><p>Status dihitung dari selisih saldo aktual dan sistem.</p></div></div>${rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Account</th><th>System</th><th>Actual</th><th>Difference</th><th>Reconciling Item</th><th>Status</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${formatDate(row.reconDate)}</td><td>${escapeHtml(row.cashAccountName)}</td><td>${formatCurrency(row.systemBalance)}</td><td>${formatCurrency(row.actualBalance)}</td><td>${formatCurrency(row.difference)}</td><td>${escapeHtml(row.reconcilingItem)}</td><td>${statusBadge(row.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">Belum ada rekonsiliasi.</div>'}</div></div>`; }
function renderAccounting(view, state) { if (view === 'cash-book') return renderCashBook(state); return renderJournal(state); }
function bindAccounting(view, state, render, showToast) { if (view !== 'reconciliation') return; const form = document.querySelector('[data-reconciliation-form]'); if (!form) return; form.onsubmit = (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); const account = state.cashAccounts.find((item) => item.id === values.cashAccountId); const actualBalance = Number(values.actualBalance); const systemBalance = calculateBalance(state, account.id); const difference = actualBalance - systemBalance; state.reconciliations ||= []; state.reconciliations.push({ id: createId('REC'), ...values, cashAccountName: account.name, actualBalance, systemBalance, difference, status: difference === 0 ? 'Balanced' : 'Has Difference' }); saveState(state); showToast('Rekonsiliasi berhasil disimpan'); render(view); }; }

    return { syncJournals, renderAccounting, bindAccounting };
  })();
  modules.control = (function () {
const { createId, saveState } = modules.data;
const { calculateBalance } = modules.transactions;
const { escapeHtml, formatCurrency, formatDate, localDateValue, statusBadge } = modules.utils;
const approvalTypes = ['petty-expense', 'cash-out', 'cash-request'];
const typeLabels = { 'petty-expense': 'Petty Cash Voucher', 'cash-out': 'Kas Keluar', 'cash-request': 'Cash Request' };
function controlHeader(eyebrow, title, description) { return `<div class="section-head"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${description}</p></div></div>`; }
function approvalRows(state) { return state.transactions.filter((transaction) => approvalTypes.includes(transaction.type) && ['Pending', 'Submitted', 'Revision Requested'].includes(transaction.status)).slice().reverse(); }
function approvalTable(state) { const rows = approvalRows(state); if (!rows.length) return '<div class="empty-state">Tidak ada transaksi yang menunggu approval.</div>'; return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Transaction ID</th><th>Type</th><th>Requester</th><th>Department</th><th>Amount</th><th>Date</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.id)}</strong></td><td>${typeLabels[row.type]}</td><td>${escapeHtml(row.requester || row.createdBy || '-')}</td><td>${escapeHtml(row.department || '-')}</td><td>${formatCurrency(row.amount)}</td><td>${formatDate(row.date)}</td><td>${statusBadge(row.status)}</td><td><div class="control-actions"><button class="button-secondary" data-approval-action="view" data-id="${row.id}">View</button><button class="button-primary" data-approval-action="approve" data-id="${row.id}">Approve</button><button class="button-secondary danger-button" data-approval-action="reject" data-id="${row.id}">Reject</button><button class="button-secondary" data-approval-action="revision" data-id="${row.id}">Revision</button></div></td></tr>`).join('')}</tbody></table></div>`; }
function renderApproval(state) { return `${controlHeader('APPROVAL CONTROL', 'Pending Approval', 'Approval wajib dilakukan oleh user berbeda dari pembuat transaksi.')}<div class="panel"><div class="panel-header"><div><h3>Approval Queue</h3><p>${approvalRows(state).length} transaksi membutuhkan keputusan.</p></div><span class="status pending">Segregation of duties</span></div>${approvalTable(state)}</div>`; }
function renderApprovalHistory(state, status) { const rows = state.transactions.filter((transaction) => approvalTypes.includes(transaction.type) && transaction.status === status).slice().reverse(); return `${controlHeader('APPROVAL CONTROL', `${status} Transactions`, `Riwayat transaksi dengan status ${status}.`)}<div class="panel"><div class="panel-header"><div><h3>${status}</h3><p>${rows.length} transaksi.</p></div></div>${rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Transaction ID</th><th>Type</th><th>Requester</th><th>Department</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.id)}</strong></td><td>${typeLabels[row.type]}</td><td>${escapeHtml(row.requester || row.createdBy || '-')}</td><td>${escapeHtml(row.department || '-')}</td><td>${formatCurrency(row.amount)}</td><td>${formatDate(row.date)}</td><td>${statusBadge(row.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">Belum ada transaksi pada status ini.</div>'}</div>`; }
function renderPettyBalance(state) { const accounts = state.cashAccounts.filter((account) => account.type === 'Petty Cash'); return `${controlHeader('PETTY CASH', 'Saldo & Threshold Alert', 'Saldo dihitung dari opening balance dan transaksi yang sudah posted/approved.')}<div class="metrics">${accounts.map((account) => { const balance = calculateBalance(state, account.id); const low = balance <= account.minimumBalance; const high = account.maximumBalance > 0 && balance >= account.maximumBalance; return `<article class="metric-card"><span class="label">${escapeHtml(account.name)}</span><div class="value">${formatCurrency(balance)}</div><div class="trend">${low ? 'Perlu Replenishment' : high ? 'Mencapai Maximum Balance' : 'Dalam batas aman'}</div></article>`; }).join('')}</div><div class="panel"><div class="panel-header"><div><h3>Threshold Monitoring</h3><p>Fund, minimum, maksimum, dan status setiap petty cash.</p></div><button class="button-primary" data-go="petty-replenishment">＋ Replenishment</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Cash Account</th><th>Saldo Awal</th><th>Saldo Saat Ini</th><th>Minimum</th><th>Maximum</th><th>Status</th></tr></thead><tbody>${accounts.map((account) => { const balance = calculateBalance(state, account.id); const low = balance <= account.minimumBalance; const high = account.maximumBalance > 0 && balance >= account.maximumBalance; return `<tr><td>${escapeHtml(account.name)}</td><td>${formatCurrency(account.openingBalance)}</td><td>${formatCurrency(balance)}</td><td>${formatCurrency(account.minimumBalance)}</td><td>${formatCurrency(account.maximumBalance)}</td><td>${statusBadge(low ? 'Replenishment Required' : high ? 'At Maximum' : 'Normal')}</td></tr>`; }).join('')}</tbody></table></div></div>`; }
function renderCashCount(state) { return `${controlHeader('PETTY CASH', 'Cash Count & Berita Acara', 'Bandingkan uang fisik dengan saldo sistem dan simpan hasil pemeriksaan.')}<div class="transaction-layout"><form class="panel transaction-form" data-cash-count-form><div class="panel-header"><div><h3>Input Cash Count</h3><p>Difference = Physical Cash - System Balance.</p></div></div><div class="form-grid"><div class="field full"><label for="cashAccountId">Cash Account</label><select id="cashAccountId" name="cashAccountId" required><option value="">Pilih Cash Account</option>${state.cashAccounts.map((account) => `<option value="${account.id}">${escapeHtml(account.name)}</option>`).join('')}</select></div><div class="field"><label for="countDate">Count Date</label><input id="countDate" name="countDate" type="date" value="${localDateValue()}" required></div><div class="field"><label for="countedBy">Counted By</label><input id="countedBy" name="countedBy" type="text" value="${escapeHtml(state.currentUser.name)}" required></div><div class="field"><label for="physicalCash">Physical Cash</label><input id="physicalCash" name="physicalCash" type="number" min="0" step="1" required></div><div class="field full"><label for="countNotes">Notes</label><input id="countNotes" name="countNotes" type="text" required></div><div class="form-actions"><button class="button-primary">Simpan Cash Count</button></div></div></form><div class="panel"><div class="panel-header"><div><h3>Berita Acara History</h3><p>Hasil count tersimpan dan tidak mengubah saldo sistem.</p></div></div>${cashCountTable(state)}</div></div>`; }
function cashCountTable(state) { if (!state.cashCounts?.length) return '<div class="empty-state">Belum ada cash count.</div>'; return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Count ID</th><th>Date</th><th>Account</th><th>Physical</th><th>System</th><th>Difference</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${state.cashCounts.slice().reverse().map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${formatDate(row.countDate)}</td><td>${escapeHtml(row.cashAccountName)}</td><td>${formatCurrency(row.physicalCash)}</td><td>${formatCurrency(row.systemBalance)}</td><td>${formatCurrency(row.difference)}</td><td>${statusBadge(row.difference === 0 ? 'Balanced' : 'Ada Selisih')}</td><td><button class="button-secondary" data-print-count="${row.id}">Berita Acara</button></td></tr>`).join('')}</tbody></table></div>`; }
function renderControl(view, state) { if (view === 'approval') return renderApproval(state); if (view === 'approval-approved') return renderApprovalHistory(state, 'Approved'); if (view === 'approval-rejected') return renderApprovalHistory(state, 'Rejected'); if (view === 'petty-balance') return renderPettyBalance(state); return renderCashCount(state); }
function bindControl(view, state, render, showToast) { document.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => render(button.dataset.go); }); document.querySelectorAll('[data-approval-action]').forEach((button) => { button.onclick = () => { const transaction = state.transactions.find((item) => item.id === button.dataset.id); if (!transaction) return; if (button.dataset.approvalAction === 'view') return showToast(`${transaction.id}: ${transaction.description || 'Detail transaksi'}`); const owner = transaction.createdBy || transaction.requester; if (owner && owner === state.currentUser.name) return showToast('Segregation of duties: pembuat transaksi tidak boleh approve transaksi sendiri.'); transaction.status = button.dataset.approvalAction === 'approve' ? 'Approved' : button.dataset.approvalAction === 'reject' ? 'Rejected' : 'Revision Requested'; saveState(state); showToast(`${transaction.id} berstatus ${transaction.status}`); render(view); }; }); const countForm = document.querySelector('[data-cash-count-form]'); if (countForm) countForm.onsubmit = (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(countForm).entries()); const account = state.cashAccounts.find((item) => item.id === values.cashAccountId); const physicalCash = Number(values.physicalCash); const systemBalance = calculateBalance(state, account.id); const difference = physicalCash - systemBalance; state.cashCounts ||= []; state.cashCounts.push({ id: createId('CNT'), ...values, physicalCash, systemBalance, difference, cashAccountName: account.name, status: difference === 0 ? 'Balanced' : 'Ada Selisih' }); saveState(state); showToast('Cash Count tersimpan'); render(view); }; document.querySelectorAll('[data-print-count]').forEach((button) => { button.onclick = () => showToast(`Berita Acara ${button.dataset.printCount} siap dicetak`); }); }

    return { renderControl, bindControl };
  })();
  modules.dashboard = (function () {
const { escapeHtml, formatCurrency, getMonthTransactions, localDateValue } = modules.utils;
const { calculateBalance } = modules.transactions;
function totalCash(state, type) {
  return state.cashAccounts.filter((account) => !type || account.type === type).reduce((total, account) => total + calculateBalance(state, account.id), 0);
}
function renderBars(transactions) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
    return { key: localDateValue(date), label: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }) };
  });
  const values = days.map((day) => {
    const dayTransactions = transactions.filter((transaction) => transaction.date === day.key && ['Approved', 'Posted'].includes(transaction.status));
    return {
      ...day,
      in: dayTransactions.filter((transaction) => ['cash-in', 'petty-topup', 'petty-replenishment'].includes(transaction.type)).reduce((sum, transaction) => sum + transaction.amount, 0),
      out: dayTransactions.filter((transaction) => ['cash-out', 'petty-expense'].includes(transaction.type)).reduce((sum, transaction) => sum + transaction.amount, 0)
    };
  });
  const maximum = Math.max(...values.flatMap((value) => [value.in, value.out]), 1);
  return values.map((value) => `<div class="bar-group"><div class="bar in" style="height:${Math.max(value.in / maximum * 175, value.in ? 8 : 0)}px" title="Masuk"></div><div class="bar out" style="height:${Math.max(value.out / maximum * 175, value.out ? 8 : 0)}px" title="Keluar"></div><small>${value.label}</small></div>`).join('');
}
function aggregateBy(transactions, key) { return Object.entries(transactions.reduce((result, transaction) => { const value = transaction[key] || 'Lain-lain'; result[value] = (result[value] || 0) + transaction.amount; return result; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4); }
function renderDashboard(state, navigate) {
  const now = new Date();
  const monthTransactions = getMonthTransactions(state.transactions);
  const cashOut = monthTransactions.filter((transaction) => transaction.type !== 'cash-in').reduce((sum, transaction) => sum + transaction.amount, 0);
  const cashIn = monthTransactions.filter((transaction) => transaction.type === 'cash-in').reduce((sum, transaction) => sum + transaction.amount, 0);
  const pending = state.transactions.filter((transaction) => transaction.status === 'Pending');
  const pettyBalance = totalCash(state, 'Petty Cash');
  const petty = state.cashAccounts.find((account) => account.type === 'Petty Cash');
  const departmentTotals = state.transactions.filter((transaction) => transaction.department).reduce((result, transaction) => { result[transaction.department] = (result[transaction.department] || 0) + transaction.amount; return result; }, {});
  const topDepartments = Object.entries(departmentTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topCategories = aggregateBy(state.transactions, 'category');
  const balanceTrend = state.cashAccounts.map((account) => ({ name: account.name, balance: totalCash({ ...state, cashAccounts: [account] }) }));
  const todayLabel = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const syncStatus = document.body.dataset.supabaseSyncStatus || 'syncing';
  const syncLabel = syncStatus === 'synced' ? '● Supabase tersinkron' : syncStatus === 'error' ? '● Cache lokal aktif' : '● Menyinkronkan Supabase...';
  return `<section class="welcome"><div><span class="eyebrow" data-current-date>${todayLabel}</span><h2>Selamat datang, ${escapeHtml(state.currentUser.name)}</h2><p>Ringkasan kendali kas operasional pabrik hari ini.</p></div><div class="date-pill" data-sync-indicator>${syncLabel}</div></section>
  <section class="metrics">
    <article class="metric-card"><span class="label">Total Saldo Petty Cash</span><div class="value">${formatCurrency(pettyBalance)}</div><div class="trend">${pettyBalance <= petty.minimumBalance ? 'Perlu replenishment' : 'Dalam batas aman'}</div></article>
    <article class="metric-card"><span class="label">Saldo Kas Operasional</span><div class="value">${formatCurrency(totalCash(state, 'Cash'))}</div><div class="trend">Saldo terhitung dinamis</div></article>
    <article class="metric-card"><span class="label">Kas Masuk Bulan Berjalan</span><div class="value">${formatCurrency(cashIn)}</div><div class="trend">${monthLabel}</div></article>
    <article class="metric-card"><span class="label">Kas Keluar Bulan Berjalan</span><div class="value">${formatCurrency(cashOut)}</div><div class="trend">${monthTransactions.length} transaksi tercatat</div></article>
  </section>
  <section class="dashboard-grid">
    <article class="panel"><div class="panel-header"><div><h3>Kas Masuk vs Kas Keluar</h3><p>7 hari terakhir, termasuk hari ini</p></div><span class="status approved">Live data</span></div><div class="chart">${renderBars(state.transactions)}</div><div class="legend"><span><i style="background:#e58aa7"></i>Kas Masuk</span><span><i style="background:#d94675"></i>Kas Keluar</span></div></article>
    <article class="panel"><div class="panel-header"><div><h3>Quick Action</h3><p>Akses cepat transaksi umum</p></div></div><div class="quick-actions"><button class="quick-action" data-go="cash-request"><b>＋</b>Cash Request</button><button class="quick-action" data-go="cash-in"><b>↗</b>Kas Masuk</button><button class="quick-action" data-go="cash-out"><b>↘</b>Kas Keluar</button><button class="quick-action" data-go="reimbursement"><b>▣</b>Reimbursement</button><button class="quick-action" data-go="cash-advance"><b>◎</b>Cash Advance</button><button class="quick-action" data-go="cash-count"><b>⌁</b>Cash Count</button></div></article>
    <article class="panel"><div class="panel-header"><div><h3>Pengeluaran per Departemen</h3><p>Akumulasi transaksi tercatat</p></div></div>${topDepartments.map(([department, amount]) => `<div class="list-row"><div class="list-main"><span class="list-icon">${department.slice(0, 1)}</span><div><strong>${department}</strong><small>Operational spending</small></div></div><div class="amount">${formatCurrency(amount)}<small>${Math.round((amount / Math.max(cashOut, 1)) * 100)}% dari total</small></div></div>`).join('') || '<div class="empty-state">Belum ada data departemen.</div>'}</article>
    <article class="panel"><div class="panel-header"><div><h3>Pengeluaran per Kategori</h3><p>Kelompok biaya terbesar</p></div></div>${topCategories.map(([category, amount]) => `<div class="list-row"><div class="list-main"><span class="list-icon">#</span><div><strong>${category}</strong><small>Cost group</small></div></div><div class="amount">${formatCurrency(amount)}<small>${Math.round((amount / Math.max(cashOut, 1)) * 100)}% dari total</small></div></div>`).join('') || '<div class="empty-state">Belum ada data kategori.</div>'}</article>
    <article class="panel"><div class="panel-header"><div><h3>Tren Saldo Kas</h3><p>Saldo terkini per akun kas</p></div></div>${balanceTrend.map((account) => `<div class="list-row"><div class="list-main"><span class="list-icon">$</span><div><strong>${account.name}</strong><small>Current balance</small></div></div><div class="amount">${formatCurrency(account.balance)}</div></div>`).join('')}</article>
    <article class="panel"><div class="panel-header"><div><h3>Perlu Perhatian</h3><p>Alert untuk kontrol kas</p></div></div><div class="alert-list">${pettyBalance <= petty.minimumBalance ? `<div class="alert">Petty Cash perlu replenishment. Saldo di bawah minimum.</div>` : ''}${pending.map((transaction) => `<div class="alert"><strong>${transaction.id}</strong> menunggu approval sebesar ${formatCurrency(transaction.amount)}.</div>`).join('') || '<div class="list-row"><span class="list-main"><span class="list-icon">✓</span><span><strong>Semua terkendali</strong><small>Tidak ada alert kritis saat ini</small></span></span></div>'}</div></article>
  </section>`;
}

    return { renderDashboard };
  })();
  modules.reports = (function () {
const { saveState } = modules.data;
const { escapeHtml, formatCurrency, formatDate, statusBadge } = modules.utils;
const reportNames = {
	'report-petty-cash': 'Laporan Petty Cash',
	'report-operational-cash': 'Laporan Kas Operasional',
	'report-department': 'Pengeluaran per Departemen',
	'report-category': 'Pengeluaran per Kategori',
	'report-cash-count': 'Cash Count & Selisih Kas'
};

function renderFilters(state) {
	const filters = state.reportFilters || {};
	return `<form class="panel report-filter" data-report-filters><div class="form-grid">
		<div class="field"><label for="dateFrom">Date From</label><input id="dateFrom" name="dateFrom" type="date" value="${filters.dateFrom || ''}"></div>
		<div class="field"><label for="dateTo">Date To</label><input id="dateTo" name="dateTo" type="date" value="${filters.dateTo || ''}"></div>
		<div class="field"><label for="department">Department</label><select id="department" name="department"><option value="">Semua Departemen</option>${state.departments.map((item) => `<option value="${escapeHtml(item.name)}" ${filters.department === item.name ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
		<div class="field"><label for="category">Category</label><select id="category" name="category"><option value="">Semua Kategori</option>${state.categories.map((item) => `<option value="${escapeHtml(item.name)}" ${filters.category === item.name ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
		<div class="field"><label for="cashAccountId">Cash Account</label><select id="cashAccountId" name="cashAccountId"><option value="">Semua Cash Account</option>${state.cashAccounts.map((item) => `<option value="${item.id}" ${filters.cashAccountId === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
		<div class="field"><label for="status">Status</label><select id="status" name="status"><option value="">Semua Status</option>${['Pending', 'Approved', 'Posted', 'Rejected'].map((item) => `<option ${filters.status === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
		<div class="form-actions"><button class="button-primary">Filter</button><button type="button" class="button-secondary" data-report-reset>Reset</button><button type="button" class="button-secondary" data-report-print>Print</button><button type="button" class="button-secondary" data-report-export>Export CSV</button></div>
	</div></form>`;
}

function filteredTransactions(state) {
	const filters = state.reportFilters || {};
	return state.transactions.filter((item) => (!filters.dateFrom || item.date >= filters.dateFrom)
		&& (!filters.dateTo || item.date <= filters.dateTo)
		&& (!filters.department || item.department === filters.department)
		&& (!filters.category || item.category === filters.category)
		&& (!filters.cashAccountId || item.cashAccountId === filters.cashAccountId)
		&& (!filters.status || item.status === filters.status));
}

function reportTransactions(state, view) {
	const rows = filteredTransactions(state);
	if (view === 'report-petty-cash') return rows.filter((item) => item.type.startsWith('petty-'));
	if (view === 'report-operational-cash') return rows.filter((item) => ['cash-in', 'cash-out', 'cash-transfer'].includes(item.type));
	return rows.filter((item) => ['petty-expense', 'cash-out'].includes(item.type));
}

function renderTransactionTable(state, rows) {
	if (!rows.length) return '<div class="empty-state">Tidak ada data sesuai filter.</div>';
	return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Department</th><th>Category</th><th>Cash Account</th><th>Amount</th><th>Status</th><th>Description</th></tr></thead><tbody>${rows.slice().reverse().map((item) => `<tr>
		<td>${formatDate(item.date)}</td><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.department || '-')}</td><td>${escapeHtml(item.category || '-')}</td>
		<td>${escapeHtml(state.cashAccounts.find((account) => account.id === item.cashAccountId)?.name || '-')}</td><td>${formatCurrency(item.amount)}</td><td>${statusBadge(item.status)}</td><td>${escapeHtml(item.description || '-')}</td>
	</tr>`).join('')}</tbody></table></div>`;
}

function renderGroupedTable(rows, key) {
	const totals = rows.reduce((result, item) => {
		const label = item[key] || 'Lain-lain';
		result[label] ||= { amount: 0, count: 0 };
		result[label].amount += Number(item.amount) || 0;
		result[label].count += 1;
		return result;
	}, {});
	const entries = Object.entries(totals).sort((first, second) => second[1].amount - first[1].amount);
	if (!entries.length) return '<div class="empty-state">Tidak ada data sesuai filter.</div>';
	return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${key === 'department' ? 'Department' : 'Category'}</th><th>Actual Amount</th><th>Transactions</th></tr></thead><tbody>${entries.map(([label, values]) => `<tr><td>${escapeHtml(label)}</td><td>${formatCurrency(values.amount)}</td><td>${values.count}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderCashCounts(state) {
	const rows = state.cashCounts || [];
	if (!rows.length) return '<div class="empty-state">Belum ada data cash count.</div>';
	return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Count ID</th><th>Account</th><th>System Balance</th><th>Physical Cash</th><th>Difference</th><th>Status</th></tr></thead><tbody>${rows.slice().reverse().map((item) => `<tr><td>${formatDate(item.countDate)}</td><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.cashAccountName)}</td><td>${formatCurrency(item.systemBalance)}</td><td>${formatCurrency(item.physicalCash)}</td><td>${formatCurrency(item.difference)}</td><td>${statusBadge(item.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderReports(view, state) {
	const title = reportNames[view] || reportNames['report-petty-cash'];
	const rows = reportTransactions(state, view);
	let content;
	if (view === 'report-cash-count') content = renderCashCounts(state);
	else if (view === 'report-department') content = renderGroupedTable(rows, 'department');
	else if (view === 'report-category') content = renderGroupedTable(rows, 'category');
	else content = renderTransactionTable(state, rows);
	return `<div class="section-head"><div><span class="eyebrow">REPORTING</span><h2>${title}</h2><p>Filter laporan menggunakan data LocalStorage.</p></div></div>${renderFilters(state)}<div class="panel"><div class="panel-header"><div><h3>${title}</h3><p>Hasil dapat dicetak atau diekspor ke CSV.</p></div></div>${content}</div>`;
}

function csvValue(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

function bindReports(view, state, render, showToast) {
	const filter = document.querySelector('[data-report-filters]');
	if (filter) filter.onsubmit = (event) => {
		event.preventDefault();
		state.reportFilters = Object.fromEntries(new FormData(filter).entries());
		saveState(state);
		render(view);
	};
	document.querySelector('[data-report-reset]')?.addEventListener('click', () => {
		state.reportFilters = {};
		saveState(state);
		render(view);
	});
	document.querySelector('[data-report-print]')?.addEventListener('click', () => window.print());
	document.querySelector('[data-report-export]')?.addEventListener('click', () => {
		const rows = reportTransactions(state, view);
		const csv = ['Date,Reference,Type,Department,Category,Amount,Status', ...rows.map((item) => [item.date, item.id, item.type, item.department, item.category, item.amount, item.status].map(csvValue).join(','))].join('\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		link.download = `${view}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
		showToast('CSV berhasil dibuat');
	});
}

    return { renderReports, bindReports };
  })();
  modules.app = (function () {
const { createId, initializeSupabaseState, loadState, refreshDepartmentsFromSupabase, saveState } = modules.data;
const { escapeHtml, localDateValue, statusBadge } = modules.utils;
const { renderDashboard } = modules.dashboard;
const { bindTransaction, renderTransaction } = modules.transactions;
const { bindControl, renderControl } = modules.control;
const { bindAccounting, renderAccounting } = modules.accounting;
const { bindReports, renderReports } = modules.reports;
const { deleteDepartment, testSupabaseConnection } = modules.supabase;
const state = loadState();
const appView = document.querySelector('#appView');
const pageTitle = document.querySelector('#pageTitle');
const navItems = [...document.querySelectorAll('.nav-item')];
const navGroups = [...document.querySelectorAll('.nav-group')];
const masterConfig = {
  coa: { key: 'coa', title: 'Master Akun / COA', add: 'Tambah Akun', columns: [['code', 'Kode'], ['name', 'Nama Akun'], ['type', 'Tipe'], ['parent', 'Parent Account'], ['status', 'Status']], fields: [['code', 'Account Code', 'text'], ['name', 'Account Name', 'text'], ['type', 'Account Type', 'select', ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']], ['parent', 'Parent Account', 'text']] },
  departments: { key: 'departments', title: 'Master Departemen', add: 'Tambah Departemen', columns: [['code', 'Kode'], ['name', 'Nama Departemen'], ['head', 'Head of Department'], ['status', 'Status']], fields: [['code', 'Department Code', 'text'], ['name', 'Department Name', 'text'], ['head', 'Head of Department', 'text']] },
  categories: { key: 'categories', title: 'Master Kategori / Kelompok Biaya', add: 'Tambah Kategori', columns: [['name', 'Kategori'], ['group', 'Kelompok Biaya'], ['account', 'Linked Account'], ['status', 'Status']], fields: [['name', 'Category Name', 'text'], ['group', 'Cost Group', 'text'], ['account', 'Linked Account', 'text']] },
  'cash-accounts': { key: 'cashAccounts', title: 'Master Kas / Brankas', add: 'Tambah Kas', columns: [['code', 'Kode'], ['name', 'Nama Kas'], ['type', 'Jenis'], ['location', 'Lokasi'], ['custodian', 'Custodian'], ['status', 'Status']], fields: [['code', 'Cash Code', 'text'], ['name', 'Cash Name', 'text'], ['type', 'Cash Type', 'select', ['Petty Cash', 'Cash', 'Bank']], ['location', 'Location', 'text'], ['custodian', 'Custodian', 'text']] },
  users: { key: 'users', title: 'Master User & Role', add: 'Tambah User', columns: [['name', 'Nama'], ['email', 'Email'], ['role', 'Role'], ['status', 'Status']], fields: [['name', 'Full Name', 'text'], ['email', 'Email', 'email'], ['role', 'Role', 'select', ['Employee', 'Supervisor', 'Manager', 'Cashier', 'Accounting', 'Finance Manager', 'Admin']] ] }
};
const transactionViews = ['petty-topup', 'petty-expenses', 'petty-replenishment', 'cash-in', 'cash-out', 'cash-transfer', 'cash-request'];
const controlViews = ['petty-balance', 'cash-count', 'approval', 'approval-approved', 'approval-rejected'];
const accountingViews = ['accounting', 'accounting-journal', 'cash-book', 'reconciliation'];
const reportViews = ['reports', 'report-petty-cash', 'report-operational-cash', 'report-department', 'report-category', 'report-cash-count'];
const placeholderViews = ['settings-approval', 'settings-imprest'];

function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
function updateSupabaseStatus(status, message) {
  const label = document.querySelector('#supabaseStatus');
  const dot = document.querySelector('#supabaseStatusDot');
  const missingTable = /application_state/i.test(message) && /(schema cache|not found|does not exist)/i.test(message);
  label.textContent = status === 'synced' ? 'Supabase aktif · semua data tersinkron' : status === 'local' ? 'Mode file · data tersimpan lokal' : missingTable ? 'Jalankan SQL setup Supabase' : status === 'error' ? 'Sync gagal · data lokal aman' : message;
  label.title = status === 'local' ? 'Untuk sinkronisasi Supabase, jalankan node backend/app.js.' : status === 'error' ? message : label.textContent;
  dot.style.backgroundColor = status === 'synced' ? '#46c596' : status === 'error' ? '#e66c6c' : '#e5b54f';
  document.body.dataset.supabaseSyncStatus = status;
  const dashboardLabel = document.querySelector('[data-sync-indicator]');
  if (dashboardLabel) dashboardLabel.textContent = status === 'synced' ? '● Supabase tersinkron' : status === 'local' || status === 'error' ? '● LocalStorage aktif' : '● Menyinkronkan Supabase...';
}
window.addEventListener('cashflow:supabase-sync', (event) => updateSupabaseStatus(event.detail.status, event.detail.message));
let supabaseStateReady = false;
let departmentRefreshPending = false;
window.addEventListener('focus', async () => {
  if (!supabaseStateReady || departmentRefreshPending) return;
  departmentRefreshPending = true;
  try {
    if (await refreshDepartmentsFromSupabase(state)) {
      render();
      updateSupabaseStatus('synced', 'Daftar departemen diperbarui dari Supabase');
    }
  } catch (error) {
    updateSupabaseStatus('error', error.message);
  } finally {
    departmentRefreshPending = false;
  }
});
function renderMaster(view) { const item = masterConfig[view]; const rows = state[item.key] || []; return `<div class="section-head"><div><span class="eyebrow">MASTER DATA</span><h2>${item.title}</h2></div><button class="button-primary" data-add="${view}">＋ ${item.add}</button></div><div class="panel"><div class="panel-header"><p>${rows.length} data tersimpan dan tersinkron</p><input class="search-box" data-search="${view}" placeholder="Cari data..."></div><div class="table-wrap"><table class="data-table"><thead><tr>${item.columns.map(([, label]) => `<th>${label}</th>`).join('')}<th>Aksi</th></tr></thead><tbody>${rows.map((row) => `<tr>${item.columns.map(([key]) => `<td>${key === 'status' ? statusBadge(row[key]) : escapeHtml(row[key] ?? '-')}</td>`).join('')}<td><div class="master-actions"><button class="button-secondary" data-edit="${view}" data-id="${row.id}">Edit</button><button class="button-secondary danger-button" type="button" data-delete="${view}" data-id="${row.id}" aria-label="Hapus ${escapeHtml(row.name || row.code || row.id)}">Hapus</button></div></td></tr>`).join('')}</tbody></table></div></div>`; }
async function deleteMasterRecord(view, id) {
  const item = masterConfig[view];
  const rows = state[item.key] || [];
  const record = rows.find((row) => row.id === id);
  if (!record) return;
  const label = record.name || record.code || record.id;
  if (!window.confirm(`Hapus "${label}"? Tindakan ini tidak dapat dibatalkan.`)) return;

  try {
    if (view === 'departments') await deleteDepartment(id);
    state[item.key] = rows.filter((row) => row.id !== id);
    saveState(state);
    showToast(`${label} berhasil dihapus`);
    render(view);
  } catch (error) {
    showToast(`Gagal menghapus ${label}: ${error.message}`);
  }
}
function bindMasterSearch() { appView.querySelectorAll('[data-search]').forEach((input) => input.addEventListener('input', () => { const query = input.value.trim().toLowerCase(); appView.querySelectorAll('.data-table tbody tr').forEach((row) => { row.hidden = query && !row.textContent.toLowerCase().includes(query); }); })); }
function renderPlaceholder(view) { const labels = { 'approval-approved': ['Approved', 'Transaksi yang sudah disetujui akan ditampilkan pada modul Approval.'], 'approval-rejected': ['Rejected', 'Transaksi yang ditolak akan ditampilkan pada modul Approval.'], 'settings-approval': ['Approval Matrix & Threshold Limit', 'Pengaturan approval tersedia pada tahap konfigurasi berikutnya.'], 'settings-imprest': ['Setting Limit Kas', 'Pengaturan imprest system tersedia pada tahap konfigurasi berikutnya.'] }; const [title, description] = labels[view] || ['Modul', 'Modul sedang disiapkan.']; return `<div class="welcome"><div><span class="eyebrow">SYSTEM CONTROL</span><h2>${title}</h2><p>${description}</p></div></div><div class="panel empty-state"><div class="list-icon" style="margin:0 auto 15px">◌</div><strong>Modul belum aktif</strong><p>Struktur menu tetap tersedia untuk konfigurasi berikutnya.</p></div>`; }
function openModal(view, editId) { const item = masterConfig[view]; const existing = editId ? state[item.key].find((row) => row.id === editId) : null; document.querySelector('#modalTitle').textContent = existing ? `Edit ${item.title}` : item.add; document.querySelector('#masterForm').innerHTML = `<div class="form-grid">${item.fields.map(([key, label, type, options]) => `<div class="field"><label for="${key}">${label}</label>${type === 'select' ? `<select id="${key}" name="${key}">${options.map((option) => `<option ${existing?.[key] === option ? 'selected' : ''}>${option}</option>`).join('')}</select>` : `<input id="${key}" name="${key}" type="${type}" value="${escapeHtml(existing?.[key] || '')}" required>`}</div>`).join('')}<div class="form-actions"><button type="button" class="button-secondary" id="cancelModal">Batal</button><button class="button-primary">Simpan</button></div></div>`; const modal = document.querySelector('#modalBackdrop'); modal.hidden = false; document.querySelector('#cancelModal').onclick = () => { modal.hidden = true; }; document.querySelector('#masterForm').onsubmit = (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target).entries()); if (existing) Object.assign(existing, values); else state[item.key].push({ id: createId(view.slice(0, 3).toUpperCase()), status: 'Active', ...values }); saveState(state); modal.hidden = true; showToast(`${item.title} berhasil disimpan`); render(view); }; }
function syncSidebarGroup(view) { navGroups.forEach((group) => { const activeChild = group.querySelector(`[data-view="${view}"]`); group.classList.toggle('is-open', Boolean(activeChild)); group.querySelector('.nav-group-toggle').setAttribute('aria-expanded', activeChild ? 'true' : 'false'); }); }
function render(view = 'dashboard') { pageTitle.textContent = view.replaceAll('-', ' '); navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view)); syncSidebarGroup(view); const accountingView = view === 'accounting' ? 'accounting-journal' : view; const reportView = view === 'reports' ? 'report-petty-cash' : view; appView.innerHTML = view === 'dashboard' ? renderDashboard(state, render) : masterConfig[view] ? renderMaster(view) : transactionViews.includes(view) ? renderTransaction(view, state) : controlViews.includes(view) ? renderControl(view, state) : accountingViews.includes(view) ? renderAccounting(accountingView, state) : reportViews.includes(view) ? renderReports(reportView, state) : placeholderViews.includes(view) ? renderPlaceholder(view) : renderPlaceholder(view); appView.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => render(button.dataset.go); }); appView.querySelectorAll('[data-add]').forEach((button) => { button.onclick = () => openModal(button.dataset.add); }); appView.querySelectorAll('[data-edit]').forEach((button) => { button.onclick = () => openModal(button.dataset.edit, button.dataset.id); }); appView.querySelectorAll('[data-delete]').forEach((button) => { button.onclick = () => deleteMasterRecord(button.dataset.delete, button.dataset.id); }); bindMasterSearch(); if (transactionViews.includes(view)) bindTransaction(view, state, render, showToast); if (controlViews.includes(view)) bindControl(view, state, render, showToast); if (accountingViews.includes(view)) bindAccounting(accountingView, state, render, showToast); if (reportViews.includes(view)) bindReports(reportView, state, render, showToast); }
navGroups.forEach((group) => group.querySelector('.nav-group-toggle').addEventListener('click', () => { const shouldOpen = !group.classList.contains('is-open'); navGroups.forEach((otherGroup) => { otherGroup.classList.remove('is-open'); otherGroup.querySelector('.nav-group-toggle').setAttribute('aria-expanded', 'false'); }); if (shouldOpen) { group.classList.add('is-open'); group.querySelector('.nav-group-toggle').setAttribute('aria-expanded', 'true'); } }));
navItems.forEach((item) => item.addEventListener('click', () => { render(item.dataset.view); document.querySelector('#sidebar').classList.remove('open'); }));
document.querySelector('#menuToggle').onclick = () => document.querySelector('#sidebar').classList.add('open');
document.querySelector('#sidebarClose').onclick = () => document.querySelector('#sidebar').classList.remove('open');
document.querySelector('#modalClose').onclick = () => { document.querySelector('#modalBackdrop').hidden = true; };
document.querySelector('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') event.currentTarget.hidden = true; });
render();
updateSupabaseStatus('syncing', 'Menyinkronkan semua data...');
initializeSupabaseState(state).then(async () => {
  const { rowCount } = await testSupabaseConnection();
  supabaseStateReady = true;
  updateSupabaseStatus('synced', `Supabase terhubung (${rowCount} akun kas)`);
  render();
}).catch((error) => updateSupabaseStatus('error', error.message));
let renderedDate = localDateValue();
setInterval(() => {
  const currentDate = localDateValue();
  if (currentDate === renderedDate) return;
  renderedDate = currentDate;
  if (document.querySelector('[data-current-date]')) render('dashboard');
}, 60000);

    return {  };
  })();
})();
