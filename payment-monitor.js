#!/usr/bin/env node

/**
 * Real-time Payment Monitor
 * Shows enhanced console logging when payments are completed
 */

require('dotenv').config();
const BakongKHQR = require('./src/BakongKHQR');
const PaymentService = require('./src/PaymentService');

class PaymentMonitor {
    constructor() {
        this.khqr = new BakongKHQR(process.env.BAKONG_DEVELOPER_TOKEN);
        this.paymentService = new PaymentService();
        this.monitoredPayments = new Set();
    }

    async monitorPayment(md5Hash) {
        console.log(`\n🔍 Starting payment monitor for: ${md5Hash}`);
        console.log('⏰ Will check every 5 seconds until payment is completed...\n');
        
        this.monitoredPayments.add(md5Hash);
        
        const checkInterval = setInterval(async () => {
            try {
                console.log(`[${new Date().toLocaleTimeString()}] 🔄 Checking payment status...`);
                
                // This will trigger all our enhanced logging
                const result = await this.paymentService.checkPaymentStatus(md5Hash);
                
                if (result.status === 'PAID') {
                    console.log('\n🎊 PAYMENT MONITORING COMPLETED! 🎊');
                    console.log('✅ Payment has been successfully processed');
                    console.log('🛑 Stopping monitor for this payment\n');
                    
                    clearInterval(checkInterval);
                    this.monitoredPayments.delete(md5Hash);
                } else {
                    console.log(`[${new Date().toLocaleTimeString()}] ⏳ Status: ${result.status} - continuing to monitor...\n`);
                }
                
            } catch (error) {
                console.error(`❌ Monitor error: ${error.message}`);
            }
        }, 5000); // Check every 5 seconds
        
        // Stop monitoring after 10 minutes
        setTimeout(() => {
            if (this.monitoredPayments.has(md5Hash)) {
                console.log(`⏰ Monitor timeout for ${md5Hash} - stopping after 10 minutes`);
                clearInterval(checkInterval);
                this.monitoredPayments.delete(md5Hash);
            }
        }, 600000); // 10 minutes
    }

    async checkOnce(md5Hash) {
        console.log(`\n🔍 Single payment check for: ${md5Hash}\n`);
        
        try {
            // This will trigger all our enhanced logging
            const result = await this.paymentService.checkPaymentStatus(md5Hash);
            
            console.log('\n✅ Single check completed!');
            console.log(`📊 Final status: ${result.status}`);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Check error: ${error.message}`);
            throw error;
        }
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
🏦 Bakong KHQR Payment Monitor

Usage:
  node payment-monitor.js check <md5_hash>     - Check payment once
  node payment-monitor.js monitor <md5_hash>   - Monitor payment continuously

Examples:
  node payment-monitor.js check a2f735a47734f3ffee962821867ff48a
  node payment-monitor.js monitor a2f735a47734f3ffee962821867ff48a
        `);
        process.exit(1);
    }
    
    const command = args[0];
    const md5Hash = args[1];
    
    if (!md5Hash) {
        console.error('❌ Please provide an MD5 hash');
        process.exit(1);
    }
    
    const monitor = new PaymentMonitor();
    
    try {
        if (command === 'check') {
            await monitor.checkOnce(md5Hash);
        } else if (command === 'monitor') {
            await monitor.monitorPayment(md5Hash);
        } else {
            console.error('❌ Unknown command. Use "check" or "monitor"');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n👋 Payment monitor stopped by user');
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = PaymentMonitor;
