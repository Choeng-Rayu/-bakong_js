/**
 * Bakong KHQR Payment API Server
 * Express.js server with comprehensive logging and error handling
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Import custom modules
const routes = require('./src/routes');
const { logger } = require('./src/logger');
const AutoPaymentMonitor = require('./src/AutoPaymentMonitor');
const PaymentService = require('./src/PaymentService');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Initialize services
const paymentService = new PaymentService();
const autoPaymentMonitor = new AutoPaymentMonitor(paymentService);

// Connect auto monitor to payment service
paymentService.setAutoMonitor(autoPaymentMonitor);

// Start auto payment monitoring
autoPaymentMonitor.start();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", "/temp/*"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            fontSrc: ["'self'", "https:", "data:"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

// Serve static files (QR images, etc.)
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
app.use('/temp', express.static(tempDir));

// Serve static web interface
app.use('/public', express.static(path.join(__dirname, 'public')));

// API routes
// Setup routes with payment service
app.use((req, res, next) => {
  req.paymentService = paymentService;
  req.autoPaymentMonitor = autoPaymentMonitor;
  next();
});

app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: '🏦 Bakong KHQR Payment API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/api/health',
            createPayment: 'POST /api/payments/create',
            checkPayment: 'GET /api/payments/check/:identifier',
            monitorPayment: 'POST /api/payments/monitor',
            bulkCheck: 'POST /api/payments/bulk-check',
            transactions: 'GET /api/payments/transactions',
            history: 'GET /api/payments/history',
            webInterface: '/web',
            paymentTest: '/test'
        },
        documentation: 'https://github.com/your-repo/bakong-khqr-api'
    });
});

// Web interface
app.get('/web', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Payment test interface
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment-test.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 
            'Internal server error' : 
            err.message,
        message: 'An unexpected error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'POST /api/payments/create',
            'GET /api/payments/check/:identifier',
            'POST /api/payments/monitor',
            'POST /api/payments/bulk-check',
            'GET /api/payments/transactions',
            'GET /api/payments/history',
            'GET /web',
            'GET /test'
        ]
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('👋 Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('👋 Process terminated');
        process.exit(0);
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info('🚀 Bakong KHQR Payment API Server Started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        merchant: process.env.BAKONG_MERCHANT_ID,
        timestamp: new Date().toISOString()
    });

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                🏦 BAKONG KHQR PAYMENT API                    ║
║              Server running successfully!                    ║
╚══════════════════════════════════════════════════════════════╝

🌐 Server URL: http://localhost:${PORT}
📱 Web Interface: http://localhost:${PORT}/web
🔍 Health Check: http://localhost:${PORT}/api/health
📊 API Documentation: http://localhost:${PORT}

💳 Merchant: ${process.env.BAKONG_MERCHANT_ID}
📱 Phone: ${process.env.BAKONG_PHONE_NUMBER}
🏛️ Environment: ${process.env.NODE_ENV || 'development'}

🚀 Ready to process Bakong payments!
    `);
});

module.exports = app;
