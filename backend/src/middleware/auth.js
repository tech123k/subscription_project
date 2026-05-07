const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { AppError } = require('./errorHandler');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT u.id, u.company_id, u.email, u.first_name, u.last_name,
              u.role, u.department, u.is_active, u.notification_preferences,
              c.name AS company_name, c.subscription_plan, c.subscription_expires_at,
              c.is_active AS company_active
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [decoded.userId]
    );

    if (!result.rows[0]) throw new AppError('User not found', 401);

    const user = result.rows[0];

    if (!user.is_active) throw new AppError('Account is deactivated', 401);

    if (user.role !== 'super_admin' && user.company_id) {
      if (!user.company_active) throw new AppError('Company account is deactivated', 403);
      if (
        user.subscription_expires_at &&
        new Date(user.subscription_expires_at) < new Date()
      ) {
        throw new AppError('Company subscription has expired', 403);
      }
    }

    req.user = {
      id: user.id,
      companyId: user.company_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`,
      role: user.role,
      department: user.department,
      companyName: user.company_name,
    };

    next();
  } catch (error) {
    next(error);
  }
};

const requireRole = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };

const requireSuperAdmin = requireRole('super_admin');
const requireCompanyAdmin = requireRole('super_admin', 'company_admin');

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query('SELECT id, company_id, email, role FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows[0]) {
      req.user = result.rows[0];
    }
  } catch (_) { /* ignore */ }

  next();
};

module.exports = { authenticate, requireRole, requireSuperAdmin, requireCompanyAdmin, optionalAuth };
