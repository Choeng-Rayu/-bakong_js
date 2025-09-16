/**
 * Logger utility for Bakong KHQR API
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} | ${level.toUpperCase().padStart(8)} | ${stack || message}`;
    })
);

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'bakong-api.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // File transport for errors only
        new winston.transports.File({
            filename: path.join(logsDir, 'bakong-error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Helper functions for structured logging
const createTransactionLog = (action, data, result = null, error = null) => {
    const logData = {
        action,
        timestamp: new Date().toISOString(),
        data,
        result,
        error: error ? error.message : null
    };
    
    if (error) {
        logger.error('Transaction failed', logData);
    } else {
        logger.info('Transaction processed', logData);
    }
    
    return logData;
};

const logPaymentGeneration = (paymentData, qrResult) => {
    return createTransactionLog('PAYMENT_GENERATION', {
        amount: paymentData.amount,
        currency: paymentData.currency,
        billNumber: paymentData.billNumber,
        merchantName: paymentData.merchantName
    }, {
        qrCode: qrResult.qrCode?.substring(0, 50) + '...',
        md5Hash: qrResult.md5Hash,
        imageGenerated: !!qrResult.imagePath
    });
};

const logPaymentCheck = (md5Hash, status, details = null) => {
    return createTransactionLog('PAYMENT_CHECK', {
        md5Hash
    }, {
        status,
        details: details ? 'Details available' : 'No details'
    });
};

const logDeepLinkGeneration = (qrCode, deepLink) => {
    return createTransactionLog('DEEPLINK_GENERATION', {
        qrCode: qrCode.substring(0, 50) + '...'
    }, {
        deepLink,
        success: !!deepLink
    });
};

const logApiRequest = (endpoint, payload, response, error = null) => {
    const logData = {
        endpoint,
        payloadSize: JSON.stringify(payload).length,
        responseCode: response?.responseCode || null,
        error: error ? error.message : null
    };
    
    if (error) {
        logger.error(`API request failed: ${endpoint}`, logData);
    } else {
        logger.info(`API request successful: ${endpoint}`, logData);
    }
    
    return logData;
};

const logUserSession = (sessionId, action, data = {}) => {
    logger.info('User session activity', {
        sessionId,
        action,
        timestamp: new Date().toISOString(),
        data
    });
};

const logPaymentSuccess = (paymentData, md5Hash) => {
    const logData = {
        action: 'PAYMENT_SUCCESS',
        md5Hash,
        amount: paymentData.amount,
        currency: paymentData.currency,
        fromAccount: paymentData.fromAccountId,
        toAccount: paymentData.toAccountId,
        transactionHash: paymentData.hash,
        createdAt: new Date(paymentData.createdDateMs).toISOString(),
        acknowledgedAt: new Date(paymentData.acknowledgedDateMs).toISOString(),
        externalRef: paymentData.externalRef,
        timestamp: new Date().toISOString()
    };
    
    logger.info('🎉 PAYMENT SUCCESSFULLY COMPLETED', logData);
    
    // Enhanced console output
    console.log('\n📄========================================📄');
    console.log('          PAYMENT LOG RECORDED            ');
    console.log('📄========================================📄');
    console.log(`📝 Log Entry: PAYMENT_SUCCESS`);
    console.log(`💰 Amount: ${paymentData.amount} ${paymentData.currency}`);
    console.log(`🔗 Transaction Hash: ${paymentData.hash}`);
    console.log(`📋 External Reference: ${paymentData.externalRef}`);
    console.log(`⏰ Logged At: ${new Date().toLocaleString()}`);
    console.log('📄========================================📄\n');
    
    return logData;
};

module.exports = {
    logger,
    createTransactionLog,
    logPaymentGeneration,
    logPaymentCheck,
    logDeepLinkGeneration,
    logApiRequest,
    logUserSession,
    logPaymentSuccess
};
