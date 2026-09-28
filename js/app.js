import { createId, initializeSupabaseState, loadState, saveState } from './data.js';
import { escapeHtml, localDateValue, statusBadge } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { bindTransaction, renderTransaction } from './transactions.js';
import { bindControl, renderControl } from './control.js';
import { bindAccounting, renderAccounting } from './accounting.js?v=3';
import { bindReports, renderReports } from './reports.js';

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
function updateSupabaseStatus(syncStatus, message) {
  const status = document.querySelector('#supabaseStatus');
  const statusDot = document.querySelector('#supabaseStatusDot');
  document.body.dataset.supabaseSyncStatus = syncStatus;
  const missingStateTable = syncStatus === 'error' && /application_state/i.test(message) && /(schema cache|not found|does not exist)/i.test(message);
  status.textContent = syncStatus === 'synced' ? 'Supabase aktif · semua data tersinkron' : missingStateTable ? 'Jalankan SQL setup Supabase' : syncStatus === 'error' ? 'Sync gagal · data lokal aman' : message;
  status.title = syncStatus === 'error' ? message : status.textContent;
  statusDot.style.backgroundColor = syncStatus === 'synced' ? '#46c596' : syncStatus === 'error' ? '#e66c6c' : '#e5b54f';
  const dashboardStatus = document.querySelector('[data-sync-indicator]');
  if (dashboardStatus) dashboardStatus.textContent = syncStatus === 'synced' ? '● Supabase tersinkron' : syncStatus === 'error' ? '● Cache lokal aktif' : '● Menyinkronkan Supabase...';
}
window.addEventListener('cashflow:supabase-sync', (event) => updateSupabaseStatus(event.detail.status, event.detail.message));
function renderMaster(view) { const item = masterConfig[view]; const rows = state[item.key] || []; return `<div class="section-head"><div><span class="eyebrow">MASTER DATA</span><h2>${item.title}</h2></div><button class="button-primary" data-add="${view}">＋ ${item.add}</button></div><div class="panel"><div class="panel-header"><p>${rows.length} data terdaftar dan tersimpan di LocalStorage</p><input class="search-box" data-search="${view}" placeholder="Cari data..."></div><div class="table-wrap"><table class="data-table"><thead><tr>${item.columns.map(([, label]) => `<th>${label}</th>`).join('')}<th>Aksi</th></tr></thead><tbody>${rows.map((row) => `<tr>${item.columns.map(([key]) => `<td>${key === 'status' ? statusBadge(row[key]) : escapeHtml(row[key] ?? '-')}</td>`).join('')}<td><button class="button-secondary" data-edit="${view}" data-id="${row.id}">Edit</button></td></tr>`).join('')}</tbody></table></div></div>`; }
function bindMasterSearch() { appView.querySelectorAll('[data-search]').forEach((input) => input.addEventListener('input', () => { const query = input.value.trim().toLowerCase(); appView.querySelectorAll('.data-table tbody tr').forEach((row) => { row.hidden = query && !row.textContent.toLowerCase().includes(query); }); })); }
function renderPlaceholder(view) { const labels = { 'approval-approved': ['Approved', 'Transaksi yang sudah disetujui akan ditampilkan pada modul Approval.'], 'approval-rejected': ['Rejected', 'Transaksi yang ditolak akan ditampilkan pada modul Approval.'], 'settings-approval': ['Approval Matrix & Threshold Limit', 'Pengaturan approval tersedia pada tahap konfigurasi berikutnya.'], 'settings-imprest': ['Setting Limit Kas', 'Pengaturan imprest system tersedia pada tahap konfigurasi berikutnya.'] }; const [title, description] = labels[view] || ['Modul', 'Modul sedang disiapkan.']; return `<div class="welcome"><div><span class="eyebrow">SYSTEM CONTROL</span><h2>${title}</h2><p>${description}</p></div></div><div class="panel empty-state"><div class="list-icon" style="margin:0 auto 15px">◌</div><strong>Modul belum aktif</strong><p>Struktur menu tetap tersedia untuk konfigurasi berikutnya.</p></div>`; }
function openModal(view, editId) { const item = masterConfig[view]; const existing = editId ? state[item.key].find((row) => row.id === editId) : null; document.querySelector('#modalTitle').textContent = existing ? `Edit ${item.title}` : item.add; document.querySelector('#masterForm').innerHTML = `<div class="form-grid">${item.fields.map(([key, label, type, options]) => `<div class="field"><label for="${key}">${label}</label>${type === 'select' ? `<select id="${key}" name="${key}">${options.map((option) => `<option ${existing?.[key] === option ? 'selected' : ''}>${option}</option>`).join('')}</select>` : `<input id="${key}" name="${key}" type="${type}" value="${escapeHtml(existing?.[key] || '')}" required>`}</div>`).join('')}<div class="form-actions"><button type="button" class="button-secondary" id="cancelModal">Batal</button><button class="button-primary">Simpan</button></div></div>`; const modal = document.querySelector('#modalBackdrop'); modal.hidden = false; document.querySelector('#cancelModal').onclick = () => { modal.hidden = true; }; document.querySelector('#masterForm').onsubmit = (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target).entries()); if (existing) Object.assign(existing, values); else state[item.key].push({ id: createId(view.slice(0, 3).toUpperCase()), status: 'Active', ...values }); saveState(state); modal.hidden = true; showToast(`${item.title} berhasil disimpan`); render(view); }; }
function syncSidebarGroup(view) { navGroups.forEach((group) => { const activeChild = group.querySelector(`[data-view="${view}"]`); group.classList.toggle('is-open', Boolean(activeChild)); group.querySelector('.nav-group-toggle').setAttribute('aria-expanded', activeChild ? 'true' : 'false'); }); }
function render(view = 'dashboard') { pageTitle.textContent = view.replaceAll('-', ' '); navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view)); syncSidebarGroup(view); const accountingView = view === 'accounting' ? 'accounting-journal' : view; const reportView = view === 'reports' ? 'report-petty-cash' : view; appView.innerHTML = view === 'dashboard' ? renderDashboard(state, render) : masterConfig[view] ? renderMaster(view) : transactionViews.includes(view) ? renderTransaction(view, state) : controlViews.includes(view) ? renderControl(view, state) : accountingViews.includes(view) ? renderAccounting(accountingView, state) : reportViews.includes(view) ? renderReports(reportView, state) : placeholderViews.includes(view) ? renderPlaceholder(view) : renderPlaceholder(view); appView.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => render(button.dataset.go); }); appView.querySelectorAll('[data-add]').forEach((button) => { button.onclick = () => openModal(button.dataset.add); }); appView.querySelectorAll('[data-edit]').forEach((button) => { button.onclick = () => openModal(button.dataset.edit, button.dataset.id); }); bindMasterSearch(); if (transactionViews.includes(view)) bindTransaction(view, state, render, showToast); if (controlViews.includes(view)) bindControl(view, state, render, showToast); if (accountingViews.includes(view)) bindAccounting(accountingView, state, render, showToast); if (reportViews.includes(view)) bindReports(reportView, state, render, showToast); }
navGroups.forEach((group) => group.querySelector('.nav-group-toggle').addEventListener('click', () => { const shouldOpen = !group.classList.contains('is-open'); navGroups.forEach((otherGroup) => { otherGroup.classList.remove('is-open'); otherGroup.querySelector('.nav-group-toggle').setAttribute('aria-expanded', 'false'); }); if (shouldOpen) { group.classList.add('is-open'); group.querySelector('.nav-group-toggle').setAttribute('aria-expanded', 'true'); } }));
navItems.forEach((item) => item.addEventListener('click', () => { render(item.dataset.view); document.querySelector('#sidebar').classList.remove('open'); }));
document.querySelector('#menuToggle').onclick = () => document.querySelector('#sidebar').classList.add('open');
document.querySelector('#sidebarClose').onclick = () => document.querySelector('#sidebar').classList.remove('open');
document.querySelector('#modalClose').onclick = () => { document.querySelector('#modalBackdrop').hidden = true; };
document.querySelector('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') event.currentTarget.hidden = true; });
render();
updateSupabaseStatus('syncing', 'Menyinkronkan semua data...');
initializeSupabaseState(state).then(() => {
  render();
  updateSupabaseStatus('synced', 'Seluruh data tersinkron ke Supabase');
}).catch((error) => updateSupabaseStatus('error', error.message));
let renderedDate = localDateValue();
setInterval(() => {
  const currentDate = localDateValue();
  if (currentDate === renderedDate) return;
  renderedDate = currentDate;
  if (document.querySelector('[data-current-date]')) render('dashboard');
}, 60000);
