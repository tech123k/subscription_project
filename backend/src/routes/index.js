const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const { ensureCompanyAccess, injectCompanyId } = require('../middleware/rbac');

const authRoutes = require('./auth.routes');
const companyRoutes = require('./company.routes');
const userRoutes = require('./user.routes');
const materialRoutes = require('./material.routes');
const warehouseRoutes = require('./warehouse.routes');
const supplierRoutes = require('./supplier.routes');
const customerRoutes = require('./customer.routes');
const productionRoutes = require('./production.routes');
const workflowRoutes = require('./workflow.routes');
const dispatchRoutes = require('./dispatch.routes');
const invoiceRoutes = require('./invoice.routes');
const dashboardRoutes = require('./dashboard.routes');
const reportRoutes = require('./report.routes');
const notificationRoutes = require('./notification.routes');
const auditRoutes = require('./audit.routes');
const grnRoutes = require('./grn.routes');
const poRoutes = require('./po.routes');
const productRoutes = require('./product.routes');
const bomRoutes = require('./bom.routes');
const variantRoutes = require('./variant.routes');
const ledgerRoutes = require('./ledger.routes');
const salesOrderRoutes = require('./salesorder.routes');
const creditRoutes = require('./credit.routes');
const searchRoutes = require('./search.routes');

// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use(authenticate);

// Company management (super admin + company settings)
router.use('/companies', companyRoutes);

// Super admin company management alias
router.use('/admin/companies', require('../middleware/auth').requireSuperAdmin, companyRoutes);

// Company-scoped routes
router.use(ensureCompanyAccess, injectCompanyId);

router.use('/users', userRoutes);
router.use('/materials', materialRoutes);
router.use('/grn', grnRoutes);
router.use('/po', poRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/bom', bomRoutes);
router.use('/variants', variantRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/sales-orders', salesOrderRoutes);
router.use('/credit', creditRoutes);
router.use('/production', productionRoutes);
router.use('/workflows', workflowRoutes);
router.use('/dispatches', dispatchRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit', auditRoutes);
router.use('/search', searchRoutes);

module.exports = router;
