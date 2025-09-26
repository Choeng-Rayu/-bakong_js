# 🏦 Bakong KHQR Payment API

A comprehensive JavaScript implementation of the Bakong KHQR (Khmer QR) payment system for Cambodia's national payment platform. This project provides a complete REST API server with web interface for generating QR codes, processing payments, and monitoring transactions through the Bakong payment system.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Core Functions](#core-functions)
- [Web Interface](#web-interface)
- [Auto Payment Monitoring](#auto-payment-monitoring)
- [Logging](#logging)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

## 🌟 Overview

This project implements the Bakong KHQR payment specification in JavaScript/Node.js, providing:
- **QR Code Generation**: Creates EMV-compliant KHQR QR codes for payments
- **Payment Processing**: Handles payment creation, status checking, and monitoring
- **REST API**: Complete API server with comprehensive endpoints
- **Web Interface**: User-friendly web interface for testing and management
- **Auto Monitoring**: Real-time payment status monitoring with notifications
- **Logging**: Comprehensive logging system with structured data
- **Deep Links**: Generate Bakong app deep links for mobile payments

## ✨ Features

### Core Payment Features
- ✅ Static and Dynamic QR code generation
- ✅ Real-time payment status checking via Bakong API
- ✅ Auto payment monitoring with configurable intervals
- ✅ Bulk payment status checking (up to 50 transactions)
- ✅ Deep link generation for mobile app integration
- ✅ QR code image generation (PNG, SVG, Buffer formats)
- ✅ Transaction history and management

### Technical Features
- 🚀 Express.js REST API server
- 🔒 Security middleware (Helmet, CORS)
- 📝 Comprehensive logging with Winston
- 🎯 Auto payment monitoring service
- 🌐 Web-based testing interface
- 🔧 Environment-based configuration
- 📊 Transaction analytics and reporting

## 📋 Prerequisites

- **Node.js** >= 14.0.0
- **NPM** or **Yarn** package manager
- **Bakong Developer Account** with API credentials
- **Cambodia IP Address** (required for Bakong API access)

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd @bakong_js
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your Bakong credentials:
   ```env
   # Bakong Credentials
   BAKONG_MERCHANT_ID=your_merchant_id
   BAKONG_PHONE_NUMBER=85512345678
   BAKONG_DEVELOPER_TOKEN=your_developer_token
   
   # API Configuration
   PORT=3000
   NODE_ENV=development
   BAKONG_API_URL=https://api-bakong.nbc.gov.kh/v1
   
   # Default Merchant Info
   DEFAULT_MERCHANT_NAME=Your Store Name
   DEFAULT_MERCHANT_CITY=Phnom Penh
   ```

4. **Start the server**
   ```bash
   # Production mode
   npm start
   
   # Development mode (with auto-restart)
   npm run dev
   ```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `BAKONG_MERCHANT_ID` | Your Bakong merchant ID | ✅ | - |
| `BAKONG_PHONE_NUMBER` | Merchant phone (without +) | ✅ | - |
| `BAKONG_DEVELOPER_TOKEN` | Bakong API developer token | ✅ | - |
| `PORT` | Server port | ❌ | 3000 |
| `NODE_ENV` | Environment mode | ❌ | development |
| `BAKONG_API_URL` | Bakong API base URL | ❌ | https://api-bakong.nbc.gov.kh/v1 |
| `DEFAULT_MERCHANT_NAME` | Default merchant name | ❌ | your_store_name |
| `DEFAULT_MERCHANT_CITY` | Default merchant city | ❌ | Phnom Penh |
| `LOG_LEVEL` | Logging level | ❌ | info |
| `LOG_DIR` | Log directory path | ❌ | ./logs |

## 🎯 Usage

### Starting the Server

```bash
npm start
```

The server will start and display:
```
╔══════════════════════════════════════════════════════════════╗
║                🏦 BAKONG KHQR PAYMENT API                    ║
║              Server running successfully!                    ║
╚══════════════════════════════════════════════════════════════╝

🌐 Server URL: http://localhost:3000
📱 Web Interface: http://localhost:3000/web
🔍 Health Check: http://localhost:3000/api/health
📊 API Documentation: http://localhost:3000
```

### Quick Test

1. Open web interface: `http://localhost:3000/web`
2. Fill in payment details (amount, currency, bill number)
3. Click "Generate QR Code"
4. Use Bakong mobile app to scan the QR code
5. Monitor payment status in real-time

## 📡 API Endpoints

### Payment Operations

#### Create Payment QR Code
```http
POST /api/payments/create
Content-Type: application/json

{
  "amount": 10.50,
  "currency": "USD",
  "billNumber": "INV001",
  "storeLabel": "My Store",
  "terminalLabel": "POS-01",
  "merchantName": "Store Owner",
  "merchantCity": "Phnom Penh",
  "isStatic": false,
  "callback": "https://your-app.com/success",
  "appIconUrl": "https://your-app.com/icon.png",
  "appName": "Your App"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-here",
    "qrCode": "00020101021229...",
    "md5Hash": "abc123...",
    "deepLink": "https://bakong.page.link/...",
    "imagePath": "/temp/qr_INV001.png",
    "billNumber": "INV001",
    "amount": 10.50,
    "currency": "USD",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "status": "PENDING"
  }
}
```

#### Check Payment Status
```http
GET /api/payments/check/{transactionId_or_md5Hash}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "PAID",
    "transactionId": "uuid-here",
    "md5Hash": "abc123...",
    "amount": 10.50,
    "currency": "USD",
    "paidAt": "2024-01-01T00:05:00.000Z",
    "bakongData": {
      "fromAccountId": "customer@bank",
      "toAccountId": "merchant@bank",
      "hash": "transaction-hash",
      "description": "Payment description"
    }
  }
}
```

#### Monitor Payment (Real-time)
```http
POST /api/payments/monitor
Content-Type: application/json

{
  "identifier": "transaction-id-or-md5",
  "timeout": 300000,
  "interval": 5000
}
```

#### Bulk Payment Check
```http
POST /api/payments/bulk-check
Content-Type: application/json

{
  "md5List": ["hash1", "hash2", "hash3"]
}
```

### Transaction Management

#### Get All Transactions
```http
GET /api/payments/transactions?status=PAID&limit=10&offset=0
```

#### Get Transaction History
```http
GET /api/payments/history?days=30
```

#### Get Single Transaction
```http
GET /api/payments/transaction/{transactionId}
```

### System Endpoints

#### Health Check
```http
GET /api/health
```

#### Server Status
```http
GET /
```

## 🔧 Core Functions

### BakongKHQR Class

The main class that handles KHQR operations:

```javascript
const BakongKHQR = require('./src/BakongKHQR');

// Initialize with developer token
const khqr = new BakongKHQR('your_developer_token');

// Create QR code
const qrCode = khqr.createQR({
  bankAccount: 'merchant_id',
  merchantName: 'Store Name',
  merchantCity: 'Phnom Penh',
  amount: 10.50,
  currency: 'USD',
  storeLabel: 'Store',
  phoneNumber: '85512345678',
  billNumber: 'INV001',
  terminalLabel: 'POS-01',
  isStatic: false
});

// Generate MD5 hash for tracking
const md5Hash = khqr.generateMD5(qrCode);

// Check payment status
const status = await khqr.checkPayment(md5Hash);

// Generate QR image
const imageBuffer = await khqr.generateQRImage(qrCode, { format: 'buffer' });

// Generate deep link
const deepLink = await khqr.generateDeeplink(qrCode);
```

### PaymentService Class

High-level service for payment operations:

```javascript
const PaymentService = require('./src/PaymentService');

const paymentService = new PaymentService();

// Create payment
const payment = await paymentService.createPayment({
  amount: 10.50,
  currency: 'USD',
  billNumber: 'INV001'
});

// Monitor payment with real-time updates
const result = await paymentService.monitorPayment(payment.transactionId, {
  timeout: 300000,  // 5 minutes
  interval: 5000    // check every 5 seconds
});
```

### AutoPaymentMonitor Class

Automatic background monitoring service:

```javascript
const AutoPaymentMonitor = require('./src/AutoPaymentMonitor');

const monitor = new AutoPaymentMonitor(paymentService);

// Start monitoring
monitor.start();

// Add payment to monitoring queue
monitor.addPayment(transactionId, {
  priority: 'high',
  maxAttempts: 60,
  callback: (status) => console.log('Payment status:', status)
});
```

## 🌐 Web Interface

Access the web interface at `http://localhost:3000/web` for:

- **Payment Creation**: Visual form to create QR codes
- **QR Code Display**: Generated QR codes with download options
- **Real-time Monitoring**: Live payment status updates
- **Transaction History**: View all payment transactions
- **Deep Link Testing**: Test mobile app integration
- **API Testing**: Interactive API endpoint testing

### Features:
- 📱 Responsive design for mobile and desktop
- 🔄 Real-time status updates via WebSocket-like polling
- 📊 Transaction analytics dashboard
- 💾 QR code image download
- 📋 Copy QR code strings
- 🔗 Deep link generation and testing

## 🤖 Auto Payment Monitoring

The system includes automatic payment monitoring that:

- **Background Processing**: Monitors payments without blocking the API
- **Configurable Intervals**: Set custom check intervals per payment
- **Priority Queuing**: High-priority payments checked more frequently
- **Failure Handling**: Automatic retry with exponential backoff
- **Notifications**: Real-time status updates and callbacks
- **Resource Management**: Automatic cleanup of completed transactions

### Configuration:
```javascript
// Default monitoring settings
{
  interval: 5000,        // Check every 5 seconds
  maxAttempts: 60,       // Maximum check attempts
  timeout: 300000,       // 5-minute total timeout
  priority: 'normal',    // Priority level
  retryDelay: 1000      // Delay between retries
}
```

## 📊 Logging

Comprehensive logging system with structured data:

### Log Types:
- **API Requests**: All incoming requests with metadata
- **Payment Operations**: Creation, status checks, monitoring
- **Bakong API Calls**: External API interactions
- **Auto Monitor Events**: Background monitoring activities
- **User Sessions**: Session-based activity tracking
- **Errors**: Detailed error information with stack traces

### Log Files:
- `logs/bakong-api.log`: General application logs
- `logs/bakong-error.log`: Error-specific logs
- `server.log`: Server startup and shutdown logs

### Log Format:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "Payment created successfully",
  "transactionId": "uuid-here",
  "amount": 10.50,
  "currency": "USD",
  "sessionId": "user-session-id"
}
```

## 🛡️ Error Handling

### API Error Responses:
```json
{
  "success": false,
  "error": "Detailed error message",
  "message": "User-friendly message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Common Error Codes:
- `INVALID_AMOUNT`: Amount validation failed
- `INVALID_CURRENCY`: Unsupported currency
- `BAKONG_API_ERROR`: Bakong API returned an error
- `TIMEOUT_ERROR`: Request timeout exceeded
- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Transaction not found
- `DUPLICATE_BILL`: Bill number already exists

### Bakong API Error Handling:
- **400**: Bad request - Invalid input parameters
- **401**: Unauthorized - Invalid or expired developer token
- **403**: Forbidden - IP address not whitelisted (must be Cambodia IP)
- **404**: Not found - Invalid API endpoint
- **429**: Rate limited - Too many requests
- **500**: Internal server error - Bakong server issue
- **504**: Gateway timeout - Bakong server busy

## 🔍 Testing

### Run Tests:
```bash
npm test
```

### Manual Testing:
1. Start server: `npm start`
2. Open web interface: `http://localhost:3000/web`
3. Use test interface: `http://localhost:3000/test`
4. Check API health: `http://localhost:3000/api/health`

### Test Payment Flow:
1. Create payment via API or web interface
2. Get QR code and MD5 hash
3. Use Bakong mobile app to scan QR
4. Monitor payment status via API
5. Verify payment completion

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Commit changes: `git commit -m 'Add feature'`
5. Push to branch: `git push origin feature-name`
6. Submit pull request

### Development Setup:
```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Run linting
npm run lint

# Run tests
npm test
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **National Bank of Cambodia** for the Bakong payment system
- **Bakong Development Team** for API documentation and support
- **EMV® Co.** for QR code payment specifications

## 📞 Support

For support and questions:
- Check the logs in `logs/` directory
- Review API documentation at server root endpoint
- Test with the web interface for debugging
- Ensure Cambodia IP address for API access

## 🔄 Version History

### v1.0.0
- Initial release
- Complete KHQR implementation
- REST API server
- Web interface
- Auto payment monitoring
- Comprehensive logging
- Error handling

---

**Made with ❤️ for Cambodia's digital payment ecosystem**