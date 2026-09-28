import { escapeHtml, formatCurrency, getMonthTransactions, localDateValue } from './utils.js';
import { calculateBalance } from './transactions.js';

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
export function renderDashboard(state, navigate) {
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
  return `<section class="welcome"><div><span class="eyebrow" data-current-date>${todayLabel}</span><h2>Selamat datang, ${escapeHtml(state.currentUser.name)}</h2><p>Ringkasan kendali kas operasional pabrik hari ini.</p></div><div class="date-pill">● LocalStorage aktif</div></section>
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
