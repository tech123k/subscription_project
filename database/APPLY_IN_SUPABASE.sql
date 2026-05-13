-- ============================================================
-- APPLY THIS IN SUPABASE SQL EDITOR
-- ============================================================
-- Open: https://supabase.com → your project → SQL Editor → New query
-- Paste the entire file → Run
--
-- This is a SINGLE idempotent script that applies every Phase 1
-- schema change.  You can run it multiple times safely.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- STEP 0: Extensions & updated_at trigger function
-- ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ──────────────────────────────────────────────────────────────
-- STEP 1: Fix runtime bugs on existing tables
-- ──────────────────────────────────────────────────────────────

-- BUG-1  sales_order_items.material_id was NOT NULL.
--        OMS inserts product-only items with material_id = NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_order_items'
      AND column_name = 'material_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sales_order_items ALTER COLUMN material_id DROP NOT NULL;
  END IF;
END $$;

-- BUG-2  sales_order_items.unit was material_unit ENUM.
--        OMS form sends free strings ('pairs', 'pcs', 'box', etc.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_order_items'
      AND column_name = 'unit'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE sales_order_items ALTER COLUMN unit TYPE VARCHAR(50) USING unit::text;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- STEP 2: Add columns to existing tables
-- ──────────────────────────────────────────────────────────────

-- companies: SO numbering
ALTER TABLE companies ADD COLUMN IF NOT EXISTS so_prefix  VARCHAR(20) NOT NULL DEFAULT 'SO';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS so_counter INTEGER     NOT NULL DEFAULT 1;

-- products: FG stock ledger
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_stock              DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock             DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS produced_qty               DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dispatched_qty             DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_production_date       TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants               BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_prefix                 VARCHAR(30);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url                  TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_rate                  DECIMAL(15,2)          DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code                   VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_percent                DECIMAL(5,2)           DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS finished_goods_material_id UUID REFERENCES materials(id);

DO $$
BEGIN
  ALTER TABLE products ADD CONSTRAINT chk_products_stock_nonneg
    CHECK (current_stock >= 0 AND reserved_stock >= 0
           AND produced_qty >= 0 AND dispatched_qty >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- sales_orders: OMS columns (BUG-3 FIX: warehouse_id)
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS channel             VARCHAR(50)  DEFAULT 'direct';
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS warehouse_id        UUID         REFERENCES warehouses(id);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS backorder_of        UUID         REFERENCES sales_orders(id);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS fully_dispatched_at TIMESTAMPTZ;

-- sales_order_items: OMS tracking
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS product_id          UUID         REFERENCES products(id);
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS dispatched_quantity  DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS reserved_quantity    DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS backorder_quantity   DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS discount_percent     DECIMAL(5,2)           DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS gst_percent          DECIMAL(5,2)           DEFAULT 0;

-- customers: credit & outstanding
ALTER TABLE customers ADD COLUMN IF NOT EXISTS outstanding_amount     DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS overdue_amount         DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_payment_date      DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS order_blocking_enabled BOOLEAN               DEFAULT FALSE;

-- dispatches: logistics extras
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS transporter_gst VARCHAR(20);
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS docket_number   VARCHAR(100);
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS carton_count    INTEGER DEFAULT 0;

-- dispatch_items: FG product link
ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- bom_items: scrap tracking
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS scrap_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS is_critical      BOOLEAN      DEFAULT FALSE;

-- production_orders: direct product link
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- ──────────────────────────────────────────────────────────────
-- STEP 3: Create new tables (Variant Engine first)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_attributes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(50)  NOT NULL,
  data_type   VARCHAR(20)  NOT NULL DEFAULT 'text',
  is_required BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS product_attribute_values (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID         NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
  value        VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  color_hex    VARCHAR(7),
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(attribute_id, value)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID          NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  company_id       UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku              VARCHAR(150)  NOT NULL,
  name             VARCHAR(255),
  attribute_values JSONB         NOT NULL DEFAULT '[]',
  barcode          VARCHAR(150),
  image_url        TEXT,
  sale_rate        DECIMAL(15,2)          DEFAULT 0,
  additional_cost  DECIMAL(15,2)          DEFAULT 0,
  current_stock    DECIMAL(15,4) NOT NULL DEFAULT 0,
  reserved_stock   DECIMAL(15,4) NOT NULL DEFAULT 0,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, sku)
);

CREATE TABLE IF NOT EXISTS product_variant_stock (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id     UUID          NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id   UUID          NOT NULL REFERENCES warehouses(id)       ON DELETE CASCADE,
  current_stock  DECIMAL(15,4) NOT NULL DEFAULT 0,
  reserved_stock DECIMAL(15,4) NOT NULL DEFAULT 0,
  CONSTRAINT chk_variant_stock_nonneg CHECK (current_stock >= 0 AND reserved_stock >= 0),
  UNIQUE(variant_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory_ledger (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id      UUID          REFERENCES materials(id),
  product_id       UUID          REFERENCES products(id),
  variant_id       UUID          REFERENCES product_variants(id),
  warehouse_id     UUID          REFERENCES warehouses(id),
  movement_type    VARCHAR(60)   NOT NULL,
  quantity         DECIMAL(15,4) NOT NULL,
  balance_after    DECIMAL(15,4),
  unit             VARCHAR(50),
  rate             DECIMAL(15,2),
  reference_type   VARCHAR(100),
  reference_id     UUID,
  reference_number VARCHAR(100),
  batch_number     VARCHAR(100),
  notes            TEXT,
  performed_by     UUID          REFERENCES users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ledger_item CHECK (material_id IS NOT NULL OR product_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS stock_reservations (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id        UUID          REFERENCES materials(id),
  product_id         UUID          REFERENCES products(id),
  variant_id         UUID          REFERENCES product_variants(id),
  warehouse_id       UUID          REFERENCES warehouses(id),
  reference_type     VARCHAR(50)   NOT NULL DEFAULT 'sales_order',
  reference_id       UUID          NOT NULL,
  reference_number   VARCHAR(100),
  reserved_quantity  DECIMAL(15,4) NOT NULL CHECK (reserved_quantity > 0),
  fulfilled_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  status             VARCHAR(20)   NOT NULL DEFAULT 'active',
  reserved_by        UUID          REFERENCES users(id),
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_variant_overrides (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id            UUID          NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  variant_id        UUID          NOT NULL REFERENCES product_variants(id)  ON DELETE CASCADE,
  material_id       UUID          NOT NULL REFERENCES materials(id),
  quantity_per_unit DECIMAL(15,4) NOT NULL CHECK (quantity_per_unit > 0),
  waste_percentage  DECIMAL(5,2)  NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(bom_id, variant_id, material_id)
);

CREATE TABLE IF NOT EXISTS dispatch_cartons (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id   UUID         NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  carton_number VARCHAR(50),
  length_cm     DECIMAL(8,2),
  width_cm      DECIMAL(8,2),
  height_cm     DECIMAL(8,2),
  gross_weight  DECIMAL(10,3),
  net_weight    DECIMAL(10,3),
  contents_desc TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_credit_transactions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID          NOT NULL REFERENCES companies(id)  ON DELETE CASCADE,
  customer_id      UUID          NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
  transaction_type VARCHAR(50)   NOT NULL,
  reference_type   VARCHAR(100),
  reference_id     UUID,
  reference_number VARCHAR(100),
  amount           DECIMAL(15,2) NOT NULL,
  balance_after    DECIMAL(15,2),
  due_date         DATE,
  is_overdue       BOOLEAN       DEFAULT FALSE,
  notes            TEXT,
  created_by       UUID          REFERENCES users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────
-- STEP 4: Columns that reference new tables (safe now)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE sales_order_items   ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id);
ALTER TABLE production_orders   ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id);
ALTER TABLE dispatches          ADD COLUMN IF NOT EXISTS so_id      UUID REFERENCES sales_orders(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders' AND column_name = 'pending_qty'
  ) THEN
    ALTER TABLE production_orders
      ADD COLUMN pending_qty DECIMAL(15,4) GENERATED ALWAYS AS (
        GREATEST(0, planned_quantity - produced_quantity - rejected_quantity)
      ) STORED;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- STEP 5: Indexes
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_attr_company          ON product_attributes(company_id);
CREATE INDEX IF NOT EXISTS idx_attr_values_attr      ON product_attribute_values(attribute_id);
CREATE INDEX IF NOT EXISTS idx_variants_product      ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku          ON product_variants(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_variant_stock_variant ON product_variant_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_stock_wh      ON product_variant_stock(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_ledger_company   ON inventory_ledger(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_material  ON inventory_ledger(material_id)  WHERE material_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_product   ON inventory_ledger(product_id)   WHERE product_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_variant   ON inventory_ledger(variant_id)   WHERE variant_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_ref       ON inventory_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type      ON inventory_ledger(movement_type);

CREATE INDEX IF NOT EXISTS idx_reservations_company ON stock_reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_reservations_ref     ON stock_reservations(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product ON stock_reservations(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_status  ON stock_reservations(status)     WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_bom_overrides_bom     ON bom_variant_overrides(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_overrides_variant ON bom_variant_overrides(variant_id);

CREATE INDEX IF NOT EXISTS idx_so_company   ON sales_orders(company_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_so_customer  ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_so_status    ON sales_orders(company_id, status)           WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_soi_so       ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_soi_product  ON sales_order_items(product_id)  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_soi_variant  ON sales_order_items(variant_id)  WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_stock         ON products(company_id, current_stock)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cartons_dispatch       ON dispatch_cartons(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_customer     ON customer_credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_company      ON customer_credit_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ref          ON customer_credit_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_prod_product           ON production_orders(product_id)               WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispatch_items_product ON dispatch_items(product_id)                  WHERE product_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- STEP 6: Triggers (idempotent)
-- ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl  TEXT;
  trig TEXT;
BEGIN
  FOR tbl, trig IN VALUES
    ('product_attributes', 'trg_product_attributes_uat'),
    ('product_variants',   'trg_product_variants_uat'),
    ('stock_reservations', 'trg_stock_reservations_uat')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trig) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
        trig, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────
-- STEP 7: Backfill existing data
-- ──────────────────────────────────────────────────────────────

-- Map production orders to products via the FG-material bridge
UPDATE production_orders po
SET product_id = p.id
FROM products p
WHERE p.finished_goods_material_id = po.product_material_id
  AND po.product_id IS NULL
  AND po.product_material_id IS NOT NULL;

-- Refresh product stock counters
UPDATE products p
SET
  produced_qty         = COALESCE(agg.total_produced, 0),
  current_stock        = GREATEST(0, COALESCE(agg.total_produced, 0) - p.dispatched_qty),
  last_production_date = agg.last_date
FROM (
  SELECT po.product_id,
         SUM(po.produced_quantity) AS total_produced,
         MAX(po.actual_end_date)   AS last_date
  FROM production_orders po
  WHERE po.product_id IS NOT NULL AND po.produced_quantity > 0
  GROUP BY po.product_id
) agg
WHERE p.id = agg.product_id
  AND p.produced_qty = 0;

-- Sync outstanding amounts from unpaid invoices
UPDATE customers c
SET outstanding_amount = COALESCE(inv_agg.total,  0),
    overdue_amount     = COALESCE(inv_agg.overdue, 0)
FROM (
  SELECT customer_id,
         SUM(balance_amount)                                         AS total,
         SUM(balance_amount) FILTER (WHERE due_date < CURRENT_DATE) AS overdue
  FROM invoices
  WHERE payment_status != 'paid' AND deleted_at IS NULL
  GROUP BY customer_id
) inv_agg
WHERE c.id = inv_agg.customer_id
  AND c.outstanding_amount = 0;

-- ──────────────────────────────────────────────────────────────
-- STEP 8: Seed demo attribute data (skipped if already present)
-- ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  rec      RECORD;
  attr_id  UUID;
  attr_id2 UUID;
BEGIN
  FOR rec IN SELECT id FROM companies WHERE is_active = TRUE AND deleted_at IS NULL LOOP

    INSERT INTO product_attributes (company_id, name, code, data_type, sort_order)
    VALUES (rec.id, 'Size', 'SIZE', 'text', 1)
    ON CONFLICT (company_id, code) DO NOTHING
    RETURNING id INTO attr_id;

    IF attr_id IS NOT NULL THEN
      INSERT INTO product_attribute_values (attribute_id, value, display_name, sort_order) VALUES
        (attr_id, 'S',  'Small',   1),
        (attr_id, 'M',  'Medium',  2),
        (attr_id, 'L',  'Large',   3),
        (attr_id, 'XL', 'X-Large', 4)
      ON CONFLICT (attribute_id, value) DO NOTHING;
    END IF;

    INSERT INTO product_attributes (company_id, name, code, data_type, sort_order)
    VALUES (rec.id, 'Color', 'COLOR', 'color', 2)
    ON CONFLICT (company_id, code) DO NOTHING
    RETURNING id INTO attr_id2;

    IF attr_id2 IS NOT NULL THEN
      INSERT INTO product_attribute_values
        (attribute_id, value, display_name, color_hex, sort_order)
      VALUES
        (attr_id2, 'black', 'Black', '#000000', 1),
        (attr_id2, 'white', 'White', '#FFFFFF', 2),
        (attr_id2, 'brown', 'Brown', '#8B4513', 3)
      ON CONFLICT (attribute_id, value) DO NOTHING;
    END IF;

  END LOOP;
END $$;

-- ============================================================
-- DONE. Verify with:
--   SELECT tablename FROM pg_tables WHERE schemaname='public'
--     AND tablename IN (
--       'product_attributes','product_attribute_values','product_variants',
--       'product_variant_stock','inventory_ledger','stock_reservations',
--       'bom_variant_overrides','dispatch_cartons','customer_credit_transactions'
--     );
-- Expected: 9 rows returned.
-- ============================================================
