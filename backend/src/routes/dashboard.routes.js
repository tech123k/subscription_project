const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboard.controller');

router.get('/stats', ctrl.getStats);
router.get('/charts', ctrl.getCharts);
router.get('/warehouse-stock', ctrl.getWarehouseStock);
router.get('/production-timeline', ctrl.getProductionTimeline);
router.get('/low-stock', ctrl.getLowStockAlerts);

module.exports = router;
