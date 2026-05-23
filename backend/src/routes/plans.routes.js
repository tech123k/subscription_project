const express = require('express');
const router  = express.Router();
const c       = require('../controllers/plans.controller');
const { requireSuperAdmin } = require('../middleware/auth');

// All routes require super_admin
router.use(requireSuperAdmin);

// Plans CRUD
router.get('/',                           c.getPlans);
router.post('/',                          c.createPlan);
router.put('/:id',                        c.updatePlan);
router.put('/:id/modules',                c.setPlanModules);

// Modules
router.get('/modules',                    c.getModules);

// Subscriptions management
router.get('/subscriptions',              c.getAllSubscriptions);
router.patch('/subscriptions/:id/extend',   c.extendSubscription);
router.patch('/subscriptions/:id/plan',     c.changePlan);
router.patch('/subscriptions/:id/activate', c.manualActivate);
router.post('/subscriptions/activate',      c.manualActivate); // create new

// Company-level module overrides
router.get('/companies/:companyId/modules',  c.getCompanyModules);
router.put('/companies/:companyId/modules',  c.setCompanyModules);

// Revenue analytics
router.get('/revenue',                    c.getRevenue);

module.exports = router;
