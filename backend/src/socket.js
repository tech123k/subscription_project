const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');

const setupSocket = (io) => {
  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.companyId = decoded.companyId;
      socket.role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    // Join company room for scoped broadcasts
    if (socket.companyId) {
      socket.join(`company:${socket.companyId}`);
    }

    // Join personal room for direct notifications
    socket.join(`user:${socket.userId}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });

    socket.on('join:room', (room) => {
      socket.join(room);
    });

    socket.on('leave:room', (room) => {
      socket.leave(room);
    });
  });
};

module.exports = setupSocket;
