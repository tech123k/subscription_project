-- ============================================================
-- ERP SYSTEM - COMPLETE POSTGRESQL SCHEMA
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE industry_type AS ENUM (
  'footwear', 'steel', 'chemical', 'textile', 'fmcg',
  'machinery', 'manufacturing', 'trading', 'other'
);

CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');

CREATE TYPE user_role AS ENUM ('super_admin', 'company_admin', 'department_user', 'read_only');

CREATE TYPE permission_action AS ENUM ('view', 'create', 'edit', 'delete', 'export', 'import', 'approve');

CREATE TYPE material_unit AS ENUM (
  'kg', 'gm', 'ton', 'litre', 'ml', 'meter', 'feet', 'inch',
  'piece', 'box', 'carton', 'dozen', 'pair', 'set', 'roll', 'sheet'
);

CREATE TYPE stock_type AS ENUM ('available', 'reserved', 'damaged', 'in_production', 'in_transit');

CREATE TYPE transaction_type AS ENUM ('inward', 'outward', 'transfer', 'adjustment', 'consumption', 'return');

CREATE TYPE production_status AS ENUM ('pending', 'in_progress', 'on_hold', 'completed', 'rejected', 'cancelled');

CREATE TYPE qc_status AS ENUM ('pending', 'approved', 'rejected', 'conditional');

CREATE TYPE dispatch_status AS ENUM ('ready', 'packed', 'dispatched', 'in_transit', 'delivered', 'delayed', 'returned');

CREATE TYPE notification_type AS ENUM (
  'new_order', 'production_complete', 'approval_pending', 'low_stock',
  'dispatch_ready', 'delay_alert', 'qc_update', 'system', 'workflow_stage'
);

CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'view', 'export', 'import', 'login', 'logout', 'approve', 'reject');

-- ============================================================
-- COMPANIES (Multi-Tenant Core)
-- ============================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  logo_url TEXT,
  gst_number VARCHAR(20),
  pan_number VARCHAR(20),
  industry_type industry_type NOT NULL DEFAULT 'manufacturing',
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  bank_branch VARCHAR(255),
  digital_signature_url TEXT,
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  invoice_counter INTEGER DEFAULT 1,
  dispatch_prefix VARCHAR(20) DEFAULT 'DSP',
  dispatch_counter INTEGER DEFAULT 1,
  production_prefix VARCHAR(20) DEFAULT 'PRD',
  production_counter INTEGER DEFAULT 1,
  grn_prefix VARCHAR(20) DEFAULT 'GRN',
  grn_counter INTEGER DEFAULT 1,
  po_prefix VARCHAR(20) DEFAULT 'PO',
  po_counter INTEGER DEFAULT 1,
  tally_sync_enabled BOOLEAN DEFAULT FALSE,
  tally_company_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_companies_code ON companies(code);
CREATE INDEX idx_companies_industry ON companies(industry_type);
CREATE INDEX idx_companies_active ON companies(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'department_user',
  department VARCHAR(100),
  employee_code VARCHAR(50),
  designation VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  is_email_verified BOOLEAN DEFAULT FALSE,
  email_verify_token TEXT,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMPTZ,
  refresh_token TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(45),
  login_count INTEGER DEFAULT 0,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  notification_preferences JSONB DEFAULT '{"email": true, "in_app": true, "sound": false}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- ============================================================
-- ROLES & PERMISSIONS (Fine-grained RBAC)
-- ============================================================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  module VARCHAR(100) NOT NULL,
  action permission_action NOT NULL,
  is_allowed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, module, action)
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  UNIQUE(user_id, role_id)
);

-- ============================================================
-- WAREHOUSES
-- ============================================================

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  manager_id UUID REFERENCES users(id),
  phone VARCHAR(20),
  email VARCHAR(255),
  capacity_sqft DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, code)
);

CREATE TABLE warehouse_racks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  rack_code VARCHAR(50) NOT NULL,
  bin_code VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, rack_code, bin_code)
);

-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  alternate_phone VARCHAR(20),
  gst_number VARCHAR(20),
  pan_number VARCHAR(20),
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(10),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  credit_days INTEGER DEFAULT 30,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  alternate_phone VARCHAR(20),
  gst_number VARCHAR(20),
  pan_number VARCHAR(20),
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  pincode VARCHAR(10),
  shipping_address TEXT,
  credit_days INTEGER DEFAULT 30,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- MATERIAL CATEGORIES
-- ============================================================

CREATE TABLE material_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES material_categories(id),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATERIALS (Master)
-- ============================================================

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES material_categories(id),
  supplier_id UUID REFERENCES suppliers(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  description TEXT,
  unit material_unit NOT NULL DEFAULT 'piece',
  secondary_unit material_unit,
  conversion_factor DECIMAL(10,4) DEFAULT 1,
  hsn_code VARCHAR(20),
  gst_percent DECIMAL(5,2) DEFAULT 0,
  image_url TEXT,
  purchase_rate DECIMAL(15,2) DEFAULT 0,
  sale_rate DECIMAL(15,2) DEFAULT 0,
  mrp DECIMAL(15,2) DEFAULT 0,
  opening_stock DECIMAL(15,3) DEFAULT 0,
  current_stock DECIMAL(15,3) DEFAULT 0,
  reserved_stock DECIMAL(15,3) DEFAULT 0,
  damaged_stock DECIMAL(15,3) DEFAULT 0,
  in_production_stock DECIMAL(15,3) DEFAULT 0,
  in_transit_stock DECIMAL(15,3) DEFAULT 0,
  minimum_stock DECIMAL(15,3) DEFAULT 0,
  reorder_level DECIMAL(15,3) DEFAULT 0,
  reorder_quantity DECIMAL(15,3) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  warehouse_id UUID REFERENCES warehouses(id),
  rack_id UUID REFERENCES warehouse_racks(id),
  barcode VARCHAR(100),
  qr_code TEXT,
  is_raw_material BOOLEAN DEFAULT TRUE,
  is_finished_good BOOLEAN DEFAULT FALSE,
  is_semi_finished BOOLEAN DEFAULT FALSE,
  is_consumable BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(company_id, code)
);

CREATE INDEX idx_materials_company ON materials(company_id);
CREATE INDEX idx_materials_code ON materials(code);
CREATE INDEX idx_materials_category ON materials(category_id);
CREATE INDEX idx_materials_low_stock ON materials(company_id, current_stock, minimum_stock);

-- ============================================================
-- STOCK TRANSACTIONS
-- ============================================================

CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  warehouse_id UUID REFERENCES warehouses(id),
  rack_id UUID REFERENCES warehouse_racks(id),
  transaction_type transaction_type NOT NULL,
  stock_type stock_type DEFAULT 'available',
  quantity DECIMAL(15,3) NOT NULL,
  rate DECIMAL(15,2),
  amount DECIMAL(15,2),
  reference_type VARCHAR(100),
  reference_id UUID,
  reference_number VARCHAR(100),
  batch_number VARCHAR(100),
  lot_number VARCHAR(100),
  expiry_date DATE,
  notes TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_transactions_company ON stock_transactions(company_id);
CREATE INDEX idx_stock_transactions_material ON stock_transactions(material_id);
CREATE INDEX idx_stock_transactions_reference ON stock_transactions(reference_type, reference_id);
CREATE INDEX idx_stock_transactions_date ON stock_transactions(created_at);

-- ============================================================
-- GOODS RECEIPT NOTES (GRN)
-- ============================================================

CREATE TABLE grn (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  grn_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  warehouse_id UUID REFERENCES warehouses(id),
  supplier_invoice_number VARCHAR(100),
  supplier_invoice_date DATE,
  vehicle_number VARCHAR(50),
  challan_number VARCHAR(100),
  challan_url TEXT,
  lr_number VARCHAR(100),
  transport_name VARCHAR(255),
  po_reference VARCHAR(100),
  received_by UUID REFERENCES users(id),
  qc_status qc_status DEFAULT 'pending',
  qc_checked_by UUID REFERENCES users(id),
  qc_checked_at TIMESTAMPTZ,
  qc_notes TEXT,
  total_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE grn_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id UUID NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  ordered_quantity DECIMAL(15,3),
  received_quantity DECIMAL(15,3) NOT NULL,
  accepted_quantity DECIMAL(15,3),
  rejected_quantity DECIMAL(15,3) DEFAULT 0,
  unit material_unit NOT NULL,
  rate DECIMAL(15,2),
  gst_percent DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(15,2),
  batch_number VARCHAR(100),
  lot_number VARCHAR(100),
  expiry_date DATE,
  rack_id UUID REFERENCES warehouse_racks(id),
  notes TEXT
);

-- ============================================================
-- WORKFLOW STAGES (Dynamic per company/industry)
-- ============================================================

CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  industry_type industry_type,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL,
  department VARCHAR(100),
  assigned_role UUID REFERENCES roles(id),
  color VARCHAR(20) DEFAULT '#3B82F6',
  icon VARCHAR(50),
  is_qc_stage BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  approval_role UUID REFERENCES roles(id),
  custom_fields JSONB DEFAULT '[]',
  notify_on_enter BOOLEAN DEFAULT TRUE,
  notify_on_complete BOOLEAN DEFAULT TRUE,
  sla_hours INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, sequence_order)
);

-- ============================================================
-- PRODUCTION ORDERS
-- ============================================================

CREATE TABLE production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_number VARCHAR(100) UNIQUE NOT NULL,
  sales_order_id UUID,
  customer_id UUID REFERENCES customers(id),
  workflow_template_id UUID REFERENCES workflow_templates(id),
  product_material_id UUID REFERENCES materials(id),
  planned_quantity DECIMAL(15,3) NOT NULL,
  produced_quantity DECIMAL(15,3) DEFAULT 0,
  rejected_quantity DECIMAL(15,3) DEFAULT 0,
  wastage_quantity DECIMAL(15,3) DEFAULT 0,
  current_stage_id UUID REFERENCES workflow_stages(id),
  status production_status DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'normal',
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date TIMESTAMPTZ,
  actual_end_date TIMESTAMPTZ,
  batch_number VARCHAR(100),
  lot_number VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_production_orders_company ON production_orders(company_id);
CREATE INDEX idx_production_orders_status ON production_orders(status);
CREATE INDEX idx_production_orders_date ON production_orders(planned_start_date, planned_end_date);

-- ============================================================
-- PRODUCTION STAGE LOGS (Tracking per stage)
-- ============================================================

CREATE TABLE production_stage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES workflow_stages(id),
  operator_id UUID REFERENCES users(id),
  machine_id UUID,
  input_quantity DECIMAL(15,3),
  output_quantity DECIMAL(15,3),
  rejection_quantity DECIMAL(15,3) DEFAULT 0,
  wastage_quantity DECIMAL(15,3) DEFAULT 0,
  status production_status DEFAULT 'pending',
  qc_status qc_status DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_taken_minutes INTEGER,
  notes TEXT,
  images JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  custom_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE production_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  planned_quantity DECIMAL(15,3) NOT NULL,
  consumed_quantity DECIMAL(15,3) DEFAULT 0,
  unit material_unit NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id),
  notes TEXT
);

-- ============================================================
-- QC REPORTS
-- ============================================================

CREATE TABLE qc_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reference_type VARCHAR(100) NOT NULL,
  reference_id UUID NOT NULL,
  stage_log_id UUID REFERENCES production_stage_logs(id),
  inspector_id UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  total_quantity DECIMAL(15,3),
  passed_quantity DECIMAL(15,3),
  failed_quantity DECIMAL(15,3),
  status qc_status DEFAULT 'pending',
  inspection_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  rejection_reason TEXT,
  images JSONB DEFAULT '[]',
  parameters JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SALES ORDERS
-- ============================================================

CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_number VARCHAR(100) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'normal',
  total_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) DEFAULT 0,
  payment_terms VARCHAR(255),
  delivery_terms VARCHAR(255),
  shipping_address TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity DECIMAL(15,3) NOT NULL,
  delivered_quantity DECIMAL(15,3) DEFAULT 0,
  unit material_unit NOT NULL,
  rate DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  gst_percent DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(15,2),
  notes TEXT
);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  sales_order_id UUID REFERENCES sales_orders(id),
  dispatch_id UUID,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_terms VARCHAR(255),
  billing_address TEXT,
  shipping_address TEXT,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_amount DECIMAL(15,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_tax_amount DECIMAL(15,2) DEFAULT 0,
  round_off DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  balance_amount DECIMAL(15,2) DEFAULT 0,
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  status VARCHAR(50) DEFAULT 'draft',
  eway_bill_number VARCHAR(100),
  eway_bill_url TEXT,
  qr_code TEXT,
  barcode TEXT,
  pdf_url TEXT,
  notes TEXT,
  terms_conditions TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  description TEXT NOT NULL,
  hsn_code VARCHAR(20),
  quantity DECIMAL(15,3) NOT NULL,
  unit material_unit NOT NULL DEFAULT 'piece',
  rate DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_amount DECIMAL(15,2),
  gst_percent DECIMAL(5,2) DEFAULT 0,
  cgst_percent DECIMAL(5,2) DEFAULT 0,
  sgst_percent DECIMAL(5,2) DEFAULT 0,
  igst_percent DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL,
  sequence_order INTEGER DEFAULT 1
);

-- ============================================================
-- DISPATCHES
-- ============================================================

CREATE TABLE dispatches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dispatch_number VARCHAR(100) UNIQUE NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID REFERENCES customers(id),
  warehouse_id UUID REFERENCES warehouses(id),
  dispatch_date TIMESTAMPTZ,
  expected_delivery_date DATE,
  actual_delivery_date TIMESTAMPTZ,
  transport_name VARCHAR(255),
  transport_contact VARCHAR(20),
  vehicle_number VARCHAR(50),
  driver_name VARCHAR(255),
  driver_contact VARCHAR(20),
  lr_number VARCHAR(100),
  lr_url TEXT,
  eway_bill_number VARCHAR(100),
  destination_address TEXT,
  destination_city VARCHAR(100),
  destination_state VARCHAR(100),
  destination_pincode VARCHAR(10),
  total_packages INTEGER DEFAULT 0,
  total_weight DECIMAL(15,3),
  weight_unit VARCHAR(20) DEFAULT 'kg',
  freight_amount DECIMAL(15,2) DEFAULT 0,
  status dispatch_status DEFAULT 'ready',
  tracking_url TEXT,
  gps_lat DECIMAL(10,7),
  gps_lng DECIMAL(10,7),
  delivery_notes TEXT,
  receiver_name VARCHAR(255),
  receiver_signature_url TEXT,
  pod_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE dispatch_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  invoice_item_id UUID REFERENCES invoice_items(id),
  description TEXT NOT NULL,
  quantity DECIMAL(15,3) NOT NULL,
  unit material_unit NOT NULL DEFAULT 'piece',
  packages INTEGER DEFAULT 1,
  weight DECIMAL(15,3),
  notes TEXT
);

CREATE TABLE dispatch_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  status dispatch_status NOT NULL,
  location VARCHAR(255),
  gps_lat DECIMAL(10,7),
  gps_lng DECIMAL(10,7),
  notes TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WAREHOUSE TRANSFERS
-- ============================================================

CREATE TABLE warehouse_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transfer_number VARCHAR(100) UNIQUE NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  transfer_date TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE warehouse_transfer_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID NOT NULL REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit material_unit NOT NULL,
  from_rack_id UUID REFERENCES warehouse_racks(id),
  to_rack_id UUID REFERENCES warehouse_racks(id),
  notes TEXT
);

-- ============================================================
-- INVOICE PAYMENTS
-- ============================================================

CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode VARCHAR(50) DEFAULT 'bank_transfer',
  reference_number VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reference_type VARCHAR(100),
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_sent_email BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20) DEFAULT 'normal',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_company ON notifications(company_id);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  action audit_action NOT NULL,
  module VARCHAR(100) NOT NULL,
  record_id UUID,
  record_type VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================================
-- MACHINES
-- ============================================================

CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  type VARCHAR(100),
  manufacturer VARCHAR(255),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  warehouse_id UUID REFERENCES warehouses(id),
  department VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  purchase_date DATE,
  warranty_expires DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- REPORTS (Saved/Scheduled)
-- ============================================================

CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  filters JSONB DEFAULT '{}',
  columns JSONB DEFAULT '[]',
  is_scheduled BOOLEAN DEFAULT FALSE,
  schedule_cron VARCHAR(100),
  schedule_recipients JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT UPLOADS
-- ============================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  reference_type VARCHAR(100),
  reference_id UUID,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_reference ON documents(reference_type, reference_id);

-- ============================================================
-- TALLY SYNC QUEUE
-- ============================================================

CREATE TABLE tally_sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sync_type VARCHAR(100) NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(100),
  data JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_production_orders_updated_at BEFORE UPDATE ON production_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_dispatches_updated_at BEFORE UPDATE ON dispatches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sales_orders_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_workflow_stages_updated_at BEFORE UPDATE ON workflow_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW v_material_stock AS
SELECT
  m.id,
  m.company_id,
  m.code,
  m.name,
  m.unit,
  m.current_stock,
  m.reserved_stock,
  m.damaged_stock,
  m.in_production_stock,
  m.in_transit_stock,
  m.minimum_stock,
  m.reorder_level,
  m.purchase_rate,
  (m.current_stock * m.purchase_rate) AS stock_value,
  CASE WHEN m.current_stock <= m.minimum_stock THEN TRUE ELSE FALSE END AS is_low_stock,
  CASE WHEN m.current_stock <= m.reorder_level THEN TRUE ELSE FALSE END AS needs_reorder,
  c.name AS category_name,
  w.name AS warehouse_name
FROM materials m
LEFT JOIN material_categories c ON m.category_id = c.id
LEFT JOIN warehouses w ON m.warehouse_id = w.id
WHERE m.deleted_at IS NULL;

CREATE VIEW v_production_overview AS
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
    WHEN po.planned_end_date < CURRENT_DATE AND po.status NOT IN ('completed', 'cancelled') THEN TRUE
    ELSE FALSE
  END AS is_delayed
FROM production_orders po
LEFT JOIN materials m ON po.product_material_id = m.id
LEFT JOIN customers c ON po.customer_id = c.id
LEFT JOIN workflow_stages ws ON po.current_stage_id = ws.id
LEFT JOIN workflow_templates wt ON po.workflow_template_id = wt.id
WHERE po.deleted_at IS NULL;

CREATE VIEW v_dispatch_overview AS
SELECT
  d.id,
  d.company_id,
  d.dispatch_number,
  d.status,
  d.dispatch_date,
  d.expected_delivery_date,
  d.actual_delivery_date,
  d.vehicle_number,
  d.transport_name,
  d.destination_city,
  d.destination_state,
  c.name AS customer_name,
  i.invoice_number,
  CASE
    WHEN d.expected_delivery_date < CURRENT_DATE AND d.status NOT IN ('delivered', 'returned') THEN TRUE
    ELSE FALSE
  END AS is_delayed
FROM dispatches d
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN invoices i ON d.invoice_id = i.id
WHERE d.deleted_at IS NULL;
