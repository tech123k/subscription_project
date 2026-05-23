const express = require('express');
const router  = express.Router();
const c       = require('../controllers/subscription.controller');

// All routes require auth + company (applied in index.js via middleware chain)
router.get('/plans',           c.getPlans);
router.get('/my',              c.getMySubscription);
router.get('/modules',         c.getAccessibleModules);
router.get('/billing-history', c.getBillingHistory);
router.get('/invoices',        c.getInvoices);

module.exports = router;
