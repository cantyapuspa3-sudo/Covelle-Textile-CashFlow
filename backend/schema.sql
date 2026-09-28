-- =========================================================
-- CASHFLOW - PT COVELLE TEXTILE
-- Supabase Database
-- =========================================================

create extension if not exists "pgcrypto";


-- =========================================================
-- 1. ROLES
-- =========================================================

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    name varchar(50) not null unique,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);


-- =========================================================
-- 2. DEPARTMENTS
-- =========================================================

create table if not exists public.departments (
    id varchar(50) primary key,
    code varchar(20) not null unique,
    name varchar(100) not null unique,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- 3. PROFILES / USERS
-- =========================================================

create table if not exists public.profiles (
    id varchar(50) primary key,
    role_id varchar(50),
    department_id varchar(50),
    employee_code varchar(50),
    full_name varchar(150) not null,
    email varchar(150),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_profiles_role
        foreign key (role_id)
        references public.roles(id),

    constraint fk_profiles_department
        foreign key (department_id)
        references public.departments(id)
);


-- =========================================================
-- 4. CHART OF ACCOUNTS
-- =========================================================

create table if not exists public.chart_of_accounts (
    id varchar(50) primary key,
    account_code varchar(30) not null unique,
    account_name varchar(150) not null,
    account_type varchar(30) not null,
    parent_id varchar(50),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_coa_parent
        foreign key (parent_id)
        references public.chart_of_accounts(id),

    constraint chk_coa_type
        check (
            account_type in (
                'Asset',
                'Liability',
                'Equity',
                'Revenue',
                'Expense'
            )
        )
);


-- =========================================================
-- 5. CATEGORIES
-- =========================================================

create table if not exists public.categories (
    id varchar(50) primary key,
    code varchar(30) unique,
    name varchar(100) not null unique,
    category_type varchar(100),
    account_id varchar(50),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_categories_account
        foreign key (account_id)
        references public.chart_of_accounts(id)
);


-- =========================================================
-- 6. CASH ACCOUNTS
-- =========================================================

create table if not exists public.cash_accounts (
    id varchar(50) primary key,
    code varchar(30) not null unique,
    name varchar(150) not null unique,

    account_type varchar(30) not null,

    location varchar(150),
    custodian varchar(150),

    opening_balance numeric(18,2) not null default 0,
    minimum_balance numeric(18,2) not null default 0,
    maximum_balance numeric(18,2) not null default 0,

    is_active boolean not null default true,

    coa_id varchar(50),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_cash_coa
        foreign key (coa_id)
        references public.chart_of_accounts(id),

    constraint chk_cash_type
        check (
            account_type in (
                'Petty Cash',
                'Cash',
                'Bank'
            )
        )
);


-- =========================================================
-- 7. TRANSACTIONS
-- Semua transaksi aplikasi disimpan dalam satu tabel
-- =========================================================

create table if not exists public.transactions (
    id varchar(100) primary key,

    type varchar(50) not null,

    transaction_date date not null,

    source_cash_account_id varchar(50),
    cash_account_id varchar(50),

    department varchar(100),
    category varchar(100),

    vendor varchar(150),

    requester varchar(150),
    required_date date,

    amount numeric(18,2) not null default 0,

    description text,

    status varchar(30) not null default 'Pending',

    created_by varchar(150),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint fk_transaction_source_cash
        foreign key (source_cash_account_id)
        references public.cash_accounts(id),

    constraint fk_transaction_cash
        foreign key (cash_account_id)
        references public.cash_accounts(id),

    constraint chk_transaction_type
        check (
            type in (
                'petty-topup',
                'petty-expense',
                'petty-replenishment',
                'cash-in',
                'cash-out',
                'cash-transfer',
                'cash-request'
            )
        ),

    constraint chk_transaction_status
        check (
            status in (
                'Pending',
                'Approved',
                'Posted',
                'Rejected',
                'Revision Requested',
                'Submitted'
            )
        ),

    constraint chk_transaction_amount
        check (amount >= 0)
);


-- =========================================================
-- 8. APPROVALS
-- =========================================================

create table if not exists public.approvals (
    id uuid primary key default gen_random_uuid(),

    transaction_id varchar(100) not null,

    approver_id varchar(50),

    approval_level integer not null default 1,

    action varchar(30) not null default 'Pending',

    notes text,

    approved_at timestamptz,

    created_at timestamptz not null default now(),

    constraint fk_approval_transaction
        foreign key (transaction_id)
        references public.transactions(id)
        on delete cascade,

    constraint fk_approval_user
        foreign key (approver_id)
        references public.profiles(id),

    constraint chk_approval_action
        check (
            action in (
                'Pending',
                'Approved',
                'Rejected',
                'Revision Requested'
            )
        )
);


-- =========================================================
-- 9. CASH COUNTS
-- =========================================================

create table if not exists public.cash_counts (
    id varchar(100) primary key,

    count_date date not null,

    cash_account_id varchar(50) not null,

    cash_account_name varchar(150),

    physical_cash numeric(18,2) not null default 0,

    system_balance numeric(18,2) not null default 0,

    difference numeric(18,2) not null default 0,

    counted_by varchar(150),

    count_notes text,

    status varchar(30) not null,

    created_at timestamptz not null default now(),

    constraint fk_cash_count_account
        foreign key (cash_account_id)
        references public.cash_accounts(id),

    constraint chk_cash_count_status
        check (
            status in (
                'Balanced',
                'Ada Selisih'
            )
        )
);


-- =========================================================
-- 10. JOURNAL HEADER
-- =========================================================

create table if not exists public.journal_entries (
    id uuid primary key default gen_random_uuid(),

    journal_number varchar(100) not null unique,

    journal_date date not null,

    reference_number varchar(100),

    source_transaction varchar(100),

    description text,

    created_by varchar(150),

    created_at timestamptz not null default now(),

    constraint fk_journal_transaction
        foreign key (source_transaction)
        references public.transactions(id)
);


-- =========================================================
-- 11. JOURNAL LINES
-- =========================================================

create table if not exists public.journal_lines (
    id uuid primary key default gen_random_uuid(),

    journal_id uuid not null,

    account_id varchar(50) not null,

    description text,

    debit numeric(18,2) not null default 0,

    credit numeric(18,2) not null default 0,

    created_at timestamptz not null default now(),

    constraint fk_journal_line_header
        foreign key (journal_id)
        references public.journal_entries(id)
        on delete cascade,

    constraint fk_journal_line_account
        foreign key (account_id)
        references public.chart_of_accounts(id),

    constraint chk_debit_credit
        check (
            debit >= 0
            and credit >= 0
            and not (debit > 0 and credit > 0)
        )
);


-- =========================================================
-- 12. APPROVAL MATRIX
-- =========================================================

create table if not exists public.approval_matrix (
    id uuid primary key default gen_random_uuid(),

    minimum_amount numeric(18,2) not null default 0,

    maximum_amount numeric(18,2),

    role_name varchar(100) not null,

    is_active boolean not null default true,

    created_at timestamptz not null default now()
);


-- =========================================================
-- 13. IMPREST SETTINGS
-- =========================================================

create table if not exists public.imprest_settings (
    id uuid primary key default gen_random_uuid(),

    petty_fund numeric(18,2) not null,

    minimum_balance numeric(18,2) not null,

    maximum_balance numeric(18,2) not null,

    replenishment_threshold numeric(18,2) not null,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


-- =========================================================
-- INDEX
-- =========================================================

create index if not exists idx_transactions_date
on public.transactions(transaction_date);

create index if not exists idx_transactions_type
on public.transactions(type);

create index if not exists idx_transactions_status
on public.transactions(status);

create index if not exists idx_transactions_cash_account
on public.transactions(cash_account_id);

create index if not exists idx_transactions_department
on public.transactions(department);

create index if not exists idx_transactions_category
on public.transactions(category);

create index if not exists idx_approvals_transaction
on public.approvals(transaction_id);

create index if not exists idx_cash_counts_date
on public.cash_counts(count_date);

create index if not exists idx_journal_date
on public.journal_entries(journal_date);

create index if not exists idx_journal_source
on public.journal_entries(source_transaction);


-- =========================================================
-- SEED ROLES
-- =========================================================

insert into public.roles
    (id, name, description)
values
    ('ROLE-FIN', 'Finance', 'Finance'),
    ('ROLE-SUP', 'Supervisor', 'Supervisor'),
    ('ROLE-MGR', 'Manager', 'Manager'),
    ('ROLE-ACC', 'Accounting', 'Accounting'),
    ('ROLE-CASH', 'Cashier', 'Cashier'),
    ('ROLE-FM', 'Finance Manager', 'Finance Manager')
on conflict (id) do nothing;


-- =========================================================
-- SEED DEPARTMENTS
-- =========================================================

insert into public.departments
    (id, code, name, description)
values
    ('DEP-001', 'PRD', 'Produksi', 'Rina Pratiwi'),
    ('DEP-002', 'MTC', 'Maintenance', 'Dimas Saputra'),
    ('DEP-003', 'WH', 'Warehouse', 'Agus Setiawan'),
    ('DEP-004', 'QC', 'Quality Control', 'Maya Lestari'),
    ('DEP-005', 'HGA', 'HR & GA', 'Sari Wulandari'),
    ('DEP-006', 'FIN', 'Finance', 'Cantya Puspa'),
    ('DEP-007', 'ACC', 'Accounting', 'Budi Hartono')
on conflict (id) do nothing;


-- =========================================================
-- SEED COA
-- =========================================================

insert into public.chart_of_accounts
    (id, account_code, account_name, account_type, parent_id)
values
    ('COA-001', '1101', 'Cash', 'Asset', null),
    ('COA-002', '1102', 'Petty Cash', 'Asset', 'COA-001'),
    ('COA-003', '1103', 'Bank', 'Asset', 'COA-001'),
    ('COA-005', '2101', 'Accounts Payable', 'Liability', null),
    ('COA-006', '5101', 'Beban ATK', 'Expense', null),
    ('COA-007', '5102', 'Beban Maintenance', 'Expense', null),
    ('COA-008', '5103', 'Beban Transportasi', 'Expense', null),
    ('COA-009', '5104', 'Beban Konsumsi', 'Expense', null),
    ('COA-010', '5105', 'Beban Utility', 'Expense', null)
on conflict (id) do nothing;


-- =========================================================
-- SEED CATEGORIES
-- =========================================================

insert into public.categories
    (id, code, name, category_type, account_id)
values
    ('CAT-001', 'CAT-001', 'ATK', 'Office', 'COA-006'),
    ('CAT-002', 'CAT-002', 'Maintenance Mesin', 'Maintenance', 'COA-007'),
    ('CAT-003', 'CAT-003', 'Sparepart', 'Maintenance', 'COA-007'),
    ('CAT-004', 'CAT-004', 'Transportasi', 'Operational', 'COA-008'),
    ('CAT-005', 'CAT-005', 'Konsumsi', 'Employee Welfare', 'COA-009'),
    ('CAT-006', 'CAT-006', 'Utility', 'Facility', 'COA-010'),
    ('CAT-007', 'CAT-007', 'Pengiriman', 'Logistics', 'COA-008')
on conflict (id) do nothing;


-- =========================================================
-- SEED CASH ACCOUNTS
-- =========================================================

insert into public.cash_accounts
    (
        id,
        code,
        name,
        account_type,
        location,
        custodian,
        opening_balance,
        minimum_balance,
        maximum_balance,
        coa_id
    )
values
    (
        'CASH-001',
        'PC-001',
        'Petty Cash Finance',
        'Petty Cash',
        'Finance Room',
        'Cantya Puspa',
        5000000,
        1500000,
        5000000,
        'COA-002'
    ),
    (
        'CASH-002',
        'CS-001',
        'Kas Operasional Pabrik',
        'Cash',
        'Cashier Room',
        'Cashier',
        12500000,
        3000000,
        20000000,
        'COA-001'
    ),
    (
        'CASH-003',
        'BNK-001',
        'Bank Operasional',
        'Bank',
        'Bank Account',
        'Finance Manager',
        85000000,
        0,
        0,
        'COA-003'
    )
on conflict (id) do nothing;


-- =========================================================
-- SEED USERS / PROFILES
-- =========================================================

insert into public.profiles
    (
        id,
        role_id,
        department_id,
        employee_code,
        full_name,
        email
    )
values
    (
        'USR-001',
        'ROLE-FIN',
        'DEP-006',
        'finance.admin@kasflow.local',
        'Cantya Puspa',
        'finance.admin@kasflow.local'
    ),
    (
        'USR-002',
        'ROLE-SUP',
        'DEP-002',
        'dimas@kasflow.local',
        'Dimas Saputra',
        'dimas@kasflow.local'
    ),
    (
        'USR-003',
        'ROLE-ACC',
        'DEP-007',
        'budi@kasflow.local',
        'Budi Hartono',
        'budi@kasflow.local'
    ),
    (
        'USR-004',
        'ROLE-CASH',
        'DEP-006',
        'cashier@kasflow.local',
        'Cashier Pabrik',
        'cashier@kasflow.local'
    )
on conflict (id) do nothing;


-- =========================================================
-- SEED APPROVAL MATRIX
-- =========================================================

insert into public.approval_matrix
    (minimum_amount, maximum_amount, role_name)
values
    (0, 500000, 'Supervisor'),
    (500001, 5000000, 'Manager'),
    (5000001, null, 'Finance Manager');


-- =========================================================
-- SEED IMPREST SETTINGS
-- =========================================================

insert into public.imprest_settings
    (
        petty_fund,
        minimum_balance,
        maximum_balance,
        replenishment_threshold
    )
values
    (
        5000000,
        1500000,
        5000000,
        1500000
    );


-- =========================================================
-- ENABLE RLS
-- =========================================================

alter table public.roles enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.categories enable row level security;
alter table public.cash_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.approvals enable row level security;
alter table public.cash_counts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.approval_matrix enable row level security;
alter table public.imprest_settings enable row level security;


-- =========================================================
-- DEVELOPMENT POLICY
-- Untuk tahap development aplikasi.
-- Nanti sebaiknya diperketat menggunakan auth.uid().
-- =========================================================

create policy "dev read roles"
on public.roles for select
to anon, authenticated
using (true);

create policy "dev read departments"
on public.departments for select
to anon, authenticated
using (true);

create policy "dev read profiles"
on public.profiles for select
to anon, authenticated
using (true);

create policy "dev read coa"
on public.chart_of_accounts for select
to anon, authenticated
using (true);

create policy "dev read categories"
on public.categories for select
to anon, authenticated
using (true);

create policy "dev read cash accounts"
on public.cash_accounts for select
to anon, authenticated
using (true);

create policy "dev read transactions"
on public.transactions for select
to anon, authenticated
using (true);

create policy "dev insert transactions"
on public.transactions for insert
to anon, authenticated
with check (true);

create policy "dev update transactions"
on public.transactions for update
to anon, authenticated
using (true)
with check (true);

create policy "dev read approvals"
on public.approvals for select
to anon, authenticated
using (true);

create policy "dev insert approvals"
on public.approvals for insert
to anon, authenticated
with check (true);

create policy "dev update approvals"
on public.approvals for update
to anon, authenticated
using (true)
with check (true);

create policy "dev read cash counts"
on public.cash_counts for select
to anon, authenticated
using (true);

create policy "dev insert cash counts"
on public.cash_counts for insert
to anon, authenticated
with check (true);

create policy "dev read journals"
on public.journal_entries for select
to anon, authenticated
using (true);

create policy "dev read journal lines"
on public.journal_lines for select
to anon, authenticated
using (true);

create policy "dev read approval matrix"
on public.approval_matrix for select
to anon, authenticated
using (true);

create policy "dev read imprest settings"
on public.imprest_settings for select
to anon, authenticated
using (true);