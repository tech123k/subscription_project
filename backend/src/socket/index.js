const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const setupSocket = (io) => {
  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT id, company_id, email, role, first_name, last_name FROM users WHERE id = $1 AND is_active = TRUE',
        [decoded.userId]
      );

      if (!result.rows[0]) return next(new Error('User not found'));
      socket.user = result.rows[0];
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`Socket connected: ${user.email} (${socket.id})`);

    // Join user-specific room
    socket.join(`user:${user.id}`);

    // Join company room
    if (user.company_id) {
      socket.join(`company:${user.company_id}`);
    }

    // Join role-specific room
    socket.join(`role:${user.role}`);

    // Handle subscription to specific entities
    socket.on('subscribe:production', (orderId) => {
      socket.join(`production:${orderId}`);
    });

    socket.on('unsubscribe:production', (orderId) => {
      socket.leave(`production:${orderId}`);
    });

    socket.on('subscribe:dispatch', (dispatchId) => {
      socket.join(`dispatch:${dispatchId}`);
    });

    socket.on('unsubscribe:dispatch', (dispatchId) => {
      socket.leave(`dispatch:${dispatchId}`);
    });

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${user.email} - ${reason}`);
    });

    // Send initial data
    socket.emit('connected', {
      userId: user.id,
      companyId: user.company_id,
      message: 'Connected to ERP realtime server',
    });
  });

  // Expose emit helpers
  io.emitToUser = (userId, event, data) => {
    io.to(`user:${userId}`).emit(event, data);
  };

  io.emitToCompany = (companyId, event, data) => {
    io.to(`company:${companyId}`).emit(event, data);
  };

  io.emitProductionUpdate = (orderId, data) => {
    io.to(`production:${orderId}`).emit('production:update', data);
  };

  io.emitDispatchUpdate = (dispatchId, data) => {
    io.to(`dispatch:${dispatchId}`).emit('dispatch:update', data);
  };

  logger.info('Socket.IO server initialized');
  return io;
};

module.exports = setupSocket;
