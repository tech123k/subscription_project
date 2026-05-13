import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/ui/LoadingScreen';

// Auth pages (eager — needed immediately)
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));

const MaterialList = lazy(() => import('./pages/materials/MaterialList'));
const MaterialForm = lazy(() => import('./pages/material/MaterialForm'));
const MaterialDetail = lazy(() => import('./pages/material/MaterialDetail'));
const GRNList = lazy(() => import('./pages/material/GRNList'));
const GRNForm = lazy(() => import('./pages/material/GRNForm'));
const MaterialImport = lazy(() => import('./pages/material/MaterialImport'));
const POList = lazy(() => import('./pages/purchase/POList'));
const POForm = lazy(() => import('./pages/purchase/POForm'));
const PODetail = lazy(() => import('./pages/purchase/PODetail'));

const ProductionList = lazy(() => import('./pages/production/ProductionList'));
const ProductionForm = lazy(() => import('./pages/production/ProductionForm'));
const ProductionDetail = lazy(() => import('./pages/production/ProductionDetail'));
const WorkflowBuilder = lazy(() => import('./pages/production/WorkflowBuilder'));
const ProductList = lazy(() => import('./pages/production/ProductList'));
const ProductForm = lazy(() => import('./pages/production/ProductForm'));
const BOMBuilder = lazy(() => import('./pages/production/BOMBuilder'));
const AttributeMaster = lazy(() => import('./pages/production/AttributeMaster'));
const VariantBuilder = lazy(() => import('./pages/production/VariantBuilder'));

const SalesOrderList   = lazy(() => import('./pages/sales/SalesOrderList'));
const SalesOrderForm   = lazy(() => import('./pages/sales/SalesOrderForm'));
const SalesOrderDetail = lazy(() => import('./pages/sales/SalesOrderDetail'));

const InventoryLedger    = lazy(() => import('./pages/inventory/InventoryLedger'));
const CreditOutstanding  = lazy(() => import('./pages/credit/CreditOutstanding'));

const DispatchList = lazy(() => import('./pages/dispatch/DispatchList'));
const DispatchForm = lazy(() => import('./pages/dispatch/DispatchForm'));
const DispatchDetail = lazy(() => import('./pages/dispatch/DispatchDetail'));

const InvoiceList = lazy(() => import('./pages/invoice/InvoiceList'));
const InvoiceForm = lazy(() => import('./pages/invoice/InvoiceForm'));
const InvoiceDetail = lazy(() => import('./pages/invoice/InvoiceDetail'));

const SupplierList = lazy(() => import('./pages/SupplierList'));
const CustomerList = lazy(() => import('./pages/CustomerList'));

const WarehouseList = lazy(() => import('./pages/WarehouseList'));
const WarehouseDetail = lazy(() => import('./pages/WarehouseDetail'));

const Reports = lazy(() => import('./pages/Reports'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const CompanySettings = lazy(() => import('./pages/CompanySettings'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const CompanyList = lazy(() => import('./pages/superadmin/CompanyList'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Protected route — redirects to /login if unauthenticated
const ProtectedRoute = () => {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <Layout><Outlet /></Layout>;
};

// Super-admin only route
const SuperAdminRoute = () => {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

// Admin route (company_admin or super_admin)
const AdminRoute = () => {
  const isAdmin = useAuthStore((s) => s.isCompanyAdmin() || s.isSuperAdmin());
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

const App = () => (
  <BrowserRouter>
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated routes */}
        <Route element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Materials */}
          <Route path="/materials" element={<MaterialList />} />
          <Route path="/materials/create" element={<MaterialForm />} />
          <Route path="/materials/import" element={<MaterialImport />} />
          <Route path="/materials/:id" element={<MaterialDetail />} />
          <Route path="/materials/:id/edit" element={<MaterialForm />} />
          <Route path="/grn" element={<GRNList />} />
          <Route path="/grn/create" element={<GRNForm />} />
          <Route path="/po" element={<POList />} />
          <Route path="/po/create" element={<POForm />} />
          <Route path="/po/:id" element={<PODetail />} />
          <Route path="/po/:id/edit" element={<POForm />} />

          {/* Production */}
          <Route path="/production" element={<ProductionList />} />
          <Route path="/production/create" element={<ProductionForm />} />
          <Route path="/production/workflows" element={<WorkflowBuilder />} />
          <Route path="/production/products" element={<ProductList />} />
          <Route path="/production/products/new" element={<ProductForm />} />
          <Route path="/production/products/:id/edit" element={<ProductForm />} />
          <Route path="/production/products/:productId/bom" element={<BOMBuilder />} />
          <Route path="/production/products/:productId/variants" element={<VariantBuilder />} />
          <Route path="/production/attributes" element={<AttributeMaster />} />
          <Route path="/production/:id" element={<ProductionDetail />} />

          {/* Sales Orders (OMS) */}
          <Route path="/sales-orders" element={<SalesOrderList />} />
          <Route path="/sales-orders/create" element={<SalesOrderForm />} />
          <Route path="/sales-orders/:id" element={<SalesOrderDetail />} />

          {/* Inventory Ledger */}
          <Route path="/ledger" element={<InventoryLedger />} />

          {/* Credit & Outstanding */}
          <Route path="/credit" element={<CreditOutstanding />} />

          {/* Dispatch */}
          <Route path="/dispatches" element={<DispatchList />} />
          <Route path="/dispatches/create" element={<DispatchForm />} />
          <Route path="/dispatches/:id" element={<DispatchDetail />} />

          {/* Invoices */}
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/invoices/create" element={<InvoiceForm />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />

          {/* Suppliers & Customers */}
          <Route path="/suppliers" element={<SupplierList />} />
          <Route path="/customers" element={<CustomerList />} />

          {/* Warehouses */}
          <Route path="/warehouses" element={<WarehouseList />} />
          <Route path="/warehouses/:id" element={<WarehouseDetail />} />

          {/* Reports */}
          <Route path="/reports" element={<Reports />} />

          {/* Profile */}
          <Route path="/profile" element={<ProfileSettings />} />

          {/* Admin-only routes */}
          <Route element={<AdminRoute />}>
            <Route path="/users" element={<UserManagement />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="/settings" element={<CompanySettings />} />
          </Route>

          {/* Super-admin routes */}
          <Route element={<SuperAdminRoute />}>
            <Route path="/companies" element={<CompanyList />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;
