const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');
const { requireCompanyAdmin } = require('../middleware/auth');

router.get('/', requireCompanyAdmin, async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { module, action, userId, startDate, endDate, search } = req.query;
    const companyId = req.companyId;

    let where = 'WHERE al.company_id = $1';
    const params = [companyId];
    let idx = 2;

    if (module) { where += ` AND al.module = $${idx}`; params.push(module); idx++; }
    if (action) { where += ` AND al.action = $${idx}`; params.push(action); idx++; }
    if (userId) { where += ` AND al.user_id = $${idx}`; params.push(userId); idx++; }
    if (startDate) { where += ` AND al.created_at >= $${idx}`; params.push(startDate); idx++; }
    if (endDate) { where += ` AND al.created_at <= $${idx}`; params.push(endDate); idx++; }
    if (search) { where += ` AND (al.user_email ILIKE $${idx} OR al.description ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT al.* FROM audit_logs al ${where} ORDER BY al.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
