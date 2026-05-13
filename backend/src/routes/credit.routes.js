const router = require('express').Router();
const {
  getCustomerCredit, getOutstandingList,
  recordPayment, updateCreditSettings, addInvoiceTransaction,
} = require('../controllers/credit.controller');

router.get('/outstanding',                         getOutstandingList);
router.get('/customers/:customerId',               getCustomerCredit);
router.put('/customers/:customerId/settings',      updateCreditSettings);
router.post('/customers/:customerId/payment',      recordPayment);
router.post('/customers/:customerId/transaction',  addInvoiceTransaction);

module.exports = router;
