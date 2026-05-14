-- ============================================================
-- INVENTORY LEDGER BACKFILL
-- Run this once in Supabase SQL Editor to populate
-- inventory_ledger from all existing historical data.
-- Safe to re-run — uses NOT EXISTS guards to avoid duplicates.
-- ============================================================

-- ── 1. GRN Inward ─────────────────────────────────────────────────────────────
-- Source: grn + grn_items where QC is approved and quantity accepted > 0
INSERT INTO inventory_ledger
  (company_id, material_id, warehouse_id,
   movement_type, quantity, unit, rate,
   reference_type, reference_id, reference_number,
   batch_number, notes, performed_by, created_at)
SELECT
  g.company_id,
  gi.material_id,
  g.warehouse_id,
  'grn_inward',
  gi.accepted_quantity,
  gi.unit,
  gi.rate,
  'grn',
  g.id,
  g.grn_number,
  gi.batch_number,
  g.notes,
  g.received_by,
  g.created_at
FROM grn g
JOIN grn_items gi ON gi.grn_id = g.id
WHERE g.qc_status = 'approved'
  AND gi.accepted_quantity > 0
  AND g.status != 'cancelled'
  AND gi.material_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM inventory_ledger il
    WHERE il.reference_type = 'grn'
      AND il.reference_id   = g.id
      AND il.material_id    = gi.material_id
      AND il.movement_type  = 'grn_inward'
  );

-- ── 2. Dispatch Outward (materials) ──────────────────────────────────────────
INSERT INTO inventory_ledger
  (company_id, material_id, warehouse_id,
   movement_type, quantity, unit,
   reference_type, reference_id, reference_number,
   notes, performed_by, created_at)
SELECT
  d.company_id,
  di.material_id,
  d.warehouse_id,
  'dispatch_outward',
  -ABS(di.quantity),
  di.unit::text,
  'dispatches',
  d.id,
  d.dispatch_number,
  di.notes,
  d.created_by,
  d.created_at
FROM dispatches d
JOIN dispatch_items di ON di.dispatch_id = d.id
WHERE di.material_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM inventory_ledger il
    WHERE il.reference_type = 'dispatches'
      AND il.reference_id   = d.id
      AND il.material_id    = di.material_id
      AND il.movement_type  = 'dispatch_outward'
  );

-- ── 3. Dispatch Outward (products) ───────────────────────────────────────────
INSERT INTO inventory_ledger
  (company_id, product_id, warehouse_id,
   movement_type, quantity, unit,
   reference_type, reference_id, reference_number,
   notes, performed_by, created_at)
SELECT
  d.company_id,
  di.product_id,
  d.warehouse_id,
  'dispatch_outward',
  -ABS(di.quantity),
  di.unit::text,
  'dispatches',
  d.id,
  d.dispatch_number,
  di.notes,
  d.created_by,
  d.created_at
FROM dispatches d
JOIN dispatch_items di ON di.dispatch_id = d.id
WHERE di.product_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM inventory_ledger il
    WHERE il.reference_type = 'dispatches'
      AND il.reference_id   = d.id
      AND il.product_id     = di.product_id
      AND il.movement_type  = 'dispatch_outward'
  );

-- ── 4. Production Consume (materials reserved at order creation) ──────────────
INSERT INTO inventory_ledger
  (company_id, material_id,
   movement_type, quantity, unit,
   reference_type, reference_id, reference_number,
   notes, performed_by, created_at)
SELECT
  po.company_id,
  pm.material_id,
  'production_consume',
  -ABS(COALESCE(pm.actual_quantity, pm.planned_quantity)),
  pm.unit::text,
  'production_orders',
  po.id,
  po.order_number,
  'Materials consumed for production order ' || po.order_number,
  po.created_by,
  po.created_at
FROM production_orders po
JOIN production_materials pm ON pm.production_order_id = po.id
WHERE po.status NOT IN ('cancelled', 'pending')
  AND (po.deleted_at IS NULL)
  AND COALESCE(pm.actual_quantity, pm.planned_quantity) > 0
  AND pm.material_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM inventory_ledger il
    WHERE il.reference_type = 'production_orders'
      AND il.reference_id   = po.id
      AND il.material_id    = pm.material_id
      AND il.movement_type  = 'production_consume'
  );

-- ── 5. Production Complete (finished goods added) ─────────────────────────────
INSERT INTO inventory_ledger
  (company_id, product_id,
   movement_type, quantity, unit,
   reference_type, reference_id, reference_number,
   notes, performed_by, created_at)
SELECT
  po.company_id,
  po.product_id,
  'production_complete',
  po.produced_quantity,
  po.unit::text,
  'production_orders',
  po.id,
  po.order_number,
  'Production completed: ' || po.produced_quantity || ' units added to finished goods stock',
  po.created_by,
  COALESCE(po.actual_end_date, po.updated_at)
FROM production_orders po
WHERE po.status = 'completed'
  AND po.product_id IS NOT NULL
  AND po.produced_quantity > 0
  AND (po.deleted_at IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM inventory_ledger il
    WHERE il.reference_type = 'production_orders'
      AND il.reference_id   = po.id
      AND il.movement_type  = 'production_complete'
  );

-- ── Verify results ─────────────────────────────────────────────────────────────
SELECT
  movement_type,
  COUNT(*) AS entries,
  SUM(ABS(quantity)) AS total_qty
FROM inventory_ledger
GROUP BY movement_type
ORDER BY movement_type;
