const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dispatch.controller');

router.get('/', ctrl.getAll);
router.get('/export', ctrl.exportDispatches);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.patch('/:id/status', ctrl.updateStatus);

module.exports = router;
