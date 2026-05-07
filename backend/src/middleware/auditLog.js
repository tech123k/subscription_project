const { query } = require('../config/database');
const logger = require('../utils/logger');

const auditLog = (module, action) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  const startTime = Date.now();

  res.json = function (body) {
    res.json = originalJson;
    const result = originalJson(body);

    if (res.statusCode < 400 && req.user) {
      setImmediate(async () => {
        try {
          await query(
            `INSERT INTO audit_logs
              (company_id, user_id, user_email, user_name, action, module,
               record_id, record_type, old_values, new_values, ip_address, user_agent, description)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              req.user.companyId || null,
              req.user.id,
              req.user.email,
              req.user.fullName,
              action,
              module,
              body.data?.id || req.params.id || null,
              module,
              req._oldValues ? JSON.stringify(req._oldValues) : null,
              body.data ? JSON.stringify(body.data) : null,
              req.ip || req.socket?.remoteAddress,
              req.headers['user-agent'],
              `${req.method} ${req.path}`,
            ]
          );
        } catch (err) {
          logger.warn('Audit log failed:', err.message);
        }
      });
    }

    return result;
  };

  next();
};

const captureOldValues = (tableName, idParam = 'id') => async (req, res, next) => {
  try {
    if (req.params[idParam]) {
      const result = await query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params[idParam]]);
      req._oldValues = result.rows[0] || null;
    }
  } catch (_) { /* continue */ }
  next();
};

module.exports = { auditLog, captureOldValues };
