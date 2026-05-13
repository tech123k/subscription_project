-- Actual consumption tracking per material
ALTER TABLE production_materials ADD COLUMN IF NOT EXISTS actual_quantity   DECIMAL(15,4) DEFAULT 0;
ALTER TABLE production_materials ADD COLUMN IF NOT EXISTS wastage_quantity  DECIMAL(15,4) DEFAULT 0;
ALTER TABLE production_materials ADD COLUMN IF NOT EXISTS variance_quantity DECIMAL(15,4) DEFAULT 0;

-- Track who completed each stage
ALTER TABLE production_stage_logs ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id);

-- Mark when finished goods have been added to inventory
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS finished_goods_added BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional link: finished product maps to a raw material record for FG inventory
ALTER TABLE products ADD COLUMN IF NOT EXISTS finished_goods_material_id UUID REFERENCES materials(id);
