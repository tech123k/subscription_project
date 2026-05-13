-- Notifications: the most frequently hit query
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id, company_id, is_read)
  WHERE is_read = FALSE;

-- Materials
CREATE INDEX IF NOT EXISTS idx_materials_company_active
  ON materials(company_id, deleted_at, is_active);

-- Material categories
CREATE INDEX IF NOT EXISTS idx_material_categories_company
  ON material_categories(company_id, is_active);

-- Warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_company
  ON warehouses(company_id, deleted_at);

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_company
  ON suppliers(company_id, deleted_at);

-- Purchase orders
CREATE INDEX IF NOT EXISTS idx_po_company_status
  ON purchase_orders(company_id, status);

-- GRN
CREATE INDEX IF NOT EXISTS idx_grn_company_status
  ON grn(company_id, status, po_id);

-- Stock transactions
CREATE INDEX IF NOT EXISTS idx_stock_transactions_material
  ON stock_transactions(material_id, company_id);
