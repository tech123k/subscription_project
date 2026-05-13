-- Product Master
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  code          VARCHAR(100),
  category      VARCHAR(100),
  unit          VARCHAR(50) NOT NULL DEFAULT 'pieces',
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code ON products(company_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL;

-- BOM Header (one active BOM per product)
CREATE TABLE IF NOT EXISTS bill_of_materials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bom_product ON bill_of_materials(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bom_active ON bill_of_materials(product_id) WHERE is_active = TRUE;

-- BOM Items (materials per unit of finished product)
CREATE TABLE IF NOT EXISTS bom_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id           UUID NOT NULL REFERENCES bill_of_materials(id) ON DELETE CASCADE,
  material_id      UUID NOT NULL REFERENCES materials(id),
  quantity_per_unit DECIMAL(15,4) NOT NULL CHECK (quantity_per_unit > 0),
  unit             VARCHAR(50),
  waste_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (waste_percentage >= 0 AND waste_percentage < 100),
  sequence_order   INTEGER NOT NULL DEFAULT 1,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON bom_items(bom_id);

-- Link production orders to a product and its BOM snapshot
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS bom_id UUID REFERENCES bill_of_materials(id);
