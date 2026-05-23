const { query } = require('../config/database');

/**
 * Middleware: gate a route behind a module subscription check.
 * Usage: router.use(checkModuleAccess('accounting'))
 *
 * Access granted when:
 *   1. User is super_admin (always passes)
 *   2. Company has no subscription row (legacy mode — all modules open)
 *   3. Subscription is 'trial' AND trial has not expired
 *   4. Subscription is 'active' AND expiry_date >= today AND module is in plan
 *   5. Module is in company_modules (add-on override), enabled = true
 */
const checkModuleAccess = (moduleCode) => async (req, res, next) => {
  try {
    // Super admin bypasses everything
    if (req.user?.role === 'super_admin') return next();

    const companyId = req.companyId || req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({ success: false, message: 'No company context', code: 'NO_COMPANY' });
    }

    // Fetch subscription + plan in one query
    const { rows: [sub] } = await query(
      `SELECT cs.id, cs.status, cs.plan_id, cs.trial_ends_at,
              cs.expiry_date, cs.billing_cycle
       FROM company_subscriptions cs
       WHERE cs.company_id = $1`,
      [companyId]
    );

    // ── Legacy mode: no subscription row → open access (backward compat) ────────
    if (!sub) return next();

    // ── Trial ────────────────────────────────────────────────────────────────────
    if (sub.status === 'trial') {
      if (sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) {
        return res.status(403).json({
          success: false,
          message: 'Your free trial has expired. Please subscribe to continue.',
          code: 'TRIAL_EXPIRED',
        });
      }
      // Trial = full access to all modules
      return next();
    }

    // ── Expired / cancelled ───────────────────────────────────────────────────────
    if (['expired', 'cancelled'].includes(sub.status)) {
      return res.status(403).json({
        success: false,
        message: 'Your subscription has ended. Please renew to access this module.',
        code: 'SUBSCRIPTION_ENDED',
        status: sub.status,
      });
    }

    if (sub.expiry_date && new Date(sub.expiry_date) < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Subscription expired. Please renew.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
    }

    // ── Check if module is included in the plan ───────────────────────────────────
    if (sub.plan_id) {
      const { rows: [planAccess] } = await query(
        `SELECT 1 FROM plan_modules pm
         JOIN modules m ON m.id = pm.module_id
         WHERE pm.plan_id = $1 AND m.code = $2 AND m.is_active = TRUE`,
        [sub.plan_id, moduleCode]
      );
      if (planAccess) return next();
    }

    // ── Check add-on override ─────────────────────────────────────────────────────
    const { rows: [addon] } = await query(
      `SELECT cm.enabled FROM company_modules cm
       JOIN modules m ON m.id = cm.module_id
       WHERE cm.company_id = $1 AND m.code = $2 AND cm.enabled = TRUE AND m.is_active = TRUE`,
      [companyId, moduleCode]
    );
    if (addon) return next();

    // ── Denied ────────────────────────────────────────────────────────────────────
    return res.status(403).json({
      success: false,
      message: 'This module is not included in your current plan. Upgrade to unlock it.',
      code: 'MODULE_ACCESS_DENIED',
      moduleCode,
    });
  } catch (err) {
    console.error('checkModuleAccess error:', err.message);
    next(err);
  }
};

module.exports = checkModuleAccess;
