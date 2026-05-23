const express = require('express');
const router = express.Router();
const c = require('../controllers/accounting.controller');
const checkModuleAccess = require('../middleware/checkModuleAccess');

router.use(checkModuleAccess('accounting'));

// Init / seed default COA
router.post('/init', c.initCompanyAccounts);

// Account groups
router.get('/account-groups',       c.getAccountGroups);
router.post('/account-groups',      c.createAccountGroup);

// Ledger masters (accounts)
router.get('/accounts',             c.getAccounts);
router.get('/accounts/:id',         c.getAccountById);
router.post('/accounts',            c.createAccount);
router.put('/accounts/:id',         c.updateAccount);

// Vouchers
router.get('/vouchers',             c.getVouchers);
router.post('/vouchers',            c.createVoucher);
router.get('/vouchers/:id',         c.getVoucherById);
router.patch('/vouchers/:id/cancel',c.cancelVoucher);

// Day book
router.get('/day-book',             c.getDayBook);

// Ledger statement per account
router.get('/ledger/:accountId',    c.getLedgerStatement);

// Reports
router.get('/trial-balance',        c.getTrialBalance);
router.get('/profit-loss',          c.getProfitLoss);
router.get('/balance-sheet',        c.getBalanceSheet);

// GST rates
router.get('/gst-rates',            c.getGstRates);

module.exports = router;
