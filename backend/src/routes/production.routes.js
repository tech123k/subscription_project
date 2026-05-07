const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/production.controller');

router.get('/', ctrl.getAll);
router.get('/export', ctrl.exportOrders);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id/stage', ctrl.updateStage);
router.patch('/:id/status', ctrl.updateStatus);

module.exports = router;
