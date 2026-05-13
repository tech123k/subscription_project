-- ============================================================
-- MIGRATION: Purchase Orders
-- Run this script once against your database
-- ============================================================

-- 1. PO status enum
DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('draft', 'sent', 'confirmed', 'partial', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_number         VARCHAR(100) NOT NULL,
  supplier_id       UUID REFERENCES suppliers(id),
  warehouse_id      UUID REFERENCES warehouses(id),
  status            po_status DEFAULT 'draft',
  order_date        DATE DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  payment_terms     VARCHAR(200),
  notes             TEXT,
  total_amount      DECIMAL(15,2) DEFAULT 0,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE(company_id, po_number)
);

-- 3. po_items table
CREATE TABLE IF NOT EXISTS po_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id             UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  material_id       UUID NOT NULL REFERENCES materials(id),
  quantity          DECIMAL(15,3) NOT NULL,
  received_quantity DECIMAL(15,3) DEFAULT 0,
  unit              VARCHAR(50),
  rate              DECIMAL(15,2) DEFAULT 0,
  gst_percent       DECIMAL(5,2) DEFAULT 0,
  amount            DECIMAL(15,2) DEFAULT 0,
  notes             TEXT
);

-- 4. Link GRN to PO (po_id for FK, po_reference already exists as text)
ALTER TABLE grn ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES purchase_orders(id);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_po_company ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON grn(po_id);
