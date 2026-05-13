-- ============================================================
-- Migration 009: Add product_id to production_orders
-- ============================================================
-- The original schema linked orders to a *material* record
-- (product_material_id → materials.id).  We now link directly
-- to the products table so stock updates are unambiguous.
-- ============================================================

-- 1. Add the column
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- 2. Backfill: map old product_material_id → products.id
--    via products.finished_goods_material_id bridge
UPDATE production_orders po
SET product_id = p.id
FROM products p
WHERE p.finished_goods_material_id = po.product_material_id
  AND po.product_id IS NULL
  AND po.product_material_id IS NOT NULL;

-- Also try: if product name matches (fallback for products without FG material link)
-- (skipped — too ambiguous without a reliable key)

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_production_orders_product
  ON production_orders(product_id)
  WHERE product_id IS NOT NULL;

-- 4. Now refresh products.produced_qty / current_stock from all orders
UPDATE products p
SET
  produced_qty         = COALESCE(agg.total_produced, 0),
  current_stock        = GREATEST(0, COALESCE(agg.total_produced, 0) - p.dispatched_qty),
  last_production_date = agg.last_date
FROM (
  SELECT
    po.product_id,
    SUM(po.produced_quantity) AS total_produced,
    MAX(po.actual_end_date)   AS last_date
  FROM production_orders po
  WHERE po.product_id IS NOT NULL
    AND po.produced_quantity > 0
  GROUP BY po.product_id
) agg
WHERE p.id = agg.product_id;
