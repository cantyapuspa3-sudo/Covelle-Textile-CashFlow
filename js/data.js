export const STORAGE_KEY = 'kasflow-state-v1';

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

export function loadState() {
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
export function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function createId(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}`; }
