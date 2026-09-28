import { saveState } from './data.js';
import { escapeHtml, formatCurrency, formatDate, statusBadge } from './utils.js';

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

export function renderReports(view, state) {
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

export function bindReports(view, state, render, showToast) {
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
