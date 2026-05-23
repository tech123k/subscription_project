const { query } = require('../config/database');

// ── GET /api/subscription/plans ───────────────────────────────────────────────
exports.getPlans = async (req, res) => {
  try {
    const { rows: plans } = await query(
      `SELECT p.*,
              json_agg(json_build_object('code', m.code, 'name', m.name, 'icon', m.icon)
                ORDER BY m.sort_order) FILTER (WHERE m.id IS NOT NULL) AS modules
       FROM plans p
       LEFT JOIN plan_modules pm ON pm.plan_id = p.id
       LEFT JOIN modules m ON m.id = pm.module_id AND m.is_active = TRUE
       WHERE p.is_active = TRUE
       GROUP BY p.id
       ORDER BY p.monthly_price`,
    );
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/subscription/my ──────────────────────────────────────────────────
exports.getMySubscription = async (req, res) => {
  const companyId = req.companyId;
  try {
    const { rows: [sub] } = await query(
      `SELECT cs.*,
              p.name AS plan_name, p.code AS plan_code,
              p.monthly_price, p.yearly_price, p.features,
              p.max_users, p.trial_days
       FROM company_subscriptions cs
       LEFT JOIN plans p ON p.id = cs.plan_id
       WHERE cs.company_id = $1`,
      [companyId]
    );

    // No subscription → legacy open access
    if (!sub) {
      return res.json({
        success: true,
        data: {
          status: 'legacy',
          plan_name: 'Legacy (Grandfathered)',
          all_modules: true,
        },
      });
    }

    // Is trial expired?
    const trialExpired = sub.status === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date();
    const daysLeft = sub.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;

    res.json({ success: true, data: { ...sub, trialExpired, daysLeft } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/subscription/modules ─────────────────────────────────────────────
// Returns { accessible: ['dashboard','inventory',...], all: [...] }
// Used by frontend sidebar to render dynamic nav
exports.getAccessibleModules = async (req, res) => {
  const companyId = req.companyId;
  try {
    // All modules
    const { rows: allModules } = await query(
      'SELECT code, name, icon, route, sort_order FROM modules WHERE is_active=TRUE ORDER BY sort_order'
    );

    // Get subscription
    const { rows: [sub] } = await query(
      'SELECT status, plan_id, trial_ends_at, expiry_date FROM company_subscriptions WHERE company_id=$1',
      [companyId]
    );

    // Super admin or no subscription → all modules
    if (!sub || req.user?.role === 'super_admin') {
      return res.json({
        success: true,
        data: {
          accessible: allModules.map(m => m.code),
          all: allModules,
          status: sub?.status || 'legacy',
        },
      });
    }

    // Trial (not expired) → all modules
    if (sub.status === 'trial') {
      const expired = sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date();
      return res.json({
        success: true,
        data: {
          accessible: expired ? ['dashboard'] : allModules.map(m => m.code),
          all: allModules,
          status: 'trial',
          trialExpired: expired,
        },
      });
    }

    // Expired / cancelled → dashboard only
    if (['expired', 'cancelled'].includes(sub.status) ||
        (sub.expiry_date && new Date(sub.expiry_date) < new Date())) {
      return res.json({
        success: true,
        data: { accessible: ['dashboard'], all: allModules, status: sub.status },
      });
    }

    // Active — collect plan modules + add-ons
    const { rows: planMods } = await query(
      `SELECT m.code FROM plan_modules pm
       JOIN modules m ON m.id = pm.module_id
       WHERE pm.plan_id = $1 AND m.is_active = TRUE`,
      [sub.plan_id]
    );

    const { rows: addonMods } = await query(
      `SELECT m.code FROM company_modules cm
       JOIN modules m ON m.id = cm.module_id
       WHERE cm.company_id = $1 AND cm.enabled = TRUE AND m.is_active = TRUE`,
      [companyId]
    );

    const accessible = [...new Set([
      'dashboard',
      ...planMods.map(m => m.code),
      ...addonMods.map(m => m.code),
    ])];

    res.json({ success: true, data: { accessible, all: allModules, status: sub.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/subscription/billing-history ─────────────────────────────────────
exports.getBillingHistory = async (req, res) => {
  const companyId = req.companyId;
  try {
    const { rows } = await query(
      `SELECT bp.*, bi.invoice_number, bi.plan_name, bi.billing_period_start, bi.billing_period_end
       FROM billing_payments bp
       LEFT JOIN billing_invoices bi ON bi.payment_id = bp.id
       WHERE bp.company_id = $1
       ORDER BY bp.created_at DESC LIMIT 50`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/subscription/invoices ────────────────────────────────────────────
exports.getInvoices = async (req, res) => {
  const companyId = req.companyId;
  try {
    const { rows } = await query(
      `SELECT * FROM billing_invoices WHERE company_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
