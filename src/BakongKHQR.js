/**
 * Bakong KHQR JavaScript SDK
 * Core implementation of Bakong QR code generation and payment processing
 */

const crypto = require('crypto');
const axios = require('axios');
const QRCode = require('qrcode');

// EMV Constants
const EMV = {
    // Default QR Code Types
    DEFAULT_DYNAMIC_QR: "010212",
    DEFAULT_STATIC_QR: "010211",
    
    // Currency Code
    TRANSACTION_CURRENCY_USD: "840",
    TRANSACTION_CURRENCY_KHR: "116",
    TRANSACTION_CURRENCY: "53",
    
    // Payload and Point of Initiation
    PAYLOAD_FORMAT_INDICATOR: "00",
    DEFAULT_PAYLOAD_FORMAT_INDICATOR: "01",
    POINT_OF_INITIATION_METHOD: "01",
    STATIC_QR: "11",
    DYNAMIC_QR: "12",
    
    // Merchant Info
    MERCHANT_NAME: "59",
    MERCHANT_CITY: "60",
    DEFAULT_MERCHANT_CITY: "Phnom Penh",
    MERCHANT_CATEGORY_CODE: "52",
    DEFAULT_MERCHANT_CATEGORY_CODE: "5999",
    COUNTRY_CODE: "58",
    DEFAULT_COUNTRY_CODE: "KH",
    MERCHANT_ACCOUNT_INFORMATION_INDIVIDUAL: "29",
    
    // Transaction Info
    TRANSACTION_AMOUNT: "54",
    
    // Additional Data
    ADDITION_DATA_TAG: "62",
    BILLNUMBER_TAG: "01",
    ADDITION_DATA_FIELD_MOBILE_NUMBER: "02",
    STORE_LABEL: "03",
    TERMINAL_LABEL: "07",
    PURPOSE_OF_TRANSACTION: "08",
    TIMESTAMP_TAG: "99",
    
    // CRC Tag
    CRC: "63",
    CRC_LENGTH: "04",
    DEFAULT_CRC_TAG: "6304",
    
    // Invalid Length Constraints
    INVALID_LENGTH_KHQR: 12,
    INVALID_LENGTH_MERCHANT_NAME: 25,
    INVALID_LENGTH_BAKONG_ACCOUNT: 32,
    INVALID_LENGTH_AMOUNT: 13,
    INVALID_LENGTH_COUNTRY_CODE: 3,
    INVALID_LENGTH_MERCHANT_CATEGORY_CODE: 4,
    INVALID_LENGTH_MERCHANT_CITY: 15,
    INVALID_LENGTH_TIMESTAMP: 13,
    INVALID_LENGTH_TRANSACTION_AMOUNT: 14,
    INVALID_LENGTH_TRANSACTION_CURRENCY: 3,
    INVALID_LENGTH_BILL_NUMBER: 25,
    INVALID_LENGTH_STORE_LABEL: 25,
    INVALID_LENGTH_TERMINAL_LABEL: 25,
    INVALID_LENGTH_PURPOSE_OF_TRANSACTION: 25,
    INVALID_LENGTH_MERCHANT_ID: 32,
    INVALID_LENGTH_ACQUIRING_BANK: 32,
    INVALID_LENGTH_MOBILE_NUMBER: 25,
    INVALID_LENGTH_ACCOUNT_INFORMATION: 32
};

class BakongKHQR {
    constructor(bakongToken = null) {
        this.bakongToken = bakongToken;
        this.bakongApiUrl = process.env.BAKONG_API_URL || 'https://api-bakong.nbc.gov.kh/v1';
        this.userAgent = 'bakong-khqr-js/1.0.0 (+https://github.com/bsthen/bakong-khqr); Mozilla/5.0';
    }

    /**
     * Check if Bakong Developer Token is provided
     */
    checkBakongToken() {
        if (!this.bakongToken) {
            throw new Error('Bakong Developer Token is required for KHQR class initialization.');
        }
    }

    /**
     * Make POST request to Bakong API
     */
    async postRequest(endpoint, payload) {
        this.checkBakongToken();

        const headers = {
            'Authorization': `Bearer ${this.bakongToken}`,
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent
        };

        try {
            const response = await axios.post(`${this.bakongApiUrl}${endpoint}`, payload, { headers });
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const data = error.response?.data;

            switch (status) {
                case 400:
                    throw new Error('Bad request. Please check your input parameters and try again.');
                case 401:
                    throw new Error('Your Developer Token is either incorrect or expired. Please renew it through Bakong Developer.');
                case 403:
                    throw new Error('Bakong API only accepts requests from Cambodia IP addresses. Your IP may be blocked or restricted.');
                case 404:
                    throw new Error('The requested Bakong API endpoint does not exist. Please check the endpoint URL.');
                case 429:
                    throw new Error('Too many requests. Please wait a while before trying again.');
                case 500:
                    throw new Error('Bakong server encountered an internal error. Please try again later.');
                case 504:
                    throw new Error('Bakong server is busy, please try again later.');
                default:
                    throw new Error(`Something went wrong. HTTP ${status}: ${data || error.message}`);
            }
        }
    }

    /**
     * Format value with tag and length
     */
    formatValue(tag, value) {
        const valueStr = String(value);
        const length = valueStr.length.toString().padStart(2, '0');
        return `${tag}${length}${valueStr}`;
    }

    /**
     * Validate field length
     */
    validateLength(value, maxLength, fieldName) {
        if (value.length > maxLength) {
            throw new Error(`${fieldName} cannot exceed ${maxLength} characters. Your input length: ${value.length} characters.`);
        }
    }

    /**
     * Generate payload format indicator
     */
    payloadFormatIndicator() {
        return this.formatValue(EMV.PAYLOAD_FORMAT_INDICATOR, EMV.DEFAULT_PAYLOAD_FORMAT_INDICATOR);
    }

    /**
     * Generate point of initiation
     */
    pointOfInitiation(isStatic = false) {
        const type = isStatic ? EMV.STATIC_QR : EMV.DYNAMIC_QR;
        return this.formatValue(EMV.POINT_OF_INITIATION_METHOD, type);
    }

    /**
     * Generate global unique identifier
     */
    globalUniqueIdentifier(bankAccount) {
        this.validateLength(bankAccount, EMV.INVALID_LENGTH_BAKONG_ACCOUNT, 'Bank account');
        
        // Following the original Python implementation format
        const accountInfo = this.formatValue(EMV.PAYLOAD_FORMAT_INDICATOR, bankAccount);
        return this.formatValue(EMV.MERCHANT_ACCOUNT_INFORMATION_INDIVIDUAL, accountInfo);
    }

    /**
     * Generate merchant category code
     */
    merchantCategoryCode() {
        return this.formatValue(EMV.MERCHANT_CATEGORY_CODE, EMV.DEFAULT_MERCHANT_CATEGORY_CODE);
    }

    /**
     * Generate country code
     */
    countryCode() {
        return this.formatValue(EMV.COUNTRY_CODE, EMV.DEFAULT_COUNTRY_CODE);
    }

    /**
     * Generate merchant name
     */
    merchantName(name) {
        this.validateLength(name, EMV.INVALID_LENGTH_MERCHANT_NAME, 'Merchant name');
        return this.formatValue(EMV.MERCHANT_NAME, name);
    }

    /**
     * Generate merchant city
     */
    merchantCity(city) {
        this.validateLength(city, EMV.INVALID_LENGTH_MERCHANT_CITY, 'Merchant city');
        return this.formatValue(EMV.MERCHANT_CITY, city);
    }

    /**
     * Generate timestamp
     */
    timestamp() {
        // Following Python implementation - use milliseconds and add language preference
        const timestampMs = Date.now().toString();
        const lengthOfTimestamp = timestampMs.length.toString().padStart(2, '0');
        const languagePreference = "00"; // Language preference (matches Python "language_perference")
        const result = languagePreference + lengthOfTimestamp + timestampMs;
        const lengthResult = result.length.toString().padStart(2, '0');
        return EMV.TIMESTAMP_TAG + lengthResult + result;
    }

    /**
     * Generate amount
     */
    amount(value) {
        let amountStr = parseFloat(value).toFixed(2);
        
        // Remove trailing zeros and decimal point if not needed (matching Python logic)
        amountStr = amountStr.replace(/\.?0+$/, '');
        
        // Pad with leading zeros to ensure it's 11 characters (matching Python zfill(11))
        const paddedAmountStr = amountStr.padStart(11, '0');
        
        this.validateLength(paddedAmountStr, EMV.INVALID_LENGTH_TRANSACTION_AMOUNT, 'Amount');
        return this.formatValue(EMV.TRANSACTION_AMOUNT, paddedAmountStr);
    }

    /**
     * Generate transaction currency
     */
    transactionCurrency(currency) {
        const currencyCode = currency.toUpperCase() === 'USD' ? 
            EMV.TRANSACTION_CURRENCY_USD : EMV.TRANSACTION_CURRENCY_KHR;
        return this.formatValue(EMV.TRANSACTION_CURRENCY, currencyCode);
    }

    /**
     * Generate additional data field
     */
    additionalDataField(storeLabel, phoneNumber, billNumber, terminalLabel) {
        this.validateLength(billNumber, EMV.INVALID_LENGTH_BILL_NUMBER, 'Bill number');
        this.validateLength(phoneNumber, EMV.INVALID_LENGTH_MOBILE_NUMBER, 'Phone number');
        this.validateLength(storeLabel, EMV.INVALID_LENGTH_STORE_LABEL, 'Store label');
        this.validateLength(terminalLabel, EMV.INVALID_LENGTH_TERMINAL_LABEL, 'Terminal label');

        const billNumberValue = this.formatValue(EMV.BILLNUMBER_TAG, billNumber);
        const phoneNumberValue = this.formatValue(EMV.ADDITION_DATA_FIELD_MOBILE_NUMBER, phoneNumber);
        const storeLabelValue = this.formatValue(EMV.STORE_LABEL, storeLabel);
        const terminalLabelValue = this.formatValue(EMV.TERMINAL_LABEL, terminalLabel);

        const combinedData = billNumberValue + phoneNumberValue + storeLabelValue + terminalLabelValue;
        return this.formatValue(EMV.ADDITION_DATA_TAG, combinedData);
    }

    /**
     * Generate CRC16
     */
    generateCRC16(data) {
        let crc = 0xFFFF;
        const polynomial = 0x1021;

        for (let i = 0; i < data.length; i++) {
            crc ^= (data.charCodeAt(i) << 8);
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ polynomial;
                } else {
                    crc <<= 1;
                }
                crc &= 0xFFFF;
            }
        }

        return crc.toString(16).toUpperCase().padStart(4, '0');
    }

    /**
     * Generate CRC
     */
    crc(qrData) {
        const dataWithCrcTag = qrData + EMV.DEFAULT_CRC_TAG;
        const crcValue = this.generateCRC16(dataWithCrcTag);
        return EMV.DEFAULT_CRC_TAG + crcValue;
    }

    /**
     * Create QR code string
     */
    createQR(options) {
        const {
            bankAccount,
            merchantName,
            merchantCity,
            amount,
            currency,
            storeLabel,
            phoneNumber,
            billNumber,
            terminalLabel,
            isStatic = false
        } = options;

        let qrData = '';
        qrData += this.payloadFormatIndicator();
        qrData += this.pointOfInitiation(isStatic);
        qrData += this.globalUniqueIdentifier(bankAccount);
        qrData += this.merchantCategoryCode();
        qrData += this.countryCode();
        qrData += this.merchantName(merchantName);
        qrData += this.merchantCity(merchantCity);
        qrData += this.timestamp();
        
        if (!isStatic) {
            qrData += this.amount(amount);
        }
        
        qrData += this.transactionCurrency(currency);
        qrData += this.additionalDataField(storeLabel, phoneNumber, billNumber, terminalLabel);
        qrData += this.crc(qrData);

        return qrData;
    }

    /**
     * Generate MD5 hash
     */
    generateMD5(qr) {
        return crypto.createHash('md5').update(qr).digest('hex');
    }

    /**
     * Generate deep link
     */
    async generateDeeplink(qr, callback = 'https://bakong.nbc.org.kh', appIconUrl = 'https://bakong.nbc.gov.kh/images/logo.svg', appName = 'MyAppName') {
        const payload = {
            qr,
            sourceInfo: {
                appIconUrl,
                appName,
                appDeepLinkCallback: callback
            }
        };

        const response = await this.postRequest('/generate_deeplink_by_qr', payload);
        return response.responseCode === 0 ? response.data?.shortLink : null;
    }

    /**
     * Check payment status by MD5
     */
    async checkPayment(md5) {
        console.log(`[DEBUG] Checking payment with MD5: ${md5}`);
        console.log(`[DEBUG] Bakong token available: ${!!this.bakongToken}`);
        console.log(`[DEBUG] API URL: ${this.bakongApiUrl}`);
        
        const payload = { md5 };
        
        try {
            const response = await this.postRequest('/check_transaction_by_md5', payload);
            console.log(`[DEBUG] Bakong API response:`, JSON.stringify(response, null, 2));
            
            if (response.responseCode === 0) {
                // Payment is PAID - Enhanced logging
                const paymentData = response.data;
                
                console.log('\n🎉========================================🎉');
                console.log('           PAYMENT SUCCESSFUL!           ');
                console.log('🎉========================================🎉');
                console.log(`💰 Amount: ${paymentData.amount} ${paymentData.currency}`);
                console.log(`👤 From: ${paymentData.fromAccountId}`);
                console.log(`🏦 To: ${paymentData.toAccountId}`);
                console.log(`📝 Description: ${paymentData.description}`);
                console.log(`⏰ Created: ${new Date(paymentData.createdDateMs).toLocaleString()}`);
                console.log(`✅ Acknowledged: ${new Date(paymentData.acknowledgedDateMs).toLocaleString()}`);
                console.log(`🔗 Transaction Hash: ${paymentData.hash}`);
                console.log(`📋 External Ref: ${paymentData.externalRef}`);
                console.log(`🔑 MD5: ${md5}`);
                console.log('🎉========================================🎉\n');
                
                return 'PAID';
            } else {
                console.log(`[INFO] Payment status: UNPAID - ${response.responseMessage}`);
                return 'UNPAID';
            }
        } catch (error) {
            console.log(`[ERROR] Bakong API error:`, error.message);
            return 'UNPAID';
        }
    }

    /**
     * Get payment details by MD5
     */
    async getPayment(md5) {
        const payload = { md5 };
        const response = await this.postRequest('/check_transaction_by_md5', payload);
        return response.responseCode === 0 ? response.data : null;
    }

    /**
     * Check bulk payments
     */
    async checkBulkPayments(md5List) {
        if (md5List.length > 50) {
            throw new Error('The md5_list exceeds the allowed limit of 50 hashes per request.');
        }

        const response = await this.postRequest('/check_transaction_by_md5_list', md5List);
        return response.data?.filter(data => data.status === 'SUCCESS').map(data => data.md5) || [];
    }

    /**
     * Generate QR code image
     */
    async generateQRImage(qr, options = {}) {
        const { format = 'png', outputPath = null } = options;

        try {
            switch (format.toLowerCase()) {
                case 'base64':
                    return await QRCode.toDataURL(qr);
                case 'buffer':
                    return await QRCode.toBuffer(qr);
                case 'svg':
                    return await QRCode.toString(qr, { type: 'svg' });
                default:
                    if (outputPath) {
                        await QRCode.toFile(outputPath, qr);
                        return outputPath;
                    } else {
                        return await QRCode.toBuffer(qr);
                    }
            }
        } catch (error) {
            throw new Error(`QR image generation failed: ${error.message}`);
        }
    }
}

module.exports = BakongKHQR;
