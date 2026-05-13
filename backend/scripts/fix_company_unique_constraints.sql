-- ============================================================
-- Migration: Fix global unique constraints → per-company unique
-- Apply this in Supabase SQL Editor once.
-- ============================================================

-- ── GRN numbers ──────────────────────────────────────────────
ALTER TABLE grn DROP CONSTRAINT IF EXISTS grn_grn_number_key;
DROP INDEX IF EXISTS grn_grn_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_grn_company_number
  ON grn(company_id, grn_number);

-- ── Purchase Order numbers ────────────────────────────────────
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
DROP INDEX IF EXISTS purchase_orders_po_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_po_company_number
  ON purchase_orders(company_id, po_number);

-- ── Invoice numbers ───────────────────────────────────────────
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
DROP INDEX IF EXISTS invoices_invoice_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_company_number
  ON invoices(company_id, invoice_number)
  WHERE deleted_at IS NULL;

-- ── Sales Order numbers ───────────────────────────────────────
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_order_number_key;
DROP INDEX IF EXISTS sales_orders_order_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_so_company_number
  ON sales_orders(company_id, order_number)
  WHERE deleted_at IS NULL;

-- ── Dispatch numbers ──────────────────────────────────────────
ALTER TABLE dispatches DROP CONSTRAINT IF EXISTS dispatches_dispatch_number_key;
DROP INDEX IF EXISTS dispatches_dispatch_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispatch_company_number
  ON dispatches(company_id, dispatch_number)
  WHERE deleted_at IS NULL;

-- ── Material codes ────────────────────────────────────────────
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_code_key;
DROP INDEX IF EXISTS materials_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_company_code
  ON materials(company_id, code)
  WHERE deleted_at IS NULL;

-- ── Product codes ─────────────────────────────────────────────
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_code_key;
DROP INDEX IF EXISTS products_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_company_code
  ON products(company_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

-- ── Supplier codes ────────────────────────────────────────────
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_code_key;
DROP INDEX IF EXISTS suppliers_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_company_code
  ON suppliers(company_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

-- ── Customer codes ────────────────────────────────────────────
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_code_key;
DROP INDEX IF EXISTS customers_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_company_code
  ON customers(company_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

-- ── Warehouse codes ───────────────────────────────────────────
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_code_key;
DROP INDEX IF EXISTS warehouses_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse_company_code
  ON warehouses(company_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

-- ── Product attribute codes ───────────────────────────────────
ALTER TABLE product_attributes DROP CONSTRAINT IF EXISTS product_attributes_code_key;
DROP INDEX IF EXISTS product_attributes_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_attr_company_code
  ON product_attributes(company_id, code);

-- ── Product variant SKUs (already per-company — verify/ensure) ──
-- product_variants should already have UNIQUE(company_id, sku)
-- If it doesn't, run:
-- ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS product_variants_sku_key;
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_variant_company_sku ON product_variants(company_id, sku);
