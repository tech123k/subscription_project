const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/product.controller');

// Static/aggregate routes — must come before /:id
router.get('/categories', ctrl.getCategories);
router.get('/summary',    ctrl.getSummary);
router.get('/analytics',  ctrl.getAnalytics);

// Collection
router.get('/',    ctrl.getAll);
router.post('/',   ctrl.create);

// Per-product
router.get('/:id',               ctrl.getOne);
router.get('/:id/bom-calculate', ctrl.getBOMForQuantity);
router.get('/:id/history',       ctrl.getProductHistory);
router.put('/:id',               ctrl.update);
router.delete('/:id',            ctrl.remove);

// Stock management
router.post('/:id/adjust-stock',    ctrl.adjustStock);
router.post('/:id/reserve-stock',   ctrl.reserveStock);
router.post('/:id/release-reserve', ctrl.releaseReserve);

module.exports = router;
