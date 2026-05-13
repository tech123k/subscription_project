const { query, transaction } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');

// ─── GET CUSTOMER CREDIT OVERVIEW ────────────────────────────────────────────

const getCustomerCredit = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const companyId = req.companyId;

    const [custRes, txRes, agingRes] = await Promise.all([
      query(
        `SELECT id, name, code, phone, email,
                credit_limit, outstanding_amount, overdue_amount,
                credit_days, last_payment_date, order_blocking_enabled
         FROM customers WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL`,
        [customerId, companyId]
      ),
      query(
        `SELECT cct.*,
                u.first_name || ' ' || u.last_name AS created_by_name
         FROM customer_credit_transactions cct
         LEFT JOIN users u ON u.id = cct.created_by
         WHERE cct.customer_id = $1
         ORDER BY cct.created_at DESC
         LIMIT 50`,
        [customerId]
      ),
      // Aging buckets: current, 1-30, 31-60, 61-90, 90+
      query(
        `SELECT
           SUM(amount) FILTER (WHERE due_date >= CURRENT_DATE)::numeric                                AS current_due,
           SUM(amount) FILTER (WHERE due_date < CURRENT_DATE AND due_date >= CURRENT_DATE-30)::numeric AS days_1_30,
           SUM(amount) FILTER (WHERE due_date < CURRENT_DATE-30 AND due_date >= CURRENT_DATE-60)::numeric AS days_31_60,
           SUM(amount) FILTER (WHERE due_date < CURRENT_DATE-60 AND due_date >= CURRENT_DATE-90)::numeric AS days_61_90,
           SUM(amount) FILTER (WHERE due_date < CURRENT_DATE-90)::numeric                             AS days_90_plus
         FROM customer_credit_transactions
         WHERE customer_id=$1 AND transaction_type='invoice' AND amount > 0`,
        [customerId]
      ),
    ]);

    if (!custRes.rows[0]) return ApiResponse.notFound(res, 'Customer not found');

    const customer = custRes.rows[0];
    const creditUtilization = Number(customer.credit_limit) > 0
      ? Math.round((Number(customer.outstanding_amount) / Number(customer.credit_limit)) * 100)
      : 0;

    ApiResponse.success(res, {
      customer,
      credit_utilization_pct: creditUtilization,
      available_credit: Math.max(0, Number(customer.credit_limit) - Number(customer.outstanding_amount)),
      transactions: txRes.rows,
      aging: agingRes.rows[0],
    });
  } catch (err) { next(err); }
};

// ─── ALL CUSTOMERS OUTSTANDING ───────────────────────────────────────────────

const getOutstandingList = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, overdue } = req.query;

    let where = 'WHERE c.company_id=$1 AND c.deleted_at IS NULL AND c.outstanding_amount > 0';
    const params = [companyId];
    let idx = 2;

    if (search) {
      where += ` AND (c.name ILIKE $${idx} OR c.code ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (overdue === 'true') {
      where += ` AND c.overdue_amount > 0`;
    }

    const [dataRes, countRes, totalRes] = await Promise.all([
      query(
        `SELECT c.id, c.name, c.code, c.phone, c.email,
                c.credit_limit, c.outstanding_amount, c.overdue_amount,
                c.last_payment_date, c.order_blocking_enabled,
                CASE WHEN c.credit_limit > 0
                  THEN ROUND(c.outstanding_amount / c.credit_limit * 100, 1)
                  ELSE 0 END AS utilization_pct
         FROM customers c
         ${where}
         ORDER BY c.outstanding_amount DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*)::int AS count FROM customers c ${where}`, params),
      query(
        `SELECT
           COALESCE(SUM(outstanding_amount),0)::numeric AS total_outstanding,
           COALESCE(SUM(overdue_amount),0)::numeric     AS total_overdue,
           COUNT(*) FILTER (WHERE overdue_amount > 0)::int AS overdue_customers
         FROM customers c ${where}`,
        params
      ),
    ]);

    ApiResponse.success(res, {
      summary: totalRes.rows[0],
      customers: dataRes.rows,
      pagination: paginationMeta(countRes.rows[0].count, page, limit),
    });
  } catch (err) { next(err); }
};

// ─── RECORD PAYMENT ──────────────────────────────────────────────────────────

const recordPayment = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const companyId = req.companyId;
    const { amount, paymentDate, referenceNumber, notes } = req.body;

    const pmtAmt = parseFloat(amount);
    if (isNaN(pmtAmt) || pmtAmt <= 0) return ApiResponse.badRequest(res, 'amount must be > 0');

    const result = await transaction(async (client) => {
      const custRes = await client.query(
        `UPDATE customers
         SET outstanding_amount = GREATEST(0, outstanding_amount - $1),
             last_payment_date  = $2,
             updated_at         = NOW()
         WHERE id=$3 AND company_id=$4 AND deleted_at IS NULL
         RETURNING outstanding_amount, overdue_amount`,
        [pmtAmt, paymentDate || new Date().toISOString().slice(0, 10), customerId, companyId]
      );
      if (!custRes.rows[0]) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

      const newBalance = Number(custRes.rows[0].outstanding_amount);

      const txRes = await client.query(
        `INSERT INTO customer_credit_transactions
           (company_id, customer_id, transaction_type, reference_number,
            amount, balance_after, notes, created_by)
         VALUES ($1,$2,'payment',$3,$4,$5,$6,$7) RETURNING *`,
        [companyId, customerId, referenceNumber || null, -pmtAmt, newBalance, notes || null, req.user.id]
      );

      return { customer: custRes.rows[0], transaction: txRes.rows[0] };
    });

    ApiResponse.created(res, result, 'Payment recorded');
  } catch (err) {
    if (err.statusCode === 404) return ApiResponse.notFound(res, err.message);
    next(err);
  }
};

// ─── UPDATE CREDIT SETTINGS ──────────────────────────────────────────────────

const updateCreditSettings = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const companyId = req.companyId;
    const { creditLimit, creditDays, orderBlockingEnabled } = req.body;

    const result = await query(
      `UPDATE customers SET
         credit_limit             = COALESCE($1, credit_limit),
         credit_days              = COALESCE($2, credit_days),
         order_blocking_enabled   = COALESCE($3, order_blocking_enabled),
         updated_at               = NOW()
       WHERE id=$4 AND company_id=$5 AND deleted_at IS NULL
       RETURNING id, name, credit_limit, credit_days, outstanding_amount, order_blocking_enabled`,
      [
        creditLimit ?? null, creditDays ?? null,
        orderBlockingEnabled ?? null,
        customerId, companyId,
      ]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Customer not found');
    ApiResponse.success(res, result.rows[0], 'Credit settings updated');
  } catch (err) { next(err); }
};

// ─── SYNC OUTSTANDING FROM INVOICES ─────────────────────────────────────────
// Call this after invoice creation / payment

const syncOutstanding = async (customerId, companyId, client) => {
  const runner = client || { query: (sql, params) => query(sql, params) };
  const res_ = await runner.query(
    `SELECT
       COALESCE(SUM(balance_amount),0)       AS total_outstanding,
       COALESCE(SUM(balance_amount) FILTER (
         WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE
       ), 0) AS total_overdue
     FROM invoices
     WHERE customer_id=$1 AND payment_status != 'paid' AND deleted_at IS NULL`,
    [customerId]
  );
  const { total_outstanding, total_overdue } = res_.rows[0];
  await runner.query(
    `UPDATE customers SET outstanding_amount=$1, overdue_amount=$2, updated_at=NOW()
     WHERE id=$3 AND company_id=$4`,
    [total_outstanding, total_overdue, customerId, companyId]
  );
};

// ─── ADD CREDIT TRANSACTION (invoice hook) ───────────────────────────────────

const addInvoiceTransaction = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const companyId = req.companyId;
    const { amount, dueDate, referenceId, referenceNumber, referenceType = 'invoice' } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return ApiResponse.badRequest(res, 'amount must be > 0');

    const result = await transaction(async (client) => {
      const custRes = await client.query(
        `UPDATE customers SET outstanding_amount = outstanding_amount + $1, updated_at=NOW()
         WHERE id=$2 AND company_id=$3 RETURNING outstanding_amount`,
        [amt, customerId, companyId]
      );
      if (!custRes.rows[0]) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

      const txRes = await client.query(
        `INSERT INTO customer_credit_transactions
           (company_id, customer_id, transaction_type, reference_type, reference_id,
            reference_number, amount, balance_after, due_date, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          companyId, customerId, referenceType, referenceType, referenceId || null,
          referenceNumber || null, amt, custRes.rows[0].outstanding_amount,
          dueDate || null, req.user.id,
        ]
      );
      return txRes.rows[0];
    });

    ApiResponse.created(res, result, 'Invoice transaction recorded');
  } catch (err) {
    if (err.statusCode === 404) return ApiResponse.notFound(res, err.message);
    next(err);
  }
};

module.exports = {
  getCustomerCredit, getOutstandingList,
  recordPayment, updateCreditSettings,
  syncOutstanding, addInvoiceTransaction,
};
