/**
 * Routes for Bakong KHQR Payment System
 */

const express = require('express');
const { logger, logUserSession } = require('./logger');

const router = express.Router();

// Middleware to log all API requests
router.use((req, res, next) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    logger.info(`🌐 API Request: ${req.method} ${req.path}`, {
        sessionId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.method === 'POST' ? req.body : undefined
    });
    next();
});

/**
 * POST /api/payments/create
 * Create a new payment QR code
 */
router.post('/payments/create', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    
    try {
        const paymentService = req.paymentService;
        logUserSession(sessionId, 'CREATE_PAYMENT_REQUEST', req.body);

        const paymentData = {
            amount: parseFloat(req.body.amount),
            currency: req.body.currency?.toUpperCase() || 'USD',
            billNumber: req.body.billNumber || `BILL${Date.now()}`,
            storeLabel: req.body.storeLabel || 'Test Store',
            terminalLabel: req.body.terminalLabel || 'Terminal',
            merchantName: req.body.merchantName,
            merchantCity: req.body.merchantCity,
            isStatic: req.body.isStatic === true,
            callback: req.body.callback,
            appIconUrl: req.body.appIconUrl,
            appName: req.body.appName
        };

        const result = await req.paymentService.createPayment(paymentData);

        logUserSession(sessionId, 'CREATE_PAYMENT_SUCCESS', {
            transactionId: result.transactionId,
            billNumber: result.paymentData.billNumber
        });

        res.json({
            success: true,
            data: {
                transactionId: result.transactionId,
                qrCode: result.qrCode,
                md5Hash: result.md5Hash,
                deepLink: result.deepLink,
                imagePath: result.imagePath,
                billNumber: result.paymentData.billNumber,
                amount: result.paymentData.amount,
                currency: result.paymentData.currency,
                createdAt: result.createdAt,
                status: result.status
            },
            message: 'Payment QR code created successfully'
        });

    } catch (error) {
        logUserSession(sessionId, 'CREATE_PAYMENT_ERROR', { error: error.message });
        
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to create payment QR code'
        });
    }
});

/**
 * GET /api/payments/check/:identifier
 * Check payment status by transaction ID or MD5 hash
 */
router.get('/payments/check/:identifier', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const { identifier } = req.params;

    try {
        logUserSession(sessionId, 'CHECK_PAYMENT_REQUEST', { identifier });

        const result = await req.paymentService.checkPaymentStatus(identifier);

        logUserSession(sessionId, 'CHECK_PAYMENT_SUCCESS', {
            identifier,
            status: result.status
        });

        res.json({
            success: true,
            data: result,
            message: `Payment status: ${result.status}`
        });

    } catch (error) {
        logUserSession(sessionId, 'CHECK_PAYMENT_ERROR', { identifier, error: error.message });
        
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to check payment status'
        });
    }
});

/**
 * POST /api/payments/monitor
 * Monitor payment until completion with real-time updates
 */
router.post('/payments/monitor', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const { identifier, timeout = 300000, interval = 5000 } = req.body;

    try {
        logUserSession(sessionId, 'MONITOR_PAYMENT_REQUEST', { identifier, timeout, interval });

        const result = await req.paymentService.monitorPayment(identifier, { timeout, interval });

        logUserSession(sessionId, 'MONITOR_PAYMENT_COMPLETE', {
            identifier,
            status: result.status,
            elapsed: result.elapsed
        });

        res.json({
            success: true,
            data: result,
            message: `Payment monitoring completed: ${result.status}`
        });

    } catch (error) {
        logUserSession(sessionId, 'MONITOR_PAYMENT_ERROR', { identifier, error: error.message });
        
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Payment monitoring failed'
        });
    }
});

/**
 * POST /api/payments/bulk-check
 * Check multiple payments at once
 */
router.post('/payments/bulk-check', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const { identifiers } = req.body;

    try {
        if (!Array.isArray(identifiers) || identifiers.length === 0) {
            throw new Error('Identifiers array is required');
        }

        if (identifiers.length > 50) {
            throw new Error('Maximum 50 identifiers allowed');
        }

        logUserSession(sessionId, 'BULK_CHECK_REQUEST', { count: identifiers.length });

        const result = await req.paymentService.checkBulkPayments(identifiers);

        logUserSession(sessionId, 'BULK_CHECK_SUCCESS', {
            total: result.total,
            paid: result.paid
        });

        res.json({
            success: true,
            data: result,
            message: `Bulk check completed: ${result.paid}/${result.total} payments are paid`
        });

    } catch (error) {
        logUserSession(sessionId, 'BULK_CHECK_ERROR', { error: error.message });
        
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Bulk payment check failed'
        });
    }
});

/**
 * GET /api/payments/transaction/:transactionId
 * Get transaction details
 */
router.get('/payments/transaction/:transactionId', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const { transactionId } = req.params;

    try {
        logUserSession(sessionId, 'GET_TRANSACTION_REQUEST', { transactionId });

        const transaction = req.paymentService.getTransaction(transactionId);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        logUserSession(sessionId, 'GET_TRANSACTION_SUCCESS', { transactionId });

        res.json({
            success: true,
            data: transaction,
            message: 'Transaction retrieved successfully'
        });

    } catch (error) {
        logUserSession(sessionId, 'GET_TRANSACTION_ERROR', { transactionId, error: error.message });
        
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve transaction'
        });
    }
});

/**
 * GET /api/payments/transactions
 * Get all active transactions
 */
router.get('/payments/transactions', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const { limit = 50 } = req.query;

    try {
        logUserSession(sessionId, 'GET_TRANSACTIONS_REQUEST', { limit });

        const transactions = req.paymentService.getAllTransactions();
        const limitedTransactions = transactions.slice(0, parseInt(limit));

        logUserSession(sessionId, 'GET_TRANSACTIONS_SUCCESS', { count: limitedTransactions.length });

        res.json({
            success: true,
            data: {
                transactions: limitedTransactions,
                total: transactions.length,
                limit: parseInt(limit)
            },
            message: `Retrieved ${limitedTransactions.length} transactions`
        });

    } catch (error) {
        logUserSession(sessionId, 'GET_TRANSACTIONS_ERROR', { error: error.message });
        
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve transactions'
        });
    }
});

/**
 * GET /api/payments/history
 * Get transaction history
 */
router.get('/payments/history', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const { limit = 50 } = req.query;

    try {
        logUserSession(sessionId, 'GET_HISTORY_REQUEST', { limit });

        const history = req.paymentService.getTransactionHistory(parseInt(limit));

        logUserSession(sessionId, 'GET_HISTORY_SUCCESS', { count: history.length });

        res.json({
            success: true,
            data: {
                history,
                count: history.length,
                limit: parseInt(limit)
            },
            message: `Retrieved ${history.length} transaction history records`
        });

    } catch (error) {
        logUserSession(sessionId, 'GET_HISTORY_ERROR', { error: error.message });
        
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve transaction history'
        });
    }
});

/**
 * POST /api/payments/cleanup
 * Clean up old transactions
 */
router.post('/payments/cleanup', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const { maxAge = 86400000 } = req.body; // 24 hours default

    try {
        logUserSession(sessionId, 'CLEANUP_REQUEST', { maxAge });

        const cleaned = req.paymentService.cleanupOldTransactions(maxAge);

        logUserSession(sessionId, 'CLEANUP_SUCCESS', { cleaned });

        res.json({
            success: true,
            data: { cleaned },
            message: `Cleaned up ${cleaned} old transactions`
        });

    } catch (error) {
        logUserSession(sessionId, 'CLEANUP_ERROR', { error: error.message });
        
        res.status(400).json({
            success: false,
            error: error.message,
            message: 'Failed to cleanup transactions'
        });
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '1.0.0'
        },
        message: 'Bakong KHQR API is healthy'
    });
});

// Payment monitoring endpoints
router.get('/monitor/status', async (req, res) => {
  try {
    const autoMonitor = req.autoPaymentMonitor;
    const status = {
      active: autoMonitor.isActive,
      userCount: autoMonitor.getUserCount(),
      totalPayments: autoMonitor.getTotalPayments(),
      completedPayments: autoMonitor.getCompletedPayments(),
      pendingPayments: autoMonitor.getPendingPayments()
    };
    
    logger.info('Monitor status requested', { status });
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Error getting monitor status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get monitor status' 
    });
  }
});

router.get('/monitor/users', async (req, res) => {
  try {
    const autoMonitor = req.autoPaymentMonitor;
    const users = autoMonitor.getActiveUsers();
    
    logger.info('Active users requested', { userCount: users.length });
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Error getting active users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get active users' 
    });
  }
});

router.post('/monitor/force-check', async (req, res) => {
  try {
    const autoMonitor = req.autoPaymentMonitor;
    const { hash } = req.body;
    
    if (hash) {
      // Force check specific payment using the correct method name
      const result = await autoMonitor.forceCheck(hash);
      logger.info('Force check specific payment', { hash, result });
      res.json({ success: true, data: result });
    } else {
      // Force check all payments - implementing manually since no method exists
      const results = [];
      for (const [hashKey, monitor] of autoMonitor.activeMonitors.entries()) {
        try {
          const result = await autoMonitor.forceCheck(hashKey);
          results.push({ hash: hashKey, success: true, data: result });
        } catch (error) {
          results.push({ hash: hashKey, success: false, error: error.message });
        }
      }
      logger.info('Force check all payments', { checkedCount: results.length });
      res.json({ success: true, data: results });
    }
  } catch (error) {
    logger.error('Error in force check:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to force check payments' 
    });
  }
});

router.get('/monitor/user/:userId', async (req, res) => {
  try {
    const autoMonitor = req.autoPaymentMonitor;
    const { userId } = req.params;
    const userPayments = autoMonitor.getUserPayments(userId);
    
    logger.info('User payments requested', { userId, paymentCount: userPayments.length });
    res.json({ success: true, data: userPayments });
  } catch (error) {
    logger.error('Error getting user payments:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get user payments' 
    });
  }
});

module.exports = router;
