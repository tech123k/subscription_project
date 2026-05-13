CREATE TABLE IF NOT EXISTS production_stage_reverts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  from_stage_id  UUID NOT NULL REFERENCES workflow_stages(id),
  to_stage_id    UUID NOT NULL REFERENCES workflow_stages(id),
  reason         TEXT NOT NULL,
  reverted_by    UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_reverts_order
  ON production_stage_reverts(production_order_id);
