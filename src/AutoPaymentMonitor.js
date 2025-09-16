/**
 * Auto Payment Monitor Service
 * Automatically monitors payments when QR codes are generated
 * Handles multiple concurrent users and delayed payments
 */

const EventEmitter = require('events');
const { logger, logPaymentSuccess } = require('./logger');

class AutoPaymentMonitor extends EventEmitter {
    constructor(paymentService) {
        super();
        this.paymentService = paymentService;
        this.activeMonitors = new Map(); // md5Hash -> monitorInfo
        this.userSessions = new Map(); // sessionId -> Set of md5Hashes
        this.paymentQueue = new Map(); // md5Hash -> payment details
        this.maxMonitorTime = 30 * 60 * 1000; // 30 minutes
        this.checkInterval = 10000; // 10 seconds
        this.isRunning = false;
        
        console.log('🤖 Auto Payment Monitor initialized');
    }

    /**
     * Start the monitoring service
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.startPeriodicCheck();
        
        console.log('\n🚀========================================🚀');
        console.log('     AUTO PAYMENT MONITOR STARTED        ');
        console.log('🚀========================================🚀');
        console.log('⏰ Check Interval: 10 seconds');
        console.log('🕐 Max Monitor Time: 30 minutes');
        console.log('🔄 Auto-monitoring enabled for all new payments');
        console.log('🚀========================================🚀\n');
        
        logger.info('🤖 Auto Payment Monitor service started');
    }

    /**
     * Stop the monitoring service
     */
    stop() {
        this.isRunning = false;
        this.activeMonitors.clear();
        this.userSessions.clear();
        this.paymentQueue.clear();
        
        console.log('\n🛑 Auto Payment Monitor stopped');
        logger.info('🤖 Auto Payment Monitor service stopped');
    }

    /**
     * Add a payment to auto-monitoring when QR is generated
     */
    addPayment(paymentData, sessionId = 'anonymous') {
        const { md5Hash, billNumber, amount, currency, storeLabel, qrCode } = paymentData;
        
        const monitorInfo = {
            md5Hash,
            billNumber,
            amount,
            currency,
            storeLabel,
            sessionId,
            startTime: Date.now(),
            lastCheck: Date.now(),
            checkCount: 0,
            status: 'MONITORING',
            qrCode: qrCode.substring(0, 50) + '...' // Store partial QR for logging
        };
        
        // Add to active monitors
        this.activeMonitors.set(md5Hash, monitorInfo);
        
        // Track user session
        if (!this.userSessions.has(sessionId)) {
            this.userSessions.set(sessionId, new Set());
        }
        this.userSessions.get(sessionId).add(md5Hash);
        
        // Add to payment queue
        this.paymentQueue.set(md5Hash, paymentData);
        
        console.log('\n🎯========================================🎯');
        console.log('       NEW PAYMENT AUTO-MONITORING        ');
        console.log('🎯========================================🎯');
        console.log(`💳 Payment ID: ${md5Hash}`);
        console.log(`📋 Bill Number: ${billNumber}`);
        console.log(`💰 Amount: ${amount} ${currency}`);
        console.log(`🏪 Store: ${storeLabel}`);
        console.log(`👤 Session: ${sessionId}`);
        console.log(`⏰ Started: ${new Date().toLocaleString()}`);
        console.log(`🔄 Auto-monitoring: ACTIVE`);
        console.log('🎯========================================🎯\n');
        
        logger.info('🎯 Auto-monitoring started for payment', {
            md5Hash,
            billNumber,
            sessionId,
            amount,
            currency
        });
        
        this.emit('payment_added', monitorInfo);
    }

    /**
     * Periodic check for all monitored payments
     */
    startPeriodicCheck() {
        const checkAllPayments = async () => {
            if (!this.isRunning) return;
            
            const activeCount = this.activeMonitors.size;
            
            if (activeCount > 0) {
                console.log(`[${new Date().toLocaleTimeString()}] 🔄 Checking ${activeCount} active payment(s)...`);
                
                const checkPromises = [];
                for (const [md5Hash, monitorInfo] of this.activeMonitors) {
                    checkPromises.push(this.checkSinglePayment(md5Hash, monitorInfo));
                }
                
                await Promise.all(checkPromises);
            }
            
            // Schedule next check
            setTimeout(checkAllPayments, this.checkInterval);
        };
        
        // Start the checking loop
        setTimeout(checkAllPayments, this.checkInterval);
    }

    /**
     * Check a single payment status
     */
    async checkSinglePayment(md5Hash, monitorInfo) {
        try {
            const now = Date.now();
            const elapsed = now - monitorInfo.startTime;
            
            // Check if monitoring time expired
            if (elapsed > this.maxMonitorTime) {
                this.expirePayment(md5Hash, monitorInfo);
                return;
            }
            
            monitorInfo.checkCount++;
            monitorInfo.lastCheck = now;
            
            // Check payment status
            const result = await this.paymentService.checkPaymentStatus(md5Hash);
            
            if (result.status === 'PAID') {
                this.handlePaymentSuccess(md5Hash, monitorInfo, result);
            } else {
                // Update status but continue monitoring
                monitorInfo.status = result.status;
                
                console.log(`[${new Date().toLocaleTimeString()}] 💳 ${monitorInfo.billNumber}: ${result.status} (Check #${monitorInfo.checkCount})`);
            }
            
        } catch (error) {
            console.error(`❌ Error checking payment ${md5Hash}:`, error.message);
            logger.error('Auto-monitor check failed', { md5Hash, error: error.message });
        }
    }

    /**
     * Handle successful payment
     */
    handlePaymentSuccess(md5Hash, monitorInfo, result) {
        console.log('\n🎊========================================🎊');
        console.log('      AUTO-MONITOR: PAYMENT SUCCESS!      ');
        console.log('🎊========================================🎊');
        console.log(`💳 Payment: ${monitorInfo.billNumber}`);
        console.log(`💰 Amount: ${monitorInfo.amount} ${monitorInfo.currency}`);
        console.log(`🏪 Store: ${monitorInfo.storeLabel}`);
        console.log(`👤 Session: ${monitorInfo.sessionId}`);
        console.log(`⏰ Paid At: ${new Date().toLocaleString()}`);
        console.log(`🕐 Monitor Duration: ${this.formatDuration(Date.now() - monitorInfo.startTime)}`);
        console.log(`🔢 Total Checks: ${monitorInfo.checkCount}`);
        console.log(`✅ Status: PAYMENT COMPLETED`);
        console.log('🎊========================================🎊\n');
        
        // Remove from monitoring
        this.removePayment(md5Hash);
        
        // Emit success event
        this.emit('payment_success', {
            md5Hash,
            monitorInfo,
            result,
            duration: Date.now() - monitorInfo.startTime
        });
        
        logger.info('🎊 Auto-monitor detected payment success', {
            md5Hash,
            billNumber: monitorInfo.billNumber,
            sessionId: monitorInfo.sessionId,
            duration: Date.now() - monitorInfo.startTime,
            checkCount: monitorInfo.checkCount
        });
    }

    /**
     * Handle payment expiration
     */
    expirePayment(md5Hash, monitorInfo) {
        console.log('\n⏰========================================⏰');
        console.log('     AUTO-MONITOR: PAYMENT EXPIRED        ');
        console.log('⏰========================================⏰');
        console.log(`💳 Payment: ${monitorInfo.billNumber}`);
        console.log(`💰 Amount: ${monitorInfo.amount} ${monitorInfo.currency}`);
        console.log(`🏪 Store: ${monitorInfo.storeLabel}`);
        console.log(`👤 Session: ${monitorInfo.sessionId}`);
        console.log(`⏰ Expired After: 30 minutes`);
        console.log(`🔢 Total Checks: ${monitorInfo.checkCount}`);
        console.log(`❌ Status: MONITORING EXPIRED`);
        console.log('⏰========================================⏰\n');
        
        // Remove from monitoring
        this.removePayment(md5Hash);
        
        // Emit expiry event
        this.emit('payment_expired', {
            md5Hash,
            monitorInfo,
            duration: this.maxMonitorTime
        });
        
        logger.info('⏰ Auto-monitor payment expired', {
            md5Hash,
            billNumber: monitorInfo.billNumber,
            sessionId: monitorInfo.sessionId,
            checkCount: monitorInfo.checkCount
        });
    }

    /**
     * Remove payment from monitoring
     */
    removePayment(md5Hash) {
        const monitorInfo = this.activeMonitors.get(md5Hash);
        if (!monitorInfo) return;
        
        // Remove from active monitors
        this.activeMonitors.delete(md5Hash);
        
        // Remove from payment queue
        this.paymentQueue.delete(md5Hash);
        
        // Remove from user session
        const sessionPayments = this.userSessions.get(monitorInfo.sessionId);
        if (sessionPayments) {
            sessionPayments.delete(md5Hash);
            if (sessionPayments.size === 0) {
                this.userSessions.delete(monitorInfo.sessionId);
            }
        }
    }

    /**
     * Get monitoring status for all payments
     */
    getMonitoringStatus() {
        const status = {
            totalActive: this.activeMonitors.size,
            totalSessions: this.userSessions.size,
            payments: [],
            summary: {
                monitoring: 0,
                expired: 0,
                completed: 0
            }
        };
        
        for (const [md5Hash, monitorInfo] of this.activeMonitors) {
            const elapsed = Date.now() - monitorInfo.startTime;
            status.payments.push({
                md5Hash,
                billNumber: monitorInfo.billNumber,
                amount: monitorInfo.amount,
                currency: monitorInfo.currency,
                sessionId: monitorInfo.sessionId,
                status: monitorInfo.status,
                elapsed: this.formatDuration(elapsed),
                checkCount: monitorInfo.checkCount
            });
            
            status.summary.monitoring++;
        }
        
        return status;
    }

    /**
     * Get user's payments
     */
    getUserPayments(sessionId) {
        const userPaymentIds = this.userSessions.get(sessionId) || new Set();
        const userPayments = [];
        
        for (const md5Hash of userPaymentIds) {
            const monitorInfo = this.activeMonitors.get(md5Hash);
            if (monitorInfo) {
                userPayments.push({
                    md5Hash,
                    billNumber: monitorInfo.billNumber,
                    amount: monitorInfo.amount,
                    currency: monitorInfo.currency,
                    status: monitorInfo.status,
                    elapsed: this.formatDuration(Date.now() - monitorInfo.startTime),
                    checkCount: monitorInfo.checkCount
                });
            }
        }
        
        return userPayments;
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Force check a specific payment
     */
    async forceCheck(md5Hash) {
        const monitorInfo = this.activeMonitors.get(md5Hash);
        if (!monitorInfo) {
            throw new Error(`Payment ${md5Hash} is not being monitored`);
        }
        
        await this.checkSinglePayment(md5Hash, monitorInfo);
        return monitorInfo;
    }

    // Getter methods for monitoring status
    getUserCount() {
        return new Set(Array.from(this.activeMonitors.values()).map(m => m.sessionId)).size;
    }

    getTotalPayments() {
        return this.activeMonitors.size;
    }

    getCompletedPayments() {
        return Array.from(this.activeMonitors.values()).filter(m => m.status === 'PAID').length;
    }

    getPendingPayments() {
        return Array.from(this.activeMonitors.values()).filter(m => m.status === 'UNPAID').length;
    }

    getActiveUsers() {
        const users = {};
        Array.from(this.activeMonitors.entries()).forEach(([hash, monitor]) => {
            if (!users[monitor.sessionId]) {
                users[monitor.sessionId] = {
                    userId: monitor.sessionId,
                    payments: [],
                    totalAmount: 0,
                    paidAmount: 0
                };
            }
            users[monitor.sessionId].payments.push({
                hash: hash,
                amount: monitor.amount,
                currency: monitor.currency,
                status: monitor.status,
                createdAt: new Date(monitor.startTime).toISOString()
            });
            users[monitor.sessionId].totalAmount += monitor.amount;
            if (monitor.status === 'PAID') {
                users[monitor.sessionId].paidAmount += monitor.amount;
            }
        });
        return Object.values(users);
    }

    getUserPayments(userId) {
        return Array.from(this.activeMonitors.entries())
            .filter(([hash, monitor]) => monitor.sessionId === userId)
            .map(([hash, monitor]) => ({
                hash: hash,
                amount: monitor.amount,
                currency: monitor.currency,
                status: monitor.status,
                createdAt: new Date(monitor.startTime).toISOString(),
                lastCheck: new Date(monitor.lastCheck).toISOString(),
                checkCount: monitor.checkCount
            }));
    }

    async forceCheckPayment(hash) {
        const monitor = this.activeMonitors.get(hash);
        if (!monitor) {
            throw new Error(`Payment with hash ${hash} not found`);
        }

        try {
            await this.checkSinglePayment(hash, monitor);
            return { success: true, data: monitor };
        } catch (error) {
            logger.error(`Force check failed for payment ${hash}:`, error);
            throw error;
        }
    }

    async forceCheckAllPayments() {
        const results = [];
        for (const [hash, monitor] of this.activeMonitors.entries()) {
            try {
                await this.checkSinglePayment(hash, monitor);
                results.push({ hash, success: true, data: monitor });
            } catch (error) {
                results.push({ hash, success: false, error: error.message });
            }
        }
        return results;
    }
}

module.exports = AutoPaymentMonitor;
