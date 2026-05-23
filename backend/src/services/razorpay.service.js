const crypto = require('crypto');
const https  = require('https');

const BASE_HOST = 'api.razorpay.com';

// ── Generic HTTPS request helper ───────────────────────────────────────────────
const rzpRequest = (method, path, body) =>
  new Promise((resolve, reject) => {
    const auth    = Buffer.from(`${process.env.RAZORPAY_KEY_ID || ''}:${process.env.RAZORPAY_KEY_SECRET || ''}`).toString('base64');
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: BASE_HOST,
      path:     `/v1${path}`,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(parsed?.error?.description || `Razorpay error ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.razorpayError = parsed?.error;
            return reject(err);
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid JSON from Razorpay'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Razorpay request timed out')); });
    if (payload) req.write(payload);
    req.end();
  });

// ── Create a Razorpay Plan (for recurring billing) ─────────────────────────────
const createRazorpayPlan = ({ name, amount, period, interval = 1, currency = 'INR' }) =>
  rzpRequest('POST', '/plans', {
    period,
    interval,
    item: { name, amount: Math.round(amount * 100), currency },
  });

// ── Create a Subscription ──────────────────────────────────────────────────────
const createSubscription = ({ razorpayPlanId, totalCount = 120, quantity = 1, startAt, customerNotify = 1, notes = {} }) => {
  const payload = {
    plan_id:         razorpayPlanId,
    total_count:     totalCount,
    quantity,
    customer_notify: customerNotify,
    notes,
  };
  if (startAt) payload.start_at = Math.floor(new Date(startAt).getTime() / 1000);
  return rzpRequest('POST', '/subscriptions', payload);
};

// ── Cancel a Subscription ──────────────────────────────────────────────────────
const cancelSubscription = (razorpaySubscriptionId, cancelAtCycleEnd = true) =>
  rzpRequest('POST', `/subscriptions/${razorpaySubscriptionId}/cancel`, {
    cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
  });

// ── Fetch Subscription Details ─────────────────────────────────────────────────
const getSubscription = (razorpaySubscriptionId) =>
  rzpRequest('GET', `/subscriptions/${razorpaySubscriptionId}`);

// ── Verify Payment Signature (checkout) ───────────────────────────────────────
const verifyPaymentSignature = ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const body     = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body)
    .digest('hex');
  return expected === razorpaySignature;
};

// ── Verify Subscription Payment Signature ─────────────────────────────────────
const verifySubscriptionSignature = ({ razorpayPaymentId, razorpaySubscriptionId, razorpaySignature }) => {
  const body     = `${razorpayPaymentId}|${razorpaySubscriptionId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body)
    .digest('hex');
  return expected === razorpaySignature;
};

// ── Verify Webhook Signature ───────────────────────────────────────────────────
const verifyWebhookSignature = (rawBody, signature) => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(rawBody)
    .digest('hex');
  return expected === signature;
};

module.exports = {
  createRazorpayPlan,
  createSubscription,
  cancelSubscription,
  getSubscription,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
};
