const { query } = require('../config/database');
const ApiResponse = require('../utils/ApiResponse');
const { paginate, paginationMeta } = require('../utils/helpers');
const bcrypt = require('bcryptjs');

const getAll = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { page, limit, offset } = paginate(req.query.page, req.query.limit);
    const { search, role, department, isActive } = req.query;

    let where = 'WHERE u.company_id = $1 AND u.deleted_at IS NULL';
    const params = [companyId];
    let idx = 2;

    if (search) { where += ` AND (u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (role) { where += ` AND u.role = $${idx}`; params.push(role); idx++; }
    if (department) { where += ` AND u.department = $${idx}`; params.push(department); idx++; }
    if (isActive !== undefined) { where += ` AND u.is_active = $${idx}`; params.push(isActive === 'true'); idx++; }

    const [dataRes, countRes] = await Promise.all([
      query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
                u.role, u.department, u.designation, u.employee_code,
                u.is_active, u.last_login_at, u.created_at
         FROM users u ${where}
         ORDER BY u.first_name ASC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) FROM users u ${where}`, params),
    ]);

    ApiResponse.paginated(res, dataRes.rows, paginationMeta(countRes.rows[0].count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.role, u.department, u.designation, u.employee_code,
              u.is_active, u.last_login_at, u.created_at, u.notification_preferences
       FROM users u
       WHERE u.id = $1 AND u.company_id = $2 AND u.deleted_at IS NULL`,
      [req.params.id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'User not found');
    ApiResponse.success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const companyId = req.companyId;
    const { email, password, firstName, lastName, phone, role, department, designation, employeeCode } = req.body;

    const existing = await query(
      'SELECT id FROM users WHERE email = LOWER($1) AND company_id = $2 AND deleted_at IS NULL',
      [email, companyId]
    );
    if (existing.rows[0]) return ApiResponse.badRequest(res, 'Email already registered for this company');

    const passwordHash = await bcrypt.hash(password || 'User@1234', 12);
    const avatarUrl = req.file?.path;

    const result = await query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, role, department, designation, employee_code, avatar_url, is_email_verified)
       VALUES ($1,LOWER($2),$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)
       RETURNING id, email, first_name, last_name, role, department, is_active`,
      [companyId, email, passwordHash, firstName, lastName, phone || null, role || 'department_user', department || null, designation || null, employeeCode || null, avatarUrl || null]
    );

    ApiResponse.created(res, result.rows[0], 'User created successfully');
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, role, department, designation, employeeCode, isActive } = req.body;
    const avatarUrl = req.file?.path;

    const result = await query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone), role = COALESCE($4, role),
        department = COALESCE($5, department), designation = COALESCE($6, designation),
        employee_code = COALESCE($7, employee_code), is_active = COALESCE($8, is_active),
        avatar_url = COALESCE($9, avatar_url)
       WHERE id = $10 AND company_id = $11 AND deleted_at IS NULL
       RETURNING id, email, first_name, last_name, role, department, is_active`,
      [firstName, lastName, phone, role, department, designation, employeeCode, isActive, avatarUrl, id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'User not found');
    ApiResponse.success(res, result.rows[0], 'User updated');
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return ApiResponse.badRequest(res, 'Cannot delete your own account');
    const result = await query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING id',
      [id, req.companyId]
    );
    if (!result.rows[0]) return ApiResponse.notFound(res, 'User not found');
    ApiResponse.success(res, null, 'User deleted');
  } catch (error) {
    next(error);
  }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const hash = await bcrypt.hash(password || 'User@1234', 12);
    await query('UPDATE users SET password_hash = $1, refresh_token = NULL WHERE id = $2 AND company_id = $3', [hash, id, req.companyId]);
    ApiResponse.success(res, null, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getOne, create, update, remove, resetUserPassword };
