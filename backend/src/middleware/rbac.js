const { query } = require('../config/database');
const { AppError } = require('./errorHandler');

const ROLE_HIERARCHY = {
  super_admin: 100,
  company_admin: 80,
  department_user: 50,
  read_only: 10,
};

const checkPermission = (module, action) => async (req, res, next) => {
  try {
    const { role, id: userId, companyId } = req.user;

    if (role === 'super_admin') return next();
    if (role === 'company_admin') return next();

    if (role === 'read_only' && action !== 'view') {
      throw new AppError('Read-only users cannot perform this action', 403);
    }

    const result = await query(
      `SELECT p.is_allowed FROM permissions p
       JOIN user_roles ur ON ur.role_id = p.role_id
       WHERE ur.user_id = $1 AND p.module = $2 AND p.action = $3`,
      [userId, module, action]
    );

    if (!result.rows[0] || !result.rows[0].is_allowed) {
      throw new AppError(`You don't have permission to ${action} ${module}`, 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

const ensureCompanyAccess = (req, res, next) => {
  if (req.user.role === 'super_admin') return next();

  const requestedCompanyId = req.params.companyId || req.body.company_id || req.query.company_id;

  if (requestedCompanyId && requestedCompanyId !== req.user.companyId) {
    return next(new AppError('Access denied to this company data', 403));
  }

  if (!req.user.companyId) {
    return next(new AppError('No company associated with this user', 403));
  }

  next();
};

const injectCompanyId = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    req.companyId = req.user.companyId;
  } else {
    req.companyId = req.params.companyId || req.query.company_id || req.user.companyId;
  }
  next();
};

module.exports = { checkPermission, ensureCompanyAccess, injectCompanyId, ROLE_HIERARCHY };
