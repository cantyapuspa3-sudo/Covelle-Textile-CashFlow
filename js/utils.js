export const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
export const formatDate = (value) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
export const localDateValue = (date = new Date()) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
export const getMonthTransactions = (transactions, date = new Date()) => transactions.filter((transaction) => transaction.date?.slice(0, 7) === localDateValue(date).slice(0, 7));
export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
export const monthKey = (value) => value.slice(0, 7);
export const statusBadge = (status) => `<span class="status ${String(status).toLowerCase()}">${escapeHtml(status)}</span>`;
