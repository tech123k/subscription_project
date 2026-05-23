-- ============================================================
-- PHASE 1: SAAS SUBSCRIPTION SYSTEM
-- Run in Supabase SQL Editor
-- BACKWARD COMPATIBLE — existing company data is untouched
-- ============================================================

-- ── 1. Plans ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    VARCHAR(100) NOT NULL,
  code                    VARCHAR(50) UNIQUE NOT NULL,
  description             TEXT,
  monthly_price           NUMERIC(10,2) DEFAULT 0,
  yearly_price            NUMERIC(10,2) DEFAULT 0,
  trial_days              INTEGER DEFAULT 14,
  max_users               INTEGER DEFAULT 5,
  razorpay_monthly_plan_id VARCHAR(100),
  razorpay_yearly_plan_id  VARCHAR(100),
  is_active               BOOLEAN DEFAULT TRUE,
  is_popular              BOOLEAN DEFAULT FALSE,
  features                JSONB DEFAULT '[]',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Modules ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  route       VARCHAR(100),
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Plan → Module mapping ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_modules (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id   UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  UNIQUE (plan_id, module_id)
);

-- ── 4. Company Subscriptions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id               UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id                  UUID REFERENCES plans(id),
  razorpay_subscription_id VARCHAR(100) UNIQUE,
  razorpay_customer_id     VARCHAR(100),
  status                   VARCHAR(20) DEFAULT 'trial'
                             CHECK (status IN ('trial','active','past_due','cancelled','expired','paused')),
  billing_cycle            VARCHAR(10) DEFAULT 'monthly'
                             CHECK (billing_cycle IN ('monthly','yearly')),
  trial_ends_at            TIMESTAMPTZ,
  start_date               DATE,
  expiry_date              DATE,
  next_billing_date        DATE,
  cancelled_at             TIMESTAMPTZ,
  cancel_reason            TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id)
);

-- ── 5. Company Add-on Modules ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_modules (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id  UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  enabled    BOOLEAN DEFAULT TRUE,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  enabled_by UUID,
  UNIQUE (company_id, module_id)
);

-- ── 6. Billing Payments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_payments (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id               UUID NOT NULL REFERENCES companies(id),
  subscription_id          UUID REFERENCES company_subscriptions(id),
  razorpay_payment_id      VARCHAR(100) UNIQUE,
  razorpay_order_id        VARCHAR(100),
  razorpay_subscription_id VARCHAR(100),
  amount                   NUMERIC(10,2) NOT NULL,
  currency                 VARCHAR(10) DEFAULT 'INR',
  status                   VARCHAR(20) DEFAULT 'pending'
                             CHECK (status IN ('pending','captured','failed','refunded')),
  payment_method           VARCHAR(50),
  error_reason             TEXT,
  paid_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Billing Invoices (subscription — not sales invoices) ─────────────────────
CREATE TABLE IF NOT EXISTS billing_invoices (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id           UUID NOT NULL REFERENCES companies(id),
  payment_id           UUID REFERENCES billing_payments(id),
  invoice_number       VARCHAR(50) UNIQUE NOT NULL,
  plan_name            VARCHAR(100),
  billing_cycle        VARCHAR(10),
  billing_period_start DATE,
  billing_period_end   DATE,
  subtotal             NUMERIC(10,2) DEFAULT 0,
  gst_rate             NUMERIC(5,2)  DEFAULT 18,
  gst_amount           NUMERIC(10,2) DEFAULT 0,
  total_amount         NUMERIC(10,2) DEFAULT 0,
  pdf_url              TEXT,
  status               VARCHAR(20) DEFAULT 'issued',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. Invoice counter ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_invoice_counter (
  last_number INTEGER DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO billing_invoice_counter (last_number) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM billing_invoice_counter);

-- ── Indexes ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_company_subs_company  ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subs_status   ON company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_company_subs_expiry   ON company_subscriptions(expiry_date);
CREATE INDEX IF NOT EXISTS idx_company_modules_co    ON company_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_pay_company   ON billing_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_pay_rzp       ON billing_payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_inv_company   ON billing_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_plan_modules_plan     ON plan_modules(plan_id);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Modules
INSERT INTO modules (code, name, description, icon, route, sort_order) VALUES
  ('dashboard',  'Dashboard',   'Overview and KPIs',               'LayoutDashboard', '/dashboard',           1),
  ('inventory',  'Inventory',   'Materials, GRN, Purchase Orders', 'Package',         '/materials',           2),
  ('warehouses', 'Warehouses',  'Warehouse & stock management',    'Warehouse',       '/warehouses',          3),
  ('production', 'Production',  'Manufacturing orders & BOM',      'Factory',         '/production',          4),
  ('sales',      'Sales',       'Sales orders & customers',        'ShoppingCart',    '/sales-orders',        5),
  ('dispatch',   'Dispatch',    'Dispatch & delivery tracking',    'Truck',           '/dispatches',          6),
  ('accounting', 'Accounting',  'Double-entry bookkeeping',        'Calculator',      '/accounting/accounts', 7),
  ('reports',    'Reports',     'Business reports & analytics',    'BarChart3',       '/reports',             8)
ON CONFLICT (code) DO NOTHING;

-- Plans
INSERT INTO plans (name, code, description, monthly_price, yearly_price, trial_days, max_users, is_popular, features) VALUES
  (
    'Starter', 'starter',
    'For small manufacturers getting started',
    999, 9990, 14, 5, FALSE,
    '["Inventory Management","Purchase Orders","GRN / Inward","Basic Reports","Up to 2 Warehouses","5 Users"]'::jsonb
  ),
  (
    'Growth', 'growth',
    'For growing businesses needing full operations',
    2499, 24990, 14, 20, TRUE,
    '["Everything in Starter","Production Orders & BOM","Sales Orders","Dispatch Tracking","Advanced Reports","Unlimited Warehouses","20 Users"]'::jsonb
  ),
  (
    'Enterprise', 'enterprise',
    'Complete ERP suite for large operations',
    4999, 49990, 14, -1, FALSE,
    '["Everything in Growth","Double-Entry Accounting","GST Reports","Priority Support","Unlimited Users","Dedicated Account Manager"]'::jsonb
  )
ON CONFLICT (code) DO NOTHING;

-- Plan → Module assignments
DO $$
DECLARE
  v_starter    UUID;
  v_growth     UUID;
  v_enterprise UUID;
  v_module_id  UUID;
BEGIN
  SELECT id INTO v_starter    FROM plans WHERE code = 'starter';
  SELECT id INTO v_growth     FROM plans WHERE code = 'growth';
  SELECT id INTO v_enterprise FROM plans WHERE code = 'enterprise';

  -- Starter: dashboard + inventory + reports
  FOR v_module_id IN
    SELECT id FROM modules WHERE code IN ('dashboard','inventory','reports')
  LOOP
    INSERT INTO plan_modules (plan_id, module_id) VALUES (v_starter, v_module_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Growth: + warehouses + production + sales + dispatch
  FOR v_module_id IN
    SELECT id FROM modules WHERE code IN ('dashboard','inventory','warehouses','production','sales','dispatch','reports')
  LOOP
    INSERT INTO plan_modules (plan_id, module_id) VALUES (v_growth, v_module_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Enterprise: all modules
  FOR v_module_id IN SELECT id FROM modules LOOP
    INSERT INTO plan_modules (plan_id, module_id) VALUES (v_enterprise, v_module_id) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'plans'                 AS tbl, COUNT(*) FROM plans           UNION ALL
SELECT 'modules',                        COUNT(*) FROM modules          UNION ALL
SELECT 'plan_modules',                   COUNT(*) FROM plan_modules     UNION ALL
SELECT 'company_subscriptions',          COUNT(*) FROM company_subscriptions UNION ALL
SELECT 'billing_payments',               COUNT(*) FROM billing_payments UNION ALL
SELECT 'billing_invoices',               COUNT(*) FROM billing_invoices;
