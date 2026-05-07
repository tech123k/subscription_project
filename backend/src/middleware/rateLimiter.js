const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });

const globalLimiter = createLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  parseInt(process.env.RATE_LIMIT_MAX) || 200,
  'Too many requests. Please try again later.'
);

const authLimiter = createLimiter(
  15 * 60 * 1000,
  20,
  'Too many authentication attempts. Please try again after 15 minutes.'
);

const uploadLimiter = createLimiter(
  60 * 60 * 1000,
  50,
  'Upload limit reached. Please try again after an hour.'
);

const reportLimiter = createLimiter(
  60 * 1000,
  10,
  'Too many report requests. Please wait before generating more reports.'
);

module.exports = { globalLimiter, authLimiter, uploadLimiter, reportLimiter };
