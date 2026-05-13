-- ============================================================
-- MIGRATION 010: Phase 1 Features
-- 1. Variant Engine        5. Production Flow
-- 2. Inventory Ledger      6. OMS Lite
-- 3. Stock Reservations    7. Dispatch Improvements
-- 4. Advanced BOM          8. Credit & Outstanding
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. VARIANT ENGINE
-- ──────────────────────────────────────────────────────────────

-- Attribute Master (Size, Color, Material, etc. — fully configurable)
CREATE TABLE IF NOT EXISTS product_attributes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(50)  NOT NULL,
  data_type   VARCHAR(20)  NOT NULL DEFAULT 'text',  -- text | number | color
  is_required BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_attr_company ON product_attributes(company_id);

-- Attribute Values (S, M, L, Red, Blue — per attribute)
CREATE TABLE IF NOT EXISTS product_attribute_values (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
  value        VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  color_hex    VARCHAR(7),      -- for color-type attributes
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attribute_id, value)
);
CREATE INDEX IF NOT EXISTS idx_attr_values_attr ON product_attribute_values(attribute_id);

-- Product Variants (all combinations of attribute values for a product)
CREATE TABLE IF NOT EXISTS product_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku              VARCHAR(150) NOT NULL,
  name             VARCHAR(255),
  -- e.g. [{"attribute_id":"...", "attribute_name":"Size", "value_id":"...", "value":"M"}]
  attribute_values JSONB NOT NULL DEFAULT '[]',
  barcode          VARCHAR(150),
  image_url        TEXT,
  sale_rate        DECIMAL(15,2) DEFAULT 0,
  additional_cost  DECIMAL(15,2) DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku     ON product_variants(company_id, sku);

-- Variant Stock (per warehouse per variant)
CREATE TABLE IF NOT EXISTS product_variant_stock (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id     UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id   UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  current_stock  DECIMAL(15,4) NOT NULL DEFAULT 0,
  reserved_stock DECIMAL(15,4) NOT NULL DEFAULT 0,
  CONSTRAINT chk_variant_stock_nonneg CHECK (current_stock >= 0 AND reserved_stock >= 0),
  UNIQUE(variant_id, warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_variant_stock_variant   ON product_variant_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_stock_warehouse ON product_variant_stock(warehouse_id);

-- Extend products table with variant support
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN  NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_prefix   VARCHAR(30);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url    TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_rate    DECIMAL(15,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code     VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_percent  DECIMAL(5,2)  DEFAULT 0;

-- ──────────────────────────────────────────────────────────────
-- 2. INVENTORY LEDGER
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- One of material_id OR product_id must be set
  material_id      UUID REFERENCES materials(id),
  product_id       UUID REFERENCES products(id),
  variant_id       UUID REFERENCES product_variants(id),
  warehouse_id     UUID REFERENCES warehouses(id),
  -- movement_type values:
  -- grn_inward | production_consume | production_complete
  -- dispatch_outward | transfer_in | transfer_out
  -- adjustment_add | adjustment_deduct | opening_balance
  movement_type    VARCHAR(60) NOT NULL,
  quantity         DECIMAL(15,4) NOT NULL,  -- positive = in, negative = out
  balance_after    DECIMAL(15,4),           -- running balance after this entry
  unit             VARCHAR(50),
  rate             DECIMAL(15,2),
  reference_type   VARCHAR(100),
  reference_id     UUID,
  reference_number VARCHAR(100),
  batch_number     VARCHAR(100),
  notes            TEXT,
  performed_by     UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_company    ON inventory_ledger(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_material   ON inventory_ledger(material_id);
CREATE INDEX IF NOT EXISTS idx_ledger_product    ON inventory_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_variant    ON inventory_ledger(variant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reference  ON inventory_ledger(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type       ON inventory_ledger(movement_type);

-- ──────────────────────────────────────────────────────────────
-- 3. STOCK RESERVATIONS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_reservations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id        UUID REFERENCES materials(id),
  product_id         UUID REFERENCES products(id),
  variant_id         UUID REFERENCES product_variants(id),
  warehouse_id       UUID REFERENCES warehouses(id),
  reference_type     VARCHAR(50) NOT NULL DEFAULT 'sales_order',
  reference_id       UUID NOT NULL,
  reference_number   VARCHAR(100),
  reserved_quantity  DECIMAL(15,4) NOT NULL CHECK (reserved_quantity > 0),
  fulfilled_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  status             VARCHAR(20)  NOT NULL DEFAULT 'active',
  -- active | partial | fulfilled | cancelled
  reserved_by        UUID REFERENCES users(id),
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservations_company   ON stock_reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_reservations_reference ON stock_reservations(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product   ON stock_reservations(product_id);

-- ──────────────────────────────────────────────────────────────
-- 4. ADVANCED BOM (Variant-wise overrides)
-- ──────────────────────────────────────────────────────────────

-- Variant-specific BOM material overrides (e.g., Size XL needs more fabric)
CREATE TABLE IF NOT EXISTS bom_variant_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id            UUID NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  variant_id        UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  material_id       UUID NOT NULL REFERENCES materials(id),
  quantity_per_unit DECIMAL(15,4) NOT NULL CHECK (quantity_per_unit > 0),
  waste_percentage  DECIMAL(5,2)  NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bom_id, variant_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_bom_overrides_bom     ON bom_variant_overrides(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_overrides_variant ON bom_variant_overrides(variant_id);

-- Add scrap/wastage tracking columns to bom_items
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS scrap_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS is_critical      BOOLEAN DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────────
-- 5. PRODUCTION FLOW (variant support)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS variant_id  UUID REFERENCES product_variants(id);
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS pending_qty DECIMAL(15,4) GENERATED ALWAYS AS
  (GREATEST(0, planned_quantity - produced_quantity - rejected_quantity)) STORED;

-- ──────────────────────────────────────────────────────────────
-- 6. OMS LITE (Sales Order enhancements)
-- ──────────────────────────────────────────────────────────────

-- Add OMS-specific columns
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS channel              VARCHAR(50)  DEFAULT 'direct';
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS warehouse_id         UUID REFERENCES warehouses(id);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS backorder_of         UUID REFERENCES sales_orders(id);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cancellation_reason  TEXT;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS fully_dispatched_at  TIMESTAMPTZ;

-- Items: product/variant support + dispatch tracking
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS product_id           UUID REFERENCES products(id);
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS variant_id           UUID REFERENCES product_variants(id);
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS dispatched_quantity  DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS reserved_quantity    DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS backorder_quantity   DECIMAL(15,4) NOT NULL DEFAULT 0;

-- Companies: sales order numbering
ALTER TABLE companies ADD COLUMN IF NOT EXISTS so_prefix  VARCHAR(20) DEFAULT 'SO';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS so_counter INTEGER NOT NULL DEFAULT 1;

-- ──────────────────────────────────────────────────────────────
-- 7. DISPATCH IMPROVEMENTS
-- ──────────────────────────────────────────────────────────────

-- Carton-level details per dispatch
CREATE TABLE IF NOT EXISTS dispatch_cartons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id   UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  carton_number VARCHAR(50),
  length_cm     DECIMAL(8,2),
  width_cm      DECIMAL(8,2),
  height_cm     DECIMAL(8,2),
  gross_weight  DECIMAL(10,3),
  net_weight    DECIMAL(10,3),
  contents_desc TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cartons_dispatch ON dispatch_cartons(dispatch_id);

-- Extend dispatches with extra transporter / carton fields
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS transporter_gst   VARCHAR(20);
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS docket_number     VARCHAR(100);
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS carton_count      INTEGER DEFAULT 0;
ALTER TABLE dispatches ADD COLUMN IF NOT EXISTS so_id             UUID REFERENCES sales_orders(id);

-- ──────────────────────────────────────────────────────────────
-- 8. CREDIT & OUTSTANDING
-- ──────────────────────────────────────────────────────────────

-- Customer-level credit transaction log
CREATE TABLE IF NOT EXISTS customer_credit_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  -- transaction_type: invoice | payment | credit_note | adjustment | opening_balance
  transaction_type VARCHAR(50) NOT NULL,
  reference_type   VARCHAR(100),
  reference_id     UUID,
  reference_number VARCHAR(100),
  -- positive = amount owed by customer (debit); negative = customer paid / credit note
  amount           DECIMAL(15,2) NOT NULL,
  balance_after    DECIMAL(15,2),
  due_date         DATE,
  is_overdue       BOOLEAN DEFAULT FALSE,
  notes            TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_customer ON customer_credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_company  ON customer_credit_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ref      ON customer_credit_transactions(reference_type, reference_id);

-- Extend customers with live outstanding columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS outstanding_amount      DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS overdue_amount          DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_payment_date       DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS order_blocking_enabled  BOOLEAN DEFAULT FALSE;

-- ──────────────────────────────────────────────────────────────
-- TRIGGERS
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_attributes_updated_at') THEN
    CREATE TRIGGER trg_product_attributes_updated_at
      BEFORE UPDATE ON product_attributes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_variants_updated_at') THEN
    CREATE TRIGGER trg_product_variants_updated_at
      BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_stock_reservations_updated_at') THEN
    CREATE TRIGGER trg_stock_reservations_updated_at
      BEFORE UPDATE ON stock_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;
