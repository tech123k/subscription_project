const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/warehouse.controller');

router.get('/', ctrl.getAll);
router.get('/transfers', ctrl.getTransfers);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.post('/transfers', ctrl.createTransfer);
router.post('/:id/racks', ctrl.addRack);
router.put('/:id', ctrl.update);

module.exports = router;
