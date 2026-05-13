const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, auth.loginValidation, auth.login);
router.post('/send-otp', authLimiter, auth.sendOtp);
router.post('/register', authLimiter, auth.registerValidation, auth.register);
router.post('/refresh-token', auth.refreshToken);   // reads httpOnly cookie — no auth needed
router.post('/forgot-password', authLimiter, auth.forgotPassword);
router.post('/reset-password', authLimiter, auth.resetPassword);
router.post('/logout', authenticate, auth.logout);
router.post('/logout-all', authenticate, auth.logoutAll);
router.get('/profile', authenticate, auth.getProfile);
router.put('/profile', authenticate, auth.updateProfile);
router.put('/change-password', authenticate, auth.changePassword);

module.exports = router;
