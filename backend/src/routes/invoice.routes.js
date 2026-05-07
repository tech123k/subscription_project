const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/invoice.controller');

router.get('/', ctrl.getAll);
router.get('/export', ctrl.exportInvoices);
router.get('/:id', ctrl.getOne);
router.get('/:id/pdf', ctrl.generatePDF);
router.post('/', ctrl.create);
router.patch('/:id/payment', ctrl.updatePayment);
router.post('/:id/payments', ctrl.addPayment);

module.exports = router;
