-- ============================================================
-- Migration 007: Product-level finished-goods stock ledger
-- ============================================================
-- Products track their own FG inventory directly rather than
-- routing through the raw-materials table via finished_goods_material_id.
-- The materials link remains for cross-system visibility (optional).
-- ============================================================

-- Stock columns on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_stock       DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock      DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS produced_qty        DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dispatched_qty      DECIMAL(15,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_production_date TIMESTAMPTZ;

-- Backfill produced_qty and current_stock from existing completed orders.
-- current_stock = total produced - total dispatched (dispatched_qty starts at 0).
UPDATE products p
SET
  produced_qty         = COALESCE(agg.total_produced, 0),
  current_stock        = COALESCE(agg.total_produced, 0),   -- no dispatches tracked yet
  last_production_date = agg.last_date
FROM (
  SELECT
    po.product_id,
    SUM(po.produced_quantity) AS total_produced,
    MAX(po.actual_end_date)   AS last_date
  FROM production_orders po
  WHERE po.status = 'completed'
    AND po.product_id IS NOT NULL
  GROUP BY po.product_id
) agg
WHERE p.id = agg.product_id;

-- Guard: stock can never go negative
ALTER TABLE products ADD CONSTRAINT chk_products_stock_nonneg
  CHECK (current_stock >= 0 AND reserved_stock >= 0 AND produced_qty >= 0 AND dispatched_qty >= 0);

-- Index for stock-status filtering
CREATE INDEX IF NOT EXISTS idx_products_stock
  ON products(company_id, current_stock)
  WHERE deleted_at IS NULL;
