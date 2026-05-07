const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');

// Super Admin: list all companies
const getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, industryType, plan, isActive } = req.query;

    let where = 'WHERE deleted_at IS NULL';
    const params = [];
    let idx = 1;

    if (search) { where += ` AND (name ILIKE $${idx} OR code ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (industryType) { where += ` AND industry_type = $${idx}`; params.push(industryType); idx++; }
    if (plan) { where += ` AND subscription_plan = $${idx}`; params.push(plan); idx++; }
    if (isActive !== undefined) { where += ` AND is_active = $${idx}`; params.push(isActive === 'true'); idx++; }

    const [dataRes, countRes, statsRes] = await Promise.all([
      query(
        `SELECT c.*, (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.deleted_at IS NULL) AS user_count
         FROM companies c ${where} ORDER BY c.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM companies ${where}`, params),
      query(`SELECT COUNT(*) FILTER (WHERE is_active) AS active, COUNT(*) FILTER (WHERE NOT is_active) AS inactive FROM companies WHERE deleted_at IS NULL`),
    ]);

    ApiResponse.paginated(res, dataRes.rows, {
      ...paginationMeta(countRes.rows[0].count, page, limit),
      stats: statsRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.role === 'super_admin' ? id : req.user.companyId;

    const [companyRes, warehouseRes, userRes] = await Promise.all([
      query('SELECT * FROM companies WHERE id = $1 AND deleted_at IS NULL', [companyId]),
      query('SELECT id, name, code, is_primary FROM warehouses WHERE company_id = $1 AND deleted_at IS NULL', [companyId]),
      query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE role = 'company_admin') AS admins,
                COUNT(*) FILTER (WHERE is_active) AS active
         FROM users WHERE company_id = $1 AND deleted_at IS NULL`,
        [companyId]
      ),
    ]);

    if (!companyRes.rows[0]) return ApiResponse.notFound(res, 'Company not found');

    ApiResponse.success(res, {
      ...companyRes.rows[0],
      warehouses: warehouseRes.rows,
      userStats: userRes.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.role === 'super_admin' ? id : req.user.companyId;
    const {
      name, gstNumber, panNumber, phone, email, website,
      addressLine1, addressLine2, city, state, country, pincode,
      bankName, bankAccountNumber, bankIfsc, bankBranch,
      invoicePrefix, grnPrefix, poPrefix, settings,
    } = req.body;

    const logoUrl = req.file?.path;

    const result = await query(
      `UPDATE companies SET
        name = COALESCE($1, name), gst_number = COALESCE($2, gst_number),
        pan_number = COALESCE($3, pan_number), phone = COALESCE($4, phone),
        email = COALESCE($5, email), website = COALESCE($6, website),
        address_line1 = COALESCE($7, address_line1), address_line2 = COALESCE($8, address_line2),
        city = COALESCE($9, city), state = COALESCE($10, state),
        country = COALESCE($11, country), pincode = COALESCE($12, pincode),
        bank_name = COALESCE($13, bank_name), bank_account_number = COALESCE($14, bank_account_number),
        bank_ifsc = COALESCE($15, bank_ifsc), bank_branch = COALESCE($16, bank_branch),
        invoice_prefix = COALESCE($17, invoice_prefix), grn_prefix = COALESCE($18, grn_prefix),
        po_prefix = COALESCE($19, po_prefix), settings = COALESCE($20, settings),
        logo_url = COALESCE($21, logo_url)
       WHERE id = $22 AND deleted_at IS NULL RETURNING *`,
      [
        name, gstNumber, panNumber, phone, email, website,
        addressLine1, addressLine2, city, state, country, pincode,
        bankName, bankAccountNumber, bankIfsc, bankBranch,
        invoicePrefix, grnPrefix, poPrefix,
        settings ? JSON.stringify(settings) : null, logoUrl, companyId,
      ]
    );

    if (!result.rows[0]) return ApiResponse.notFound(res, 'Company not found');
    ApiResponse.success(res, result.rows[0], 'Company updated successfully');
  } catch (error) {
    next(error);
  }
};

const toggleStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE companies SET is_active = NOT is_active WHERE id = $1 AND deleted_at IS NULL RETURNING id, name, is_active',
      [id]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Company not found');
    ApiResponse.success(res, result.rows[0], `Company ${result.rows[0].is_active ? 'activated' : 'deactivated'}`);
  } catch (error) {
    next(error);
  }
};

const updateSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan, expiresAt } = req.body;
    const result = await query(
      'UPDATE companies SET subscription_plan = $1, subscription_expires_at = $2 WHERE id = $3 RETURNING id, subscription_plan, subscription_expires_at',
      [plan, expiresAt, id]
    );
    ApiResponse.success(res, result.rows[0], 'Subscription updated');
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || req.companyId;
    const { rows } = await query('SELECT * FROM companies WHERE id = $1 AND deleted_at IS NULL', [companyId]);
    if (!rows[0]) return ApiResponse.notFound(res, 'Company not found');
    ApiResponse.success(res, rows[0]);
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || req.companyId;
    const {
      name, gstNumber, panNumber, phone, email, website,
      address, city, state, pincode,
      bankName, bankAccount, bankIfsc, bankBranch,
      invoicePrefix, dispatchPrefix, productionPrefix, industryType,
    } = req.body;

    const logoUrl = req.file?.path;

    const result = await query(
      `UPDATE companies SET
        name = COALESCE($1, name), gst_number = COALESCE($2, gst_number),
        pan_number = COALESCE($3, pan_number), phone = COALESCE($4, phone),
        email = COALESCE($5, email), website = COALESCE($6, website),
        address_line1 = COALESCE($7, address_line1), city = COALESCE($8, city),
        state = COALESCE($9, state), pincode = COALESCE($10, pincode),
        bank_name = COALESCE($11, bank_name), bank_account_number = COALESCE($12, bank_account_number),
        bank_ifsc = COALESCE($13, bank_ifsc), bank_branch = COALESCE($14, bank_branch),
        invoice_prefix = COALESCE($15, invoice_prefix),
        dispatch_prefix = COALESCE($16, dispatch_prefix),
        production_prefix = COALESCE($17, production_prefix),
        industry_type = COALESCE($18, industry_type),
        logo_url = COALESCE($19, logo_url)
       WHERE id = $20 AND deleted_at IS NULL RETURNING *`,
      [
        name, gstNumber, panNumber, phone, email, website,
        address, city, state, pincode,
        bankName, bankAccount, bankIfsc, bankBranch,
        invoicePrefix, dispatchPrefix, productionPrefix, industryType,
        logoUrl, companyId,
      ]
    );

    if (!result.rows[0]) return ApiResponse.notFound(res, 'Company not found');
    ApiResponse.success(res, result.rows[0], 'Settings saved');
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getOne, update, toggleStatus, updateSubscription, getSettings, updateSettings };
