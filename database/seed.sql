-- ============================================================
-- ERP SYSTEM - SEED DATA
-- ============================================================

-- Super Admin Company
INSERT INTO companies (id, name, code, industry_type, subscription_plan, email, phone, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ERP Platform Admin',
  'PLATFORM',
  'other',
  'enterprise',
  'admin@erp.com',
  '+91-9999999999',
  TRUE
) ON CONFLICT DO NOTHING;

-- Super Admin User (password: SuperAdmin@123)
INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role, is_active, is_email_verified)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'superadmin@erp.com',
  crypt('SuperAdmin@123', gen_salt('bf', 12)),
  'Super',
  'Admin',
  'super_admin',
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

-- Demo Manufacturing Company
INSERT INTO companies (id, name, code, industry_type, gst_number, subscription_plan, email, phone,
  address_line1, city, state, country, pincode, invoice_prefix, grn_prefix)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Alpha Manufacturing Pvt Ltd',
  'ALPHAMFG',
  'manufacturing',
  '27AABCU9603R1ZX',
  'professional',
  'info@alphamfg.com',
  '+91-9876543210',
  '123 Industrial Area, Phase 2',
  'Mumbai',
  'Maharashtra',
  'India',
  '400001',
  'ALPHA-INV',
  'ALPHA-GRN'
) ON CONFLICT DO NOTHING;

-- Demo Company Admin (password: Admin@123)
INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role, is_active, is_email_verified, department)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000010',
  'admin@alphamfg.com',
  crypt('Admin@123', gen_salt('bf', 12)),
  'Rajesh',
  'Kumar',
  'company_admin',
  TRUE,
  TRUE,
  'Management'
) ON CONFLICT DO NOTHING;

-- Demo Department Users
INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role, is_active, is_email_verified, department)
VALUES
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000010', 'production@alphamfg.com', crypt('User@123', gen_salt('bf', 12)), 'Suresh', 'Sharma', 'department_user', TRUE, TRUE, 'Production'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000010', 'store@alphamfg.com', crypt('User@123', gen_salt('bf', 12)), 'Priya', 'Patel', 'department_user', TRUE, TRUE, 'Store'),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000010', 'dispatch@alphamfg.com', crypt('User@123', gen_salt('bf', 12)), 'Amit', 'Singh', 'department_user', TRUE, TRUE, 'Dispatch')
ON CONFLICT DO NOTHING;

-- Demo Warehouse
INSERT INTO warehouses (id, company_id, name, code, address, city, state, is_primary)
VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'Main Warehouse', 'WH-01', '123 Industrial Area', 'Mumbai', 'Maharashtra', TRUE),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000010', 'Raw Material Store', 'WH-02', '124 Industrial Area', 'Mumbai', 'Maharashtra', FALSE)
ON CONFLICT DO NOTHING;

-- Demo Material Categories
INSERT INTO material_categories (id, company_id, name, description)
VALUES
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000010', 'Raw Materials', 'Basic raw materials'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000010', 'Packaging', 'Packaging materials'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000010', 'Finished Goods', 'Finished products'),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000010', 'Semi-Finished', 'Work in progress items'),
  ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000010', 'Consumables', 'Consumable items')
ON CONFLICT DO NOTHING;

-- Demo Suppliers
INSERT INTO suppliers (id, company_id, name, code, contact_person, email, phone, gst_number, city, state, credit_days)
VALUES
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010', 'Steel Corp India', 'SUP-001', 'Mahesh Joshi', 'mahesh@steelcorp.com', '+91-9111222333', '27AADCS1234R1Z5', 'Pune', 'Maharashtra', 30),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000010', 'Polymer Solutions', 'SUP-002', 'Kavita Shah', 'kavita@polymer.com', '+91-9222333444', '27AADCP5678R1Z3', 'Surat', 'Gujarat', 45),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000010', 'Packaging Hub', 'SUP-003', 'Ravi Mehta', 'ravi@packhub.com', '+91-9333444555', '27AADCM9012R1Z1', 'Mumbai', 'Maharashtra', 15)
ON CONFLICT DO NOTHING;

-- Demo Customers
INSERT INTO customers (id, company_id, name, code, contact_person, email, phone, gst_number, city, state, credit_days, credit_limit)
VALUES
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000010', 'MegaMart Retail', 'CUST-001', 'Neha Kapoor', 'neha@megamart.com', '+91-9444555666', '27AADCM3456R1Z9', 'Mumbai', 'Maharashtra', 30, 500000),
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000010', 'TechBuild Infra', 'CUST-002', 'Sanjay Verma', 'sanjay@techbuild.com', '+91-9555666777', '07AADCT7890R1Z7', 'Delhi', 'Delhi', 45, 1000000),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000010', 'Southern Traders', 'CUST-003', 'Lakshmi Rao', 'lakshmi@southtrade.com', '+91-9666777888', '29AADCS2468R1Z5', 'Bangalore', 'Karnataka', 15, 250000)
ON CONFLICT DO NOTHING;

-- Manufacturing Workflow Template
INSERT INTO workflow_templates (id, company_id, name, description, is_default, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000060',
  '00000000-0000-0000-0000-000000000010',
  'Standard Manufacturing Flow',
  'Default manufacturing production workflow',
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

-- Workflow Stages
INSERT INTO workflow_stages (id, company_id, template_id, name, code, sequence_order, department, color, notify_on_complete)
VALUES
  ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000060', 'Raw Material Issued', 'RM_ISSUED', 1, 'Store', '#F59E0B', TRUE),
  ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000060', 'Cutting', 'CUTTING', 2, 'Production', '#EF4444', TRUE),
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000060', 'Assembly', 'ASSEMBLY', 3, 'Production', '#8B5CF6', TRUE),
  ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000060', 'Quality Check', 'QC', 4, 'QC', '#06B6D4', TRUE),
  ('00000000-0000-0000-0000-000000000065', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000060', 'Finishing', 'FINISHING', 5, 'Production', '#10B981', TRUE),
  ('00000000-0000-0000-0000-000000000066', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000060', 'Packing', 'PACKING', 6, 'Dispatch', '#3B82F6', TRUE)
ON CONFLICT DO NOTHING;
