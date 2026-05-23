const { query, transaction } = require('../config/database');

// ═══ SUPER ADMIN — PLANS ═════════════════════════════════════════════════════

exports.getPlans = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*,
              COUNT(cs.id) AS subscriber_count,
              json_agg(json_build_object('code', m.code, 'name', m.name)
                ORDER BY m.sort_order) FILTER (WHERE m.id IS NOT NULL) AS modules
       FROM plans p
       LEFT JOIN company_subscriptions cs ON cs.plan_id = p.id AND cs.status = 'active'
       LEFT JOIN plan_modules pm ON pm.plan_id = p.id
       LEFT JOIN modules m ON m.id = pm.module_id
       GROUP BY p.id
       ORDER BY p.monthly_price`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createPlan = async (req, res) => {
  const { name, code, description, monthlyPrice, yearlyPrice, trialDays, maxUsers, features, isPopular } = req.body;
  if (!name || !code) return res.status(400).json({ success: false, message: 'name and code required' });
  try {
    const { rows: [plan] } = await query(
      `INSERT INTO plans (name, code, description, monthly_price, yearly_price, trial_days, max_users, features, is_popular)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, code, description||null, monthlyPrice||0, yearlyPrice||0, trialDays||14, maxUsers||5,
       JSON.stringify(features||[]), isPopular||false]
    );
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  const { id } = req.params;
  const { name, description, monthlyPrice, yearlyPrice, trialDays, maxUsers, features, isPopular,
          isActive, razorpayMonthlyPlanId, razorpayYearlyPlanId } = req.body;
  try {
    const { rows: [plan] } = await query(
      `UPDATE plans SET
         name=$1, description=$2, monthly_price=$3, yearly_price=$4, trial_days=$5,
         max_users=$6, features=$7, is_popular=$8, is_active=$9,
         razorpay_monthly_plan_id=COALESCE($10, razorpay_monthly_plan_id),
         razorpay_yearly_plan_id=COALESCE($11, razorpay_yearly_plan_id),
         updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [name, description||null, monthlyPrice||0, yearlyPrice||0, trialDays||14,
       maxUsers||5, JSON.stringify(features||[]), isPopular||false, isActive??true,
       razorpayMonthlyPlanId||null, razorpayYearlyPlanId||null, id]
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.setPlanModules = async (req, res) => {
  const { id } = req.params;
  const { moduleCodes } = req.body; // ['inventory','production',...]
  if (!Array.isArray(moduleCodes)) return res.status(400).json({ success: false, message: 'moduleCodes array required' });
  try {
    await transaction(async (client) => {
      await client.query('DELETE FROM plan_modules WHERE plan_id=$1', [id]);
      for (const code of moduleCodes) {
        await client.query(
          `INSERT INTO plan_modules (plan_id, module_id)
           SELECT $1, m.id FROM modules m WHERE m.code=$2 ON CONFLICT DO NOTHING`,
          [id, code]
        );
      }
    });
    res.json({ success: true, message: 'Plan modules updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══ SUPER ADMIN — SUBSCRIPTIONS ══════════════════════════════════════════════

exports.getAllSubscriptions = async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  // LEFT JOIN so companies without any subscription row also appear
  let sql = `
    SELECT cs.id, cs.status, cs.billing_cycle, cs.trial_ends_at, cs.expiry_date,
           cs.next_billing_date, cs.created_at, cs.razorpay_subscription_id,
           c.id AS company_id, c.name AS company_name, c.email AS company_email,
           p.name AS plan_name, p.code AS plan_code, p.monthly_price
    FROM companies c
    LEFT JOIN company_subscriptions cs ON cs.company_id = c.id
    LEFT JOIN plans p ON p.id = cs.plan_id
    WHERE 1=1
  `;
  const params = [];
  let i = 1;
  if (status === 'none') {
    sql += ` AND cs.id IS NULL`;
  } else if (status) {
    sql += ` AND cs.status = $${i++}`;
    params.push(status);
  }
  sql += ` ORDER BY cs.created_at DESC NULLS LAST, c.name LIMIT $${i++} OFFSET $${i++}`;
  params.push(parseInt(limit), offset);
  try {
    const { rows } = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.extendSubscription = async (req, res) => {
  const { id } = req.params;
  const { days, months } = req.body;
  try {
    const { rows: [sub] } = await query('SELECT * FROM company_subscriptions WHERE id=$1', [id]);
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    const base = sub.expiry_date ? new Date(sub.expiry_date) : new Date();
    if (days)   base.setDate(base.getDate() + parseInt(days));
    if (months) base.setMonth(base.getMonth() + parseInt(months));

    const { rows: [updated] } = await query(
      `UPDATE company_subscriptions
       SET expiry_date=$1, status='active', next_billing_date=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [base.toISOString().slice(0, 10), id]
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Manually activate/create subscription for any company (no Razorpay needed)
exports.manualActivate = async (req, res) => {
  const { id } = req.params;           // existing subscription UUID or 'new'
  const { planCode, billingCycle = 'monthly', durationDays = 30, companyId } = req.body;
  try {
    // Resolve plan id
    let planId = null;
    if (planCode) {
      const { rows: [plan] } = await query('SELECT id FROM plans WHERE code=$1', [planCode]);
      if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
      planId = plan.id;
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + parseInt(durationDays));
    const expiryStr = expiry.toISOString().slice(0, 10);

    let updated;

    if (id && id !== 'new') {
      // Update an existing subscription row by its id
      const params = [expiryStr, billingCycle];
      let planSql = '';
      if (planId) { params.push(planId); planSql = `, plan_id=$${params.length}`; }
      params.push(id);
      const { rows } = await query(
        `UPDATE company_subscriptions
         SET status='active', expiry_date=$1, next_billing_date=$1,
             start_date=COALESCE(start_date, NOW()::date),
             billing_cycle=$2${planSql}, updated_at=NOW()
         WHERE id=$${params.length} RETURNING *`,
        params
      );
      updated = rows[0];
    } else {
      // Create or upsert subscription by company_id
      if (!companyId) return res.status(400).json({ success: false, message: 'companyId required' });
      const { rows } = await query(
        `INSERT INTO company_subscriptions
           (company_id, plan_id, status, billing_cycle, start_date, expiry_date, next_billing_date)
         VALUES ($1, $2, 'active', $3, NOW()::date, $4, $4)
         ON CONFLICT (company_id) DO UPDATE
           SET status='active', plan_id=EXCLUDED.plan_id, billing_cycle=EXCLUDED.billing_cycle,
               expiry_date=EXCLUDED.expiry_date, next_billing_date=EXCLUDED.next_billing_date,
               start_date=COALESCE(company_subscriptions.start_date, NOW()::date),
               updated_at=NOW()
         RETURNING *`,
        [companyId, planId, billingCycle, expiryStr]
      );
      updated = rows[0];
    }

    if (!updated) return res.status(404).json({ success: false, message: 'Subscription not found' });
    res.json({ success: true, data: updated, message: `Activated until ${expiryStr}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changePlan = async (req, res) => {
  const { id } = req.params;
  const { planCode } = req.body;
  try {
    const { rows: [plan] } = await query('SELECT id FROM plans WHERE code=$1', [planCode]);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const { rows: [updated] } = await query(
      `UPDATE company_subscriptions SET plan_id=$1, status='active', updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [plan.id, id]
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══ SUPER ADMIN — COMPANY MODULES (OVERRIDE) ═════════════════════════════════

exports.getCompanyModules = async (req, res) => {
  const { companyId } = req.params;
  try {
    const { rows } = await query(
      `SELECT m.*, cm.enabled, cm.enabled_at
       FROM modules m
       LEFT JOIN company_modules cm ON cm.module_id = m.id AND cm.company_id = $1
       WHERE m.is_active = TRUE
       ORDER BY m.sort_order`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.setCompanyModules = async (req, res) => {
  const { companyId } = req.params;
  const { moduleCodes } = req.body;
  if (!Array.isArray(moduleCodes)) return res.status(400).json({ success: false, message: 'moduleCodes array required' });
  try {
    await transaction(async (client) => {
      await client.query('DELETE FROM company_modules WHERE company_id=$1', [companyId]);
      for (const code of moduleCodes) {
        await client.query(
          `INSERT INTO company_modules (company_id, module_id, enabled, enabled_by)
           SELECT $1, m.id, TRUE, $3 FROM modules m WHERE m.code=$2 ON CONFLICT DO NOTHING`,
          [companyId, code, req.user?.id || null]
        );
      }
    });
    res.json({ success: true, message: 'Company modules updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══ SUPER ADMIN — REVENUE ANALYTICS ══════════════════════════════════════════

exports.getRevenue = async (req, res) => {
  try {
    const { rows: summary } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status='active')   AS active_subs,
        COUNT(*) FILTER (WHERE status='trial')    AS trial_subs,
        COUNT(*) FILTER (WHERE status='cancelled') AS cancelled_subs,
        COUNT(*) FILTER (WHERE status='expired')   AS expired_subs,
        COUNT(*)                                   AS total_subs
      FROM company_subscriptions
    `);

    const { rows: mrr } = await query(`
      SELECT
        SUM(CASE WHEN cs.billing_cycle='monthly' THEN p.monthly_price
                 WHEN cs.billing_cycle='yearly'  THEN p.yearly_price / 12
                 ELSE 0 END) AS mrr,
        SUM(CASE WHEN cs.billing_cycle='monthly' THEN p.monthly_price * 12
                 WHEN cs.billing_cycle='yearly'  THEN p.yearly_price
                 ELSE 0 END) AS arr
      FROM company_subscriptions cs
      JOIN plans p ON p.id = cs.plan_id
      WHERE cs.status = 'active'
    `);

    const { rows: byPlan } = await query(`
      SELECT p.name, p.code,
             COUNT(cs.id) AS companies,
             SUM(CASE WHEN cs.billing_cycle='monthly' THEN p.monthly_price ELSE p.yearly_price/12 END) AS mrr_contribution
      FROM company_subscriptions cs
      JOIN plans p ON p.id = cs.plan_id
      WHERE cs.status = 'active'
      GROUP BY p.id ORDER BY mrr_contribution DESC
    `);

    const { rows: recentPayments } = await query(`
      SELECT bp.*, c.name AS company_name, bi.invoice_number
      FROM billing_payments bp
      JOIN companies c ON c.id = bp.company_id
      LEFT JOIN billing_invoices bi ON bi.payment_id = bp.id
      WHERE bp.status = 'captured'
      ORDER BY bp.paid_at DESC LIMIT 20
    `);

    const { rows: monthly } = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', paid_at), 'YYYY-MM') AS month,
        SUM(amount) AS revenue,
        COUNT(*) AS payments
      FROM billing_payments
      WHERE status='captured' AND paid_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1 ORDER BY 1
    `);

    res.json({
      success: true,
      data: {
        summary: summary[0],
        mrr:     parseFloat(mrr[0]?.mrr || 0),
        arr:     parseFloat(mrr[0]?.arr || 0),
        byPlan,
        recentPayments,
        monthlyRevenue: monthly,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ═══ MODULES CRUD ══════════════════════════════════════════════════════════════

exports.getModules = async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM modules ORDER BY sort_order');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
