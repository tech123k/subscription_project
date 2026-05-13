const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

// JWT-only auth — no DB query per request.
// Token expires in 15m so deactivated accounts are locked out within one token lifetime.
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.userId,
      companyId: decoded.companyId,
      email: decoded.email || '',
      firstName: decoded.firstName || '',
      lastName: decoded.lastName || '',
      fullName: decoded.fullName || `${decoded.firstName || ''} ${decoded.lastName || ''}`.trim(),
      role: decoded.role,
      department: decoded.department || '',
      companyName: decoded.companyName || '',
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

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId, companyId: decoded.companyId, role: decoded.role };
  } catch (_) { /* ignore */ }

  next();
};

module.exports = { authenticate, requireRole, requireSuperAdmin, requireCompanyAdmin, optionalAuth };
