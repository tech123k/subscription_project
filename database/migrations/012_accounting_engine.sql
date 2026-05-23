-- ============================================================
-- PHASE 1: DOUBLE-ENTRY ACCOUNTING ENGINE
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Account Groups (hierarchy: Assets, Liabilities, Equity, Income, Expenses) ──
CREATE TABLE IF NOT EXISTS account_groups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  parent_group_id UUID REFERENCES account_groups(id),
  nature          VARCHAR(6)  NOT NULL CHECK (nature IN ('debit', 'credit')),
  sequence_no     INTEGER DEFAULT 0,
  is_system       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ledger Masters ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_group_id      UUID NOT NULL REFERENCES account_groups(id),
  name                  VARCHAR(255) NOT NULL,
  code                  VARCHAR(50),
  account_type          VARCHAR(20) NOT NULL CHECK (account_type IN (
                          'cash','bank','debtor','creditor','income','expense',
                          'stock','duty_tax','capital','loan','fixed_asset','other'
                        )),
  opening_balance       NUMERIC(15,2) DEFAULT 0,
  opening_balance_type  VARCHAR(6) DEFAULT 'debit' CHECK (opening_balance_type IN ('debit','credit')),
  gst_applicable        BOOLEAN DEFAULT FALSE,
  gstin                 VARCHAR(20),
  is_system             BOOLEAN DEFAULT FALSE,
  is_active             BOOLEAN DEFAULT TRUE,
  notes                 TEXT,
  created_by            UUID,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Voucher Number Sequences (per company, per voucher type) ────────────────────
CREATE TABLE IF NOT EXISTS voucher_sequences (
  company_id    UUID   NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_type  VARCHAR(20) NOT NULL,
  prefix        VARCHAR(10) DEFAULT '',
  last_number   INTEGER DEFAULT 0,
  PRIMARY KEY (company_id, voucher_type)
);

-- ── Vouchers (header) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_type     VARCHAR(20) NOT NULL CHECK (voucher_type IN (
                     'payment','receipt','journal','contra',
                     'sales','purchase','debit_note','credit_note'
                   )),
  voucher_number   VARCHAR(50) NOT NULL,
  voucher_date     DATE NOT NULL,
  narration        TEXT,
  reference_number VARCHAR(100),
  reference_type   VARCHAR(50),
  reference_id     UUID,
  status           VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','posted','cancelled')),
  total_amount     NUMERIC(15,2) DEFAULT 0,
  created_by       UUID,
  approved_by      UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, voucher_number)
);

-- ── Voucher Entries (Dr/Cr lines) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voucher_entries (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id     UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  company_id     UUID NOT NULL REFERENCES companies(id),
  account_id     UUID NOT NULL REFERENCES accounts(id),
  entry_type     VARCHAR(6) NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount         NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  gst_type       VARCHAR(5) CHECK (gst_type IN ('cgst','sgst','igst','none',NULL)),
  gst_rate       NUMERIC(5,2) DEFAULT 0,
  gst_amount     NUMERIC(15,2) DEFAULT 0,
  bill_reference VARCHAR(100),
  cost_center    VARCHAR(100),
  narration      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── GST Tax Rates Master ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_tax_rates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  rate         NUMERIC(5,2) NOT NULL,
  cgst_rate    NUMERIC(5,2) DEFAULT 0,
  sgst_rate    NUMERIC(5,2) DEFAULT 0,
  igst_rate    NUMERIC(5,2) DEFAULT 0,
  hsn_sac_code VARCHAR(20),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bank Accounts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  bank_name      VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  ifsc_code      VARCHAR(20),
  branch         VARCHAR(255),
  account_type   VARCHAR(10) DEFAULT 'current' CHECK (account_type IN ('savings','current','cc','od')),
  is_primary     BOOLEAN DEFAULT FALSE,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_account_groups_company   ON account_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company         ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_group           ON accounts(account_group_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type            ON accounts(company_id, account_type);
CREATE INDEX IF NOT EXISTS idx_vouchers_company_date    ON vouchers(company_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_type            ON vouchers(company_id, voucher_type);
CREATE INDEX IF NOT EXISTS idx_vouchers_status          ON vouchers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_voucher_entries_voucher  ON voucher_entries(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_entries_account  ON voucher_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_voucher_entries_company  ON voucher_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_gst_tax_rates_company    ON gst_tax_rates(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company    ON bank_accounts(company_id);

-- ── Default GST Rates (system-level, company_id = NULL means global defaults) ───
-- Companies can insert their own rates too
-- (These are inserted per company via the init endpoint)

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT
  'account_groups'   AS tbl, COUNT(*) FROM account_groups  UNION ALL
SELECT 'accounts',           COUNT(*) FROM accounts         UNION ALL
SELECT 'vouchers',           COUNT(*) FROM vouchers         UNION ALL
SELECT 'voucher_entries',    COUNT(*) FROM voucher_entries  UNION ALL
SELECT 'gst_tax_rates',      COUNT(*) FROM gst_tax_rates   UNION ALL
SELECT 'bank_accounts',      COUNT(*) FROM bank_accounts;
