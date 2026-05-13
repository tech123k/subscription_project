-- ============================================================
-- Migration 008: Link dispatch items to finished-goods products
-- ============================================================
-- Allows dispatches to deduct directly from products.current_stock
-- when the dispatched item is a finished good (not a raw material).
-- ============================================================

ALTER TABLE dispatch_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- Only one of material_id / product_id should be set per item.
-- Soft constraint via partial index (both can be NULL for free-text items).
CREATE INDEX IF NOT EXISTS idx_dispatch_items_product
  ON dispatch_items(product_id)
  WHERE product_id IS NOT NULL;
