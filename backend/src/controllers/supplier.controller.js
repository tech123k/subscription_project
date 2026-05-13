const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');

const getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, isActive } = req.query;
    const companyId = req.companyId;

    let where = 'WHERE company_id = $1 AND deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (search) { where += ` AND (name ILIKE $${idx} OR code ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (isActive !== undefined) { where += ` AND is_active = $${idx}`; params.push(isActive === 'true'); idx++; }

    const [dataRes, countRes] = await Promise.all([
      query(`SELECT * FROM suppliers ${where} ORDER BY name LIMIT $${idx} OFFSET $${idx + 1}`, [...params, limit, offset]),
      query(`SELECT COUNT(*) FROM suppliers ${where}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL', [req.params.id, req.companyId]);
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Supplier not found');
    ApiResponse.success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      name, code, contactPerson, email, phone, alternatePhone,
      gstNumber, panNumber, addressLine1, addressLine2, city, state, country, pincode,
      bankName, bankAccountNumber, bankIfsc, creditDays, creditLimit, rating, notes,
    } = req.body;

    if (code) {
      const dup = await query(
        'SELECT id FROM suppliers WHERE company_id=$1 AND code=$2 AND deleted_at IS NULL',
        [req.companyId, code]
      );
      if (dup.rows[0]) return ApiResponse.conflict(res, 'Supplier code already exists for this company');
    }

    const result = await query(
      `INSERT INTO suppliers (company_id, name, code, contact_person, email, phone, alternate_phone,
        gst_number, pan_number, address_line1, address_line2, city, state, country, pincode,
        bank_name, bank_account_number, bank_ifsc, credit_days, credit_limit, rating, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [req.companyId, name, code || null, contactPerson || null, email || null, phone || null, alternatePhone || null,
        gstNumber || null, panNumber || null, addressLine1 || null, addressLine2 || null, city || null,
        state || null, country || 'India', pincode || null, bankName || null,
        bankAccountNumber || null, bankIfsc || null, creditDays || 30, creditLimit || 0, rating || null, notes || null]
    );
    ApiResponse.created(res, result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return ApiResponse.conflict(res, 'Supplier code already exists for this company');
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'code', 'contact_person', 'email', 'phone', 'gst_number', 'city', 'state', 'credit_days', 'credit_limit', 'rating', 'is_active'];

    if (req.body.code) {
      const dup = await query(
        'SELECT id FROM suppliers WHERE company_id=$1 AND code=$2 AND id<>$3 AND deleted_at IS NULL',
        [req.companyId, req.body.code, id]
      );
      if (dup.rows[0]) return ApiResponse.conflict(res, 'Supplier code already exists for this company');
    }
    const updates = [];
    const values = [];
    let idx = 1;

    const fieldMap = { name: 'name', code: 'code', contactPerson: 'contact_person', email: 'email', phone: 'phone', gstNumber: 'gst_number', city: 'city', state: 'state', creditDays: 'credit_days', creditLimit: 'credit_limit', rating: 'rating', isActive: 'is_active' };

    Object.entries(fieldMap).forEach(([jsKey, dbKey]) => {
      if (req.body[jsKey] !== undefined) {
        updates.push(`${dbKey} = $${idx}`);
        values.push(req.body[jsKey]);
        idx++;
      }
    });

    if (updates.length === 0) return ApiResponse.badRequest(res, 'No fields to update');

    const result = await query(
      `UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${idx} AND company_id = $${idx + 1} AND deleted_at IS NULL RETURNING *`,
      [...values, id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'Supplier not found');
    ApiResponse.success(res, result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return ApiResponse.conflict(res, 'Supplier code already exists for this company');
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await query('UPDATE suppliers SET deleted_at = NOW() WHERE id = $1 AND company_id = $2', [req.params.id, req.companyId]);
    ApiResponse.success(res, null, 'Supplier deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getOne, create, update, remove };
