const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/report.controller');

router.get('/stock', ctrl.stockReport);
router.get('/production', ctrl.productionReport);
router.get('/financial', ctrl.financialReport);
router.get('/dispatch', ctrl.dispatchReport);
router.get('/stock-transactions', ctrl.stockTransactionReport);
router.get('/audit', ctrl.auditReport);

module.exports = router;
