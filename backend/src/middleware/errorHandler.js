const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    companyId: req.user?.companyId,
  });

  // PostgreSQL errors
  if (err.code === '23505') {
    statusCode = 409;
    // Extract the constraint detail to form a helpful message
    const detail = err.detail || '';
    const constraintName = err.constraint || '';
    if (constraintName.includes('grn') || detail.toLowerCase().includes('grn_number')) {
      message = 'GRN number already exists for this company.';
    } else if (constraintName.includes('po') || detail.toLowerCase().includes('po_number')) {
      message = 'Purchase order number already exists for this company.';
    } else if (constraintName.includes('invoice') || detail.toLowerCase().includes('invoice_number')) {
      message = 'Invoice number already exists for this company.';
    } else if (constraintName.includes('so_') || detail.toLowerCase().includes('order_number')) {
      message = 'Sales order number already exists for this company.';
    } else if (constraintName.includes('dispatch') || detail.toLowerCase().includes('dispatch_number')) {
      message = 'Dispatch number already exists for this company.';
    } else if (constraintName.includes('material') || detail.toLowerCase().includes('material')) {
      message = 'Material code already exists for this company.';
    } else if (constraintName.includes('product_attr') || detail.toLowerCase().includes('attribute')) {
      message = 'Attribute code already exists for this company.';
    } else if (constraintName.includes('product') || detail.toLowerCase().includes('product')) {
      message = 'Product code already exists for this company.';
    } else if (constraintName.includes('supplier') || detail.toLowerCase().includes('supplier')) {
      message = 'Supplier code already exists for this company.';
    } else if (constraintName.includes('customer') || detail.toLowerCase().includes('customer')) {
      message = 'Customer code already exists for this company.';
    } else if (constraintName.includes('warehouse') || detail.toLowerCase().includes('warehouse')) {
      message = 'Warehouse code already exists for this company.';
    } else if (detail.toLowerCase().includes('email')) {
      message = 'Email address is already registered.';
    } else if (detail.toLowerCase().includes('sku')) {
      message = 'SKU already exists for this company.';
    } else {
      message = 'A record with these details already exists.';
    }
  } else if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced record does not exist.';
  } else if (err.code === '23502') {
    statusCode = 400;
    message = `Required field missing: ${err.column}`;
  } else if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid UUID format.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired.';
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File size exceeds allowed limit.';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field.';
  }

  const response = {
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, AppError };
