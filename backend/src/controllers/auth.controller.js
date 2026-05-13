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

// Cookie configuration — cross-origin safe for Render + Vercel
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return ApiResponse.badRequest(res, 'Validation failed', errors.array());

    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(email, password, ipAddress, userAgent);

    // Store refresh token in httpOnly cookie — never exposed to JS
    res.cookie('erp_rt', result.refreshToken, COOKIE_OPTIONS);

    // Return only the short-lived access token and user profile to the client
    ApiResponse.success(res, { accessToken: result.accessToken, user: result.user }, 'Login successful');
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
    const token = req.cookies?.erp_rt;
    if (!token) return ApiResponse.unauthorized(res, 'Session expired. Please log in again.');

    const result = await authService.refreshToken(token);

    // Rotate the cookie with the new refresh token
    res.cookie('erp_rt', result.refreshToken, COOKIE_OPTIONS);

    ApiResponse.success(res, { accessToken: result.accessToken }, 'Token refreshed');
  } catch (error) {
    // Clear the invalid cookie so the client knows to re-login
    res.clearCookie('erp_rt', CLEAR_COOKIE_OPTIONS);
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.user?.id) {
      await authService.logout(req.user.id);
    }
    res.clearCookie('erp_rt', CLEAR_COOKIE_OPTIONS);
    ApiResponse.success(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    // Invalidates the refresh token in DB — all sessions become invalid
    if (req.user?.id) {
      await authService.logout(req.user.id);
    }
    res.clearCookie('erp_rt', CLEAR_COOKIE_OPTIONS);
    ApiResponse.success(res, null, 'Logged out from all devices');
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
    // Rotate refresh token after password change — invalidates other sessions
    res.clearCookie('erp_rt', CLEAR_COOKIE_OPTIONS);
    ApiResponse.success(res, null, 'Password changed. Please log in again.');
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
  login, register, sendOtp, refreshToken, logout, logoutAll,
  forgotPassword, resetPassword, changePassword, getProfile, updateProfile,
  loginValidation, registerValidation,
};
