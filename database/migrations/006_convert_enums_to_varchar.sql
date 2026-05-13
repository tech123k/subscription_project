-- Drop the view that depends on production_status enum columns
DROP VIEW IF EXISTS v_production_overview;

-- Convert production_orders.status: production_status enum → VARCHAR(30)
ALTER TABLE production_orders
  ALTER COLUMN status TYPE VARCHAR(30) USING status::text;

-- Convert production_stage_logs.status: production_status enum → VARCHAR(30)
ALTER TABLE production_stage_logs
  ALTER COLUMN status TYPE VARCHAR(30) USING status::text;

-- Convert production_orders.unit if it exists as material_unit enum → VARCHAR(50)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'production_orders'
      AND column_name = 'unit'
      AND udt_name = 'material_unit'
  ) THEN
    ALTER TABLE production_orders
      ALTER COLUMN unit TYPE VARCHAR(50) USING unit::text;
  END IF;
END $$;

-- Recreate the overview view without enum dependency
CREATE OR REPLACE VIEW v_production_overview AS
SELECT
  po.id,
  po.company_id,
  po.order_number,
  po.status,
  po.priority,
  po.planned_quantity,
  po.produced_quantity,
  po.rejected_quantity,
  po.planned_start_date,
  po.planned_end_date,
  po.actual_start_date,
  m.name AS product_name,
  m.code AS product_code,
  c.name AS customer_name,
  ws.name AS current_stage_name,
  wt.name AS workflow_name,
  CASE
    WHEN po.planned_end_date < CURRENT_DATE
     AND po.status NOT IN ('completed', 'cancelled')
    THEN TRUE
    ELSE FALSE
  END AS is_delayed
FROM production_orders po
LEFT JOIN materials m ON po.product_material_id = m.id
LEFT JOIN customers c ON po.customer_id = c.id
LEFT JOIN workflow_stages ws ON po.current_stage_id = ws.id
LEFT JOIN workflow_templates wt ON po.workflow_template_id = wt.id
WHERE po.deleted_at IS NULL;
