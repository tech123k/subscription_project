const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../config/database');
const { generateToken } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const emailService = require('./email.service');
const logger = require('../utils/logger');

// ── OTP Store — Redis (production) with in-memory fallback ──
// Redis survives server restarts; in-memory is fallback for local dev
const { setCache, getCache, deleteCache } = require('../config/redis');
const otpFallback = new Map(); // used only when Redis is unavailable

const OTP_TTL = 600; // 10 minutes in seconds

async function storeOTP(email, otp) {
  const key = `otp:${email.toLowerCase()}`;
  const payload = { otp, expiresAt: Date.now() + OTP_TTL * 1000 };
  await setCache(key, payload, OTP_TTL);
  otpFallback.set(key, payload); // always write fallback too
}

async function readOTP(email) {
  const key = `otp:${email.toLowerCase()}`;
  const fromRedis = await getCache(key);
  if (fromRedis) return fromRedis;
  return otpFallback.get(key) || null; // fallback
}

async function clearOTP(email) {
  const key = `otp:${email.toLowerCase()}`;
  await deleteCache(key);
  otpFallback.delete(key);
}

// Purge expired fallback entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otpFallback) {
    if (v.expiresAt < now) otpFallback.delete(k);
  }
}, 5 * 60 * 1000);

class AuthService {
  generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });
  }

  generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });
  }

  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  async login(email, password, ipAddress, userAgent) {
    const result = await query(
      `SELECT u.*, c.name AS company_name, c.is_active AS company_active,
              c.subscription_expires_at
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.email = LOWER($1) AND u.deleted_at IS NULL`,
      [email]
    );

    const user = result.rows[0];

    if (!user) throw new AppError('Invalid email or password', 401);

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError('Account temporarily locked. Try again later.', 423);
    }

    const isMatch = await this.comparePassword(password, user.password_hash);

    if (!isMatch) {
      const attempts = user.failed_login_attempts + 1;
      const updates = { failed_login_attempts: attempts };
      if (attempts >= 5) updates.locked_until = new Date(Date.now() + 30 * 60 * 1000);

      await query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [attempts, updates.locked_until || null, user.id]
      );

      throw new AppError('Invalid email or password', 401);
    }

    if (!user.is_active) throw new AppError('Account is deactivated', 401);

    if (user.role !== 'super_admin' && user.company_id && !user.company_active) {
      throw new AppError('Company account is deactivated', 403);
    }

    const tokenPayload = {
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`,
      department: user.department || '',
      companyName: user.company_name || '',
    };
    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    await query(
      `UPDATE users SET
        refresh_token = $1, last_login_at = NOW(), last_login_ip = $2,
        login_count = login_count + 1, failed_login_attempts = 0, locked_until = NULL
       WHERE id = $3`,
      [refreshToken, ipAddress, user.id]
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        department: user.department,
        companyId: user.company_id,
        companyName: user.company_name,
        avatarUrl: user.avatar_url,
      },
    };
  }

  async refreshToken(token) {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const result = await query(
      `SELECT u.id, u.company_id, u.role, u.email, u.first_name, u.last_name,
              u.department, u.refresh_token, u.is_active,
              c.name AS company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    const user = result.rows[0];
    if (!user || user.refresh_token !== token) {
      throw new AppError('Session expired. Please log in again.', 401);
    }

    if (!user.is_active) throw new AppError('Account is deactivated', 401);

    // Full payload (same as login) so middleware has all claims
    const tokenPayload = {
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`,
      department: user.department || '',
      companyName: user.company_name || '',
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    // Rotate refresh token — old one becomes invalid immediately
    const newRefreshToken = this.generateRefreshToken({
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
    });

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, user.id]);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId) {
    await query('UPDATE users SET refresh_token = NULL WHERE id = $1', [userId]);
  }

  async forgotPassword(email) {
    const result = await query(
      'SELECT id, email, first_name FROM users WHERE email = LOWER($1) AND deleted_at IS NULL',
      [email]
    );

    const user = result.rows[0];
    if (!user) return;

    const resetToken = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [resetToken, expires, user.id]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordReset(user.email, user.first_name, resetUrl);
  }

  async resetPassword(token, newPassword) {
    const result = await query(
      `SELECT id FROM users
       WHERE password_reset_token = $1 AND password_reset_expires > NOW() AND deleted_at IS NULL`,
      [token]
    );

    const user = result.rows[0];
    if (!user) throw new AppError('Invalid or expired reset token', 400);

    const hash = await this.hashPassword(newPassword);
    await query(
      `UPDATE users SET password_hash = $1, password_reset_token = NULL,
       password_reset_expires = NULL, refresh_token = NULL WHERE id = $2`,
      [hash, user.id]
    );
  }

  async changePassword(userId, currentPassword, newPassword) {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    const isMatch = await this.comparePassword(currentPassword, user.password_hash);
    if (!isMatch) throw new AppError('Current password is incorrect', 400);

    const hash = await this.hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
  }

  // ── OTP Methods ───────────────────────────────────────────

  async sendRegistrationOTP(email, firstName) {
    // Rate-limit: allow resend only after 60 s
    const existing = await readOTP(email);
    if (existing && existing.expiresAt - Date.now() > 9 * 60 * 1000) {
      throw new AppError('OTP already sent. Please wait 60 seconds before requesting again.', 429);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await storeOTP(email, otp);

    try {
      await emailService.sendOTP(email, firstName || 'User', otp);
    } catch (err) {
      await clearOTP(email).catch(() => {});
      logger.error('OTP email send failed:', err.message);
      throw new AppError(
        'Could not send OTP email. Please try again.',
        503
      );
    }
    return true;
  }

  async verifyOTP(email, otp) {
    const record = await readOTP(email);
    if (!record)                           throw new AppError('OTP not found. Please request a new one.', 400);
    if (Date.now() > record.expiresAt)     throw new AppError('OTP expired. Please request a new one.', 400);
    if (record.otp !== String(otp).trim()) throw new AppError('Invalid OTP. Please check and try again.', 400);
    await clearOTP(email); // single-use
    return true;
  }

  // ── Register Company (now requires OTP) ──────────────────

  async registerCompany(companyData, adminData, otp) {
    // Verify OTP first — throws if invalid/expired
    await this.verifyOTP(adminData.email, otp);

    return transaction(async (client) => {
      // Create company
      const companyResult = await client.query(
        `INSERT INTO companies (name, code, industry_type, email, phone, gst_number,
          address_line1, city, state, country, pincode, subscription_plan)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'starter')
         RETURNING *`,
        [
          companyData.name, companyData.code, companyData.industryType,
          companyData.email, companyData.phone, companyData.gstNumber,
          companyData.addressLine1, companyData.city, companyData.state,
          companyData.country || 'India', companyData.pincode,
        ]
      );

      const company = companyResult.rows[0];

      // Create admin user
      const passwordHash = await this.hashPassword(adminData.password);
      const userResult = await client.query(
        `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, is_email_verified)
         VALUES ($1,$2,$3,$4,$5,'company_admin', TRUE)
         RETURNING id, email, first_name, last_name, role`,
        [company.id, adminData.email.toLowerCase(), passwordHash, adminData.firstName, adminData.lastName]
      );

      // Create default warehouse
      await client.query(
        `INSERT INTO warehouses (company_id, name, code, is_primary)
         VALUES ($1, 'Main Warehouse', 'WH-01', TRUE)`,
        [company.id]
      );

      // Create default material categories
      const defaultCategories = [
        'Raw Materials', 'Packaging', 'Finished Goods',
        'Semi-Finished', 'Consumables', 'Spare Parts',
      ];
      for (const catName of defaultCategories) {
        await client.query(
          'INSERT INTO material_categories (company_id, name) VALUES ($1, $2)',
          [company.id, catName]
        );
      }

      // Create default workflow template based on industry
      const templateResult = await client.query(
        `INSERT INTO workflow_templates (company_id, name, description, industry_type, is_default)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id`,
        [company.id, 'Default Workflow', `Default workflow for ${companyData.industryType}`, companyData.industryType]
      );

      // Add industry-specific default stages
      const stages = this.getDefaultStages(companyData.industryType);
      for (const stage of stages) {
        await client.query(
          `INSERT INTO workflow_stages (company_id, template_id, name, code, sequence_order, color)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [company.id, templateResult.rows[0].id, stage.name, stage.code, stage.order, stage.color]
        );
      }

      return { company, user: userResult.rows[0] };
    });
  }

  getDefaultStages(industryType) {
    const stageMap = {
      footwear: [
        { name: 'Raw Material', code: 'RM', order: 1, color: '#F59E0B' },
        { name: 'Cutting', code: 'CUTTING', order: 2, color: '#EF4444' },
        { name: 'Stitching', code: 'STITCHING', order: 3, color: '#8B5CF6' },
        { name: 'Sole Fixing', code: 'SOLE', order: 4, color: '#06B6D4' },
        { name: 'Finishing', code: 'FINISHING', order: 5, color: '#10B981' },
        { name: 'Packing', code: 'PACKING', order: 6, color: '#3B82F6' },
      ],
      steel: [
        { name: 'Raw Material', code: 'RM', order: 1, color: '#F59E0B' },
        { name: 'Melting', code: 'MELTING', order: 2, color: '#EF4444' },
        { name: 'Rolling', code: 'ROLLING', order: 3, color: '#8B5CF6' },
        { name: 'Cutting', code: 'CUTTING', order: 4, color: '#06B6D4' },
        { name: 'Quality Check', code: 'QC', order: 5, color: '#10B981' },
        { name: 'Dispatch Ready', code: 'DISPATCH', order: 6, color: '#3B82F6' },
      ],
      chemical: [
        { name: 'Raw Material', code: 'RM', order: 1, color: '#F59E0B' },
        { name: 'Mixing', code: 'MIXING', order: 2, color: '#EF4444' },
        { name: 'Heating', code: 'HEATING', order: 3, color: '#8B5CF6' },
        { name: 'Cooling', code: 'COOLING', order: 4, color: '#06B6D4' },
        { name: 'Quality Check', code: 'QC', order: 5, color: '#10B981' },
        { name: 'Packing', code: 'PACKING', order: 6, color: '#3B82F6' },
      ],
      textile: [
        { name: 'Yarn Input', code: 'YARN', order: 1, color: '#F59E0B' },
        { name: 'Weaving', code: 'WEAVING', order: 2, color: '#EF4444' },
        { name: 'Dyeing', code: 'DYEING', order: 3, color: '#8B5CF6' },
        { name: 'Finishing', code: 'FINISHING', order: 4, color: '#06B6D4' },
        { name: 'Quality Check', code: 'QC', order: 5, color: '#10B981' },
        { name: 'Packing', code: 'PACKING', order: 6, color: '#3B82F6' },
      ],
    };

    return stageMap[industryType] || [
      { name: 'Raw Material', code: 'RM', order: 1, color: '#F59E0B' },
      { name: 'Processing', code: 'PROCESSING', order: 2, color: '#EF4444' },
      { name: 'Assembly', code: 'ASSEMBLY', order: 3, color: '#8B5CF6' },
      { name: 'Quality Check', code: 'QC', order: 4, color: '#06B6D4' },
      { name: 'Finishing', code: 'FINISHING', order: 5, color: '#10B981' },
      { name: 'Packing', code: 'PACKING', order: 6, color: '#3B82F6' },
    ];
  }
}

module.exports = new AuthService();
