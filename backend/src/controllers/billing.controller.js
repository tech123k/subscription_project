const { query, transaction } = require('../config/database');
const rzp = require('../services/razorpay.service');
const emailService = require('../services/email.service');

// ── helpers ───────────────────────────────────────────────────────────────────

const nextInvoiceNumber = async (client) => {
  await client.query(
    `UPDATE billing_invoice_counter SET last_number = last_number + 1, updated_at = NOW()`
  );
  const { rows } = await client.query('SELECT last_number FROM billing_invoice_counter');
  return `SINV-${new Date().getFullYear()}-${String(rows[0].last_number).padStart(5, '0')}`;
};

const createBillingInvoice = async (client, { companyId, paymentId, planName, billingCycle, amount, periodStart, periodEnd }) => {
  const invoiceNumber = await nextInvoiceNumber(client);
  const gstRate       = 18;
  const subtotal      = parseFloat(amount);
  const gstAmount     = parseFloat((subtotal * gstRate / 118).toFixed(2));
  const netAmount     = parseFloat((subtotal - gstAmount).toFixed(2));

  const { rows: [inv] } = await client.query(
    `INSERT INTO billing_invoices
       (company_id, payment_id, invoice_number, plan_name, billing_cycle,
        billing_period_start, billing_period_end, subtotal, gst_rate, gst_amount, total_amount, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'issued') RETURNING *`,
    [companyId, paymentId, invoiceNumber, planName, billingCycle,
     periodStart, periodEnd, netAmount, gstRate, gstAmount, subtotal]
  );
  return inv;
};

// ── POST /api/billing/start-trial ─────────────────────────────────────────────
exports.startTrial = async (req, res) => {
  const companyId = req.companyId;
  const { planCode = 'growth' } = req.body;

  try {
    const { rows: [plan] } = await query('SELECT * FROM plans WHERE code=$1 AND is_active=TRUE', [planCode]);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const trialEndsAt = new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO company_subscriptions
         (company_id, plan_id, status, billing_cycle, trial_ends_at)
       VALUES ($1,$2,'trial','monthly',$3)
       ON CONFLICT (company_id) DO UPDATE
         SET plan_id=$2, status='trial', trial_ends_at=$3, updated_at=NOW()`,
      [companyId, plan.id, trialEndsAt]
    );

    res.json({ success: true, message: `${plan.trial_days}-day trial started`, trialEndsAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/billing/create-subscription ─────────────────────────────────────
exports.createSubscription = async (req, res) => {
  const companyId = req.companyId;
  const { planCode, billingCycle = 'monthly' } = req.body;

  if (!planCode) return res.status(400).json({ success: false, message: 'planCode required' });

  try {
    const { rows: [plan] } = await query('SELECT * FROM plans WHERE code=$1 AND is_active=TRUE', [planCode]);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const razorpayPlanId = billingCycle === 'yearly'
      ? plan.razorpay_yearly_plan_id
      : plan.razorpay_monthly_plan_id;

    if (!razorpayPlanId) {
      // No Razorpay plan configured — return a mock for dev/test
      return res.json({
        success: true,
        data: {
          mode: 'manual',
          planId: plan.id,
          planCode,
          billingCycle,
          amount: billingCycle === 'yearly' ? plan.yearly_price : plan.monthly_price,
          currency: 'INR',
          keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_PLACEHOLDER',
        },
      });
    }

    const rzpSub = await rzp.createSubscription({
      razorpayPlanId,
      totalCount: billingCycle === 'yearly' ? 12 : 120,
      notes: { companyId, planCode, billingCycle },
    });

    // Save pending subscription
    await query(
      `INSERT INTO company_subscriptions
         (company_id, plan_id, razorpay_subscription_id, status, billing_cycle)
       VALUES ($1,$2,$3,'trial',$4)
       ON CONFLICT (company_id) DO UPDATE
         SET plan_id=$2, razorpay_subscription_id=$3, billing_cycle=$4, updated_at=NOW()`,
      [companyId, plan.id, rzpSub.id, billingCycle]
    );

    res.json({
      success: true,
      data: {
        subscriptionId: rzpSub.id,
        shortUrl: rzpSub.short_url,
        keyId: process.env.RAZORPAY_KEY_ID,
        amount: billingCycle === 'yearly' ? plan.yearly_price : plan.monthly_price,
        planName: plan.name,
        billingCycle,
      },
    });
  } catch (err) {
    console.error('createSubscription error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/billing/verify-payment ──────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  const companyId = req.companyId;
  const {
    razorpayPaymentId,
    razorpaySubscriptionId,
    razorpaySignature,
    planCode,
    billingCycle = 'monthly',
    amount,
  } = req.body;

  // Verify signature
  const valid = rzp.verifySubscriptionSignature({
    razorpayPaymentId,
    razorpaySubscriptionId,
    razorpaySignature,
  });

  if (!valid) {
    return res.status(400).json({ success: false, message: 'Invalid payment signature' });
  }

  try {
    await transaction(async (client) => {
      const { rows: [plan] } = await client.query('SELECT * FROM plans WHERE code=$1', [planCode || 'growth']);
      const now      = new Date();
      const expiry   = new Date(now);
      const nextBill = new Date(now);

      if (billingCycle === 'yearly') {
        expiry.setFullYear(expiry.getFullYear() + 1);
        nextBill.setFullYear(nextBill.getFullYear() + 1);
      } else {
        expiry.setMonth(expiry.getMonth() + 1);
        nextBill.setMonth(nextBill.getMonth() + 1);
      }

      // Activate subscription
      await client.query(
        `UPDATE company_subscriptions SET
           plan_id=$1, razorpay_subscription_id=$2, status='active',
           billing_cycle=$3, start_date=$4, expiry_date=$5, next_billing_date=$6,
           trial_ends_at=NULL, updated_at=NOW()
         WHERE company_id=$7`,
        [plan?.id, razorpaySubscriptionId, billingCycle,
         now.toISOString().slice(0, 10),
         expiry.toISOString().slice(0, 10),
         nextBill.toISOString().slice(0, 10),
         companyId]
      );

      // Record payment
      const { rows: [payment] } = await client.query(
        `INSERT INTO billing_payments
           (company_id, razorpay_payment_id, razorpay_subscription_id, amount, currency, status, payment_method, paid_at)
         VALUES ($1,$2,$3,$4,'INR','captured','razorpay',NOW()) RETURNING *`,
        [companyId, razorpayPaymentId, razorpaySubscriptionId, amount || 0]
      );

      // Create invoice
      await createBillingInvoice(client, {
        companyId,
        paymentId: payment.id,
        planName: plan?.name || planCode,
        billingCycle,
        amount: amount || 0,
        periodStart: now.toISOString().slice(0, 10),
        periodEnd: expiry.toISOString().slice(0, 10),
      });
    });

    res.json({ success: true, message: 'Subscription activated successfully' });
  } catch (err) {
    console.error('verifyPayment error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/billing/cancel-subscription ─────────────────────────────────────
exports.cancelSubscription = async (req, res) => {
  const companyId = req.companyId;
  const { cancelReason } = req.body;

  try {
    const { rows: [sub] } = await query(
      'SELECT * FROM company_subscriptions WHERE company_id=$1', [companyId]
    );
    if (!sub) return res.status(404).json({ success: false, message: 'No active subscription' });

    // Cancel in Razorpay if linked
    if (sub.razorpay_subscription_id) {
      try {
        await rzp.cancelSubscription(sub.razorpay_subscription_id, true);
      } catch (_) { /* Razorpay cancel failure should not block DB update */ }
    }

    await query(
      `UPDATE company_subscriptions SET
         status='cancelled', cancelled_at=NOW(), cancel_reason=$1, updated_at=NOW()
       WHERE company_id=$2`,
      [cancelReason || null, companyId]
    );

    res.json({ success: true, message: 'Subscription cancelled. Access continues until expiry date.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/billing/webhook (NO auth — Razorpay posts here) ─────────────────
exports.handleWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody   = req.rawBody; // set in app.js via express.raw()

  if (!rzp.verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const { event, payload } = req.body;

  try {
    switch (event) {
      case 'subscription.activated': {
        const sub = payload.subscription?.entity;
        if (!sub) break;
        await query(
          `UPDATE company_subscriptions SET status='active', updated_at=NOW()
           WHERE razorpay_subscription_id=$1`,
          [sub.id]
        );
        break;
      }

      case 'payment.captured': {
        const payment = payload.payment?.entity;
        if (!payment) break;

        const subscriptionId = payment.subscription_id;
        if (!subscriptionId) break;

        const { rows: [companySub] } = await query(
          'SELECT * FROM company_subscriptions WHERE razorpay_subscription_id=$1',
          [subscriptionId]
        );
        if (!companySub) break;

        await transaction(async (client) => {
          const { rows: [pay] } = await client.query(
            `INSERT INTO billing_payments
               (company_id, razorpay_payment_id, razorpay_subscription_id,
                amount, currency, status, payment_method, paid_at)
             VALUES ($1,$2,$3,$4,$5,'captured',$6,NOW())
             ON CONFLICT (razorpay_payment_id) DO NOTHING RETURNING *`,
            [companySub.company_id, payment.id, subscriptionId,
             payment.amount / 100, payment.currency || 'INR', payment.method || 'razorpay']
          );
          if (!pay) return; // already processed

          const { rows: [plan] } = await client.query('SELECT * FROM plans WHERE id=$1', [companySub.plan_id]);
          const now    = new Date();
          const expiry = new Date(now);
          companySub.billing_cycle === 'yearly'
            ? expiry.setFullYear(expiry.getFullYear() + 1)
            : expiry.setMonth(expiry.getMonth() + 1);

          await client.query(
            `UPDATE company_subscriptions SET
               status='active', expiry_date=$1, next_billing_date=$1, updated_at=NOW()
             WHERE id=$2`,
            [expiry.toISOString().slice(0, 10), companySub.id]
          );

          await createBillingInvoice(client, {
            companyId:   companySub.company_id,
            paymentId:   pay.id,
            planName:    plan?.name || 'Subscription',
            billingCycle: companySub.billing_cycle,
            amount:      payment.amount / 100,
            periodStart: now.toISOString().slice(0, 10),
            periodEnd:   expiry.toISOString().slice(0, 10),
          });
        });
        break;
      }

      case 'subscription.cancelled': {
        const sub = payload.subscription?.entity;
        if (!sub) break;
        await query(
          `UPDATE company_subscriptions SET status='cancelled', cancelled_at=NOW(), updated_at=NOW()
           WHERE razorpay_subscription_id=$1`,
          [sub.id]
        );
        break;
      }

      case 'payment.failed': {
        const payment = payload.payment?.entity;
        if (!payment?.subscription_id) break;
        await query(
          `UPDATE company_subscriptions SET status='past_due', updated_at=NOW()
           WHERE razorpay_subscription_id=$1`,
          [payment.subscription_id]
        );
        // Record failed payment
        await query(
          `INSERT INTO billing_payments
             (company_id, razorpay_payment_id, razorpay_subscription_id, amount, currency, status, error_reason)
           SELECT company_id, $1, $2, $3, 'INR', 'failed', $4
           FROM company_subscriptions WHERE razorpay_subscription_id=$2
           ON CONFLICT (razorpay_payment_id) DO NOTHING`,
          [payment.id, payment.subscription_id, (payment.amount || 0) / 100, payment.error_reason || 'Payment failed']
        );
        break;
      }

      default:
        break;
    }
    res.json({ success: true, received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
