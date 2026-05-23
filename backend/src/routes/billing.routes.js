const express = require('express');
const router  = express.Router();
const c       = require('../controllers/billing.controller');
const { authenticate } = require('../middleware/auth');
const { ensureCompanyAccess, injectCompanyId } = require('../middleware/rbac');

// ── Webhook — NO auth (Razorpay posts here directly) ─────────────────────────
// Must be mounted BEFORE the auth middleware in index.js
// Uses express.raw() body for signature verification — handled in app.js
router.post('/webhook', c.handleWebhook);

// ── Authenticated billing routes ──────────────────────────────────────────────
router.use(authenticate, ensureCompanyAccess, injectCompanyId);

router.post('/start-trial',           c.startTrial);
router.post('/create-subscription',   c.createSubscription);
router.post('/verify-payment',        c.verifyPayment);
router.post('/cancel-subscription',   c.cancelSubscription);

module.exports = router;
