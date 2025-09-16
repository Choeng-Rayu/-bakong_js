/**
 * Payment Service - Handles all payment operations with logging and auto-monitoring
 */

const BakongKHQR = require('./BakongKHQR');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const {
    logger,
    logPaymentGeneration,
    logPaymentCheck,
    logDeepLinkGeneration,
    logApiRequest,
    logPaymentSuccess
} = require('./logger');

class PaymentService {
    constructor() {
        this.khqr = new BakongKHQR(process.env.BAKONG_DEVELOPER_TOKEN);
        this.activeTransactions = new Map();
        this.transactionHistory = [];
        this.autoMonitor = null; // Will be set by server
    }

    /**
     * Set the auto payment monitor
     */
    setAutoMonitor(autoMonitor) {
        this.autoMonitor = autoMonitor;
        logger.info('🤖 Auto Payment Monitor connected to PaymentService');
    }

    /**
     * Create a new payment QR code
     */
    async createPayment(paymentData) {
        const transactionId = uuidv4();
        const startTime = Date.now();

        try {
            logger.info(`🚀 Creating payment transaction: ${transactionId}`, paymentData);

            // Validate input
            this.validatePaymentData(paymentData);

            // Generate QR code
            const qrCode = this.khqr.createQR({
                bankAccount: process.env.BAKONG_MERCHANT_ID,
                merchantName: paymentData.merchantName || process.env.DEFAULT_MERCHANT_NAME,
                merchantCity: paymentData.merchantCity || process.env.DEFAULT_MERCHANT_CITY,
                amount: paymentData.amount,
                currency: paymentData.currency,
                storeLabel: paymentData.storeLabel,
                phoneNumber: process.env.BAKONG_PHONE_NUMBER,
                billNumber: paymentData.billNumber,
                terminalLabel: paymentData.terminalLabel,
                isStatic: paymentData.isStatic || false
            });

            // Generate MD5 hash for tracking
            const md5Hash = this.khqr.generateMD5(qrCode);

            // Generate QR image
            let imagePath = null;
            try {
                const imageDir = path.join(__dirname, '../temp');
                await fs.mkdir(imageDir, { recursive: true });
                imagePath = path.join(imageDir, `qr_${paymentData.billNumber}.png`);
                await this.khqr.generateQRImage(qrCode, { 
                    format: 'png', 
                    outputPath: imagePath 
                });
            } catch (imageError) {
                logger.warn('QR image generation failed', { error: imageError.message });
            }

            // Generate deep link
            let deepLink = null;
            try {
                deepLink = await this.khqr.generateDeeplink(
                    qrCode,
                    paymentData.callback || 'https://bakong-test.com/success',
                    paymentData.appIconUrl || 'https://bakong-test.com/icon.png',
                    paymentData.appName || 'Bakong Test'
                );
                logDeepLinkGeneration(qrCode, deepLink);
            } catch (deepLinkError) {
                logger.warn('Deep link generation failed', { error: deepLinkError.message });
            }

            const result = {
                transactionId,
                qrCode,
                md5Hash,
                imagePath,
                deepLink,
                createdAt: new Date().toISOString(),
                status: 'PENDING',
                paymentData
            };

            // Store active transaction
            this.activeTransactions.set(transactionId, result);
            this.transactionHistory.push(result);

            // Log successful generation
            logPaymentGeneration(paymentData, result);

            // Start auto-monitoring if available
            if (this.autoMonitor) {
                const monitorData = {
                    md5Hash,
                    billNumber: paymentData.billNumber,
                    amount: paymentData.amount,
                    currency: paymentData.currency,
                    storeLabel: paymentData.storeLabel,
                    qrCode,
                    transactionId
                };
                
                this.autoMonitor.addPayment(monitorData, paymentData.sessionId || 'anonymous');
                
                console.log('\n🤖 AUTO-MONITORING ENABLED for this payment');
                console.log(`🔍 Payment will be checked every 10 seconds`);
                console.log(`⏰ Auto-monitoring duration: 30 minutes\n`);
            }

            const processingTime = Date.now() - startTime;
            logger.info(`✅ Payment created successfully: ${transactionId} (${processingTime}ms)`);

            return result;

        } catch (error) {
            const processingTime = Date.now() - startTime;
            logger.error(`❌ Payment creation failed: ${transactionId} (${processingTime}ms)`, { error: error.message });
            throw error;
        }
    }

    /**
     * Check payment status
     */
    async checkPaymentStatus(identifier) {
        try {
            logger.info(`🔍 Checking payment status: ${identifier}`);

            let md5Hash = identifier;
            let transaction = null;

            // Check if identifier is transaction ID
            if (this.activeTransactions.has(identifier)) {
                transaction = this.activeTransactions.get(identifier);
                md5Hash = transaction.md5Hash;
            }

            // Check payment status via API
            const status = await this.khqr.checkPayment(md5Hash);
            
            // Get payment details if paid
            let paymentDetails = null;
            if (status === 'PAID') {
                try {
                    paymentDetails = await this.khqr.getPayment(md5Hash);
                    
                    // Log payment success
                    if (paymentDetails) {
                        logPaymentSuccess(paymentDetails, md5Hash);
                    }
                    
                    // Enhanced console logging for successful payments
                    console.log('\n💼========================================💼');
                    console.log('       PAYMENT SERVICE NOTIFICATION       ');
                    console.log('💼========================================💼');
                    console.log(`🔍 Payment Check Result: PAYMENT CONFIRMED`);
                    console.log(`🆔 Identifier: ${identifier}`);
                    console.log(`🔑 MD5 Hash: ${md5Hash}`);
                    console.log(`⏰ Checked At: ${new Date().toLocaleString()}`);
                    if (transaction) {
                        console.log(`📋 Bill Number: ${transaction.billNumber}`);
                        console.log(`🏪 Store: ${transaction.storeLabel}`);
                        console.log(`💰 Amount: ${transaction.amount} ${transaction.currency}`);
                    }
                    console.log('💼========================================💼\n');
                    
                } catch (detailError) {
                    logger.warn('Could not retrieve payment details', { error: detailError.message });
                }
            }

            // Update transaction status if we have it
            if (transaction) {
                const previousStatus = transaction.status;
                transaction.status = status;
                transaction.lastChecked = new Date().toISOString();
                if (paymentDetails) {
                    transaction.paymentDetails = paymentDetails;
                }
                
                // Log status change
                if (previousStatus !== status && status === 'PAID') {
                    console.log('\n🔄========================================🔄');
                    console.log('        PAYMENT STATUS CHANGED!           ');
                    console.log('🔄========================================🔄');
                    console.log(`📊 Status Change: ${previousStatus} → ${status}`);
                    console.log(`🆔 Transaction ID: ${identifier}`);
                    console.log(`⏰ Status Changed At: ${new Date().toLocaleString()}`);
                    console.log('🔄========================================🔄\n');
                }
            }

            // Log status check
            logPaymentCheck(md5Hash, status, paymentDetails);

            logger.info(`📊 Payment status checked: ${identifier} - ${status}`);

            return {
                identifier,
                md5Hash,
                status,
                paymentDetails,
                transaction,
                checkedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`❌ Payment status check failed: ${identifier}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Monitor payment until completion or timeout
     */
    async monitorPayment(identifier, options = {}) {
        const { timeout = 300000, interval = 5000 } = options; // 5 minutes timeout, 5 second interval
        const startTime = Date.now();

        logger.info(`⏳ Starting payment monitoring: ${identifier}`, { timeout, interval });

        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(async () => {
                try {
                    const elapsed = Date.now() - startTime;
                    
                    if (elapsed > timeout) {
                        clearInterval(checkInterval);
                        logger.warn(`⏰ Payment monitoring timeout: ${identifier} (${elapsed}ms)`);
                        resolve({ status: 'TIMEOUT', elapsed });
                        return;
                    }

                    const result = await this.checkPaymentStatus(identifier);
                    
                    if (result.status === 'PAID') {
                        clearInterval(checkInterval);
                        logger.info(`🎉 Payment completed: ${identifier} (${elapsed}ms)`);
                        resolve({ ...result, elapsed });
                        return;
                    }

                    logger.debug(`⏳ Payment still pending: ${identifier} (${elapsed}ms)`);

                } catch (error) {
                    clearInterval(checkInterval);
                    logger.error(`❌ Payment monitoring error: ${identifier}`, { error: error.message });
                    reject(error);
                }
            }, interval);
        });
    }

    /**
     * Get transaction by ID
     */
    getTransaction(transactionId) {
        return this.activeTransactions.get(transactionId) || null;
    }

    /**
     * Get all transactions
     */
    getAllTransactions() {
        return Array.from(this.activeTransactions.values());
    }

    /**
     * Get transaction history
     */
    getTransactionHistory(limit = 50) {
        return this.transactionHistory
            .slice(-limit)
            .reverse(); // Most recent first
    }

    /**
     * Check multiple payments in bulk
     */
    async checkBulkPayments(identifiers) {
        try {
            logger.info(`🔍 Bulk payment check for ${identifiers.length} transactions`);

            const md5Hashes = identifiers.map(id => {
                if (this.activeTransactions.has(id)) {
                    return this.activeTransactions.get(id).md5Hash;
                }
                return id; // Assume it's already an MD5 hash
            });

            const paidHashes = await this.khqr.checkBulkPayments(md5Hashes);

            // Update transaction statuses
            paidHashes.forEach(md5Hash => {
                for (const [transactionId, transaction] of this.activeTransactions.entries()) {
                    if (transaction.md5Hash === md5Hash) {
                        transaction.status = 'PAID';
                        transaction.lastChecked = new Date().toISOString();
                        break;
                    }
                }
            });

            logger.info(`📊 Bulk check complete: ${paidHashes.length}/${identifiers.length} paid`);

            return {
                total: identifiers.length,
                paid: paidHashes.length,
                paidHashes,
                checkedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error('❌ Bulk payment check failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Validate payment data
     */
    validatePaymentData(data) {
        const required = ['amount', 'currency', 'billNumber', 'storeLabel', 'terminalLabel'];
        
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (typeof data.amount !== 'number' || data.amount <= 0) {
            throw new Error('Amount must be a positive number');
        }

        if (!['USD', 'KHR'].includes(data.currency.toUpperCase())) {
            throw new Error('Currency must be USD or KHR');
        }
    }

    /**
     * Clean up old transactions (optional maintenance)
     */
    cleanupOldTransactions(maxAge = 86400000) { // 24 hours default
        const cutoff = Date.now() - maxAge;
        let cleaned = 0;

        for (const [transactionId, transaction] of this.activeTransactions.entries()) {
            const createdAt = new Date(transaction.createdAt).getTime();
            if (createdAt < cutoff) {
                this.activeTransactions.delete(transactionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info(`🧹 Cleaned up ${cleaned} old transactions`);
        }

        return cleaned;
    }
}

module.exports = PaymentService;
