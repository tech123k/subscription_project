const crypto = require('crypto');

const generateCode = (prefix = '', length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = prefix;
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generateInvoiceNumber = (prefix, counter) => {
  return `${prefix}-${String(counter).padStart(6, '0')}`;
};

const paginate = (page = 1, limit = 20) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;
  return { page: pageNum, limit: limitNum, offset };
};

const paginationMeta = (total, page, limit) => ({
  total: parseInt(total),
  page: parseInt(page),
  limit: parseInt(limit),
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

const buildWhereClause = (filters, tableAlias = '') => {
  const conditions = [];
  const values = [];
  let paramCount = 1;
  const prefix = tableAlias ? `${tableAlias}.` : '';

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        conditions.push(`${prefix}${key} = ANY($${paramCount})`);
        values.push(value);
      } else if (typeof value === 'object' && value.like) {
        conditions.push(`${prefix}${key} ILIKE $${paramCount}`);
        values.push(`%${value.like}%`);
      } else {
        conditions.push(`${prefix}${key} = $${paramCount}`);
        values.push(value);
      }
      paramCount++;
    }
  });

  return { conditions, values, paramCount };
};

const formatCurrency = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount || 0);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN') : '-';

const slugify = (text) =>
  text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');

const generateOTP = (length = 6) =>
  crypto.randomInt(Math.pow(10, length - 1), Math.pow(10, length)).toString();

const generateToken = (length = 32) =>
  crypto.randomBytes(length).toString('hex');

const sanitizeObject = (obj, allowedKeys) =>
  Object.keys(obj)
    .filter((key) => allowedKeys.includes(key))
    .reduce((acc, key) => ({ ...acc, [key]: obj[key] }), {});

const calculateGST = (amount, gstPercent, isInterState = false) => {
  const gstAmount = (amount * gstPercent) / 100;
  if (isInterState) {
    return { igst: gstAmount, cgst: 0, sgst: 0, total: gstAmount };
  }
  return { igst: 0, cgst: gstAmount / 2, sgst: gstAmount / 2, total: gstAmount };
};

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const isValidUUID = (str) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

module.exports = {
  generateCode,
  generateInvoiceNumber,
  paginate,
  paginationMeta,
  buildWhereClause,
  formatCurrency,
  formatDate,
  slugify,
  generateOTP,
  generateToken,
  sanitizeObject,
  calculateGST,
  deepClone,
  isValidUUID,
};
