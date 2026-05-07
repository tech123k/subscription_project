require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { testConnection } = require('./config/database');
const { getRedisClient } = require('./config/redis');
const setupSocket = require('./socket');
const notificationService = require('./services/notification.service');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT) || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

setupSocket(io);
notificationService.setSocketIO(io);

const startServer = async () => {
  try {
    await testConnection();
    logger.info('✅ Database connected');

    try {
      await getRedisClient();
      logger.info('✅ Redis connected');
    } catch (redisErr) {
      logger.warn('⚠️  Redis not available - caching disabled:', redisErr.message);
    }

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 ERP Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info(`📊 API: http://localhost:${PORT}/api`);
      logger.info(`🔌 Socket.IO: ws://localhost:${PORT}`);
      logger.info(`❤️  Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

startServer();

module.exports = { app, server, io };
