const authService = require('../services/auth.service');
const ApiResponse = require('../utils/ApiResponse');
const { body, validationResult } = require('express-validator');

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().isLength({ min: 6 }),
];

const registerValidation = [
  body('company.name').notEmpty().trim(),
  body('company.code').notEmpty().trim().toUpperCase(),
  body('company.industryType').notEmpty(),
  body('company.email').isEmail().normalizeEmail(),
  body('admin.email').isEmail().normalizeEmail(),
  body('admin.password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])/),
  body('admin.firstName').notEmpty().trim(),
  body('admin.lastName').notEmpty().trim(),
  body('otp').notEmpty().withMessage('OTP is required'),
];

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return ApiResponse.badRequest(res, 'Validation failed', errors.array());

    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(email, password, ipAddress, userAgent);
    ApiResponse.success(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

const sendOtp = async (req, res, next) => {
  try {
    const { email, firstName } = req.body;
    if (!email) return ApiResponse.badRequest(res, 'email is required');
    await authService.sendRegistrationOTP(email, firstName || 'User');
    ApiResponse.success(res, null, 'OTP sent to ' + email);
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return ApiResponse.badRequest(res, 'Validation failed', errors.array());

    const { company, admin, otp } = req.body;
    const result = await authService.registerCompany(company, admin, otp);
    ApiResponse.created(res, result, 'Company registered successfully');
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return ApiResponse.badRequest(res, 'Refresh token is required');
    const result = await authService.refreshToken(refreshToken);
    ApiResponse.success(res, result, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.id);
    ApiResponse.success(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return ApiResponse.badRequest(res, 'Email is required');
    await authService.forgotPassword(email);
    ApiResponse.success(res, null, 'If email exists, a reset link has been sent');
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return ApiResponse.badRequest(res, 'Token and password are required');
    if (password.length < 8) return ApiResponse.badRequest(res, 'Password must be at least 8 characters');
    await authService.resetPassword(token, password);
    ApiResponse.success(res, null, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return ApiResponse.badRequest(res, 'Both passwords are required');
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    ApiResponse.success(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const { query } = require('../config/database');
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.role, u.department, u.designation, u.employee_code,
              u.notification_preferences, u.last_login_at, u.created_at,
              c.name AS company_name, c.logo_url AS company_logo, c.industry_type,
              c.subscription_plan, c.gst_number AS company_gst
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    ApiResponse.success(res, result.rows[0], 'Profile fetched');
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, designation, notificationPreferences } = req.body;
    const { query } = require('../config/database');
    const result = await query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
       phone = COALESCE($3, phone), designation = COALESCE($4, designation),
       notification_preferences = COALESCE($5, notification_preferences)
       WHERE id = $6 RETURNING id, email, first_name, last_name, phone, designation, notification_preferences`,
      [firstName, lastName, phone, designation, notificationPreferences ? JSON.stringify(notificationPreferences) : null, req.user.id]
    );
    ApiResponse.success(res, result.rows[0], 'Profile updated');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login, register, sendOtp, refreshToken, logout, forgotPassword, resetPassword,
  changePassword, getProfile, updateProfile, loginValidation, registerValidation,
};
