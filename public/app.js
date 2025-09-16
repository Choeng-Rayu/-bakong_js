// app.js - Frontend logic for Bakong KHQR Payment Tester

const API_BASE = 'http://localhost:3004/api';

function logActivity(message, type = '') {
    const logContainer = document.getElementById('log-container');
    const entry = document.createElement('div');
    entry.className = 'log-entry' + (type ? ' ' + type : '');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelector(`.tab[onclick*="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
}

// --- Create Payment ---
document.getElementById('payment-form').onsubmit = async function(e) {
    e.preventDefault();
    document.getElementById('create-loading').style.display = 'block';
    document.getElementById('qr-result').innerHTML = '';
    logActivity('Submitting payment creation request...');

    const data = {
        amount: parseFloat(document.getElementById('amount').value),
        currency: document.getElementById('currency').value,
        description: document.getElementById('description').value,
        storeLabel: document.getElementById('store-label').value,
        billNumber: document.getElementById('bill-number').value,
        terminalLabel: document.getElementById('store-label').value,
        isStatic: document.getElementById('qr-type').value === 'true'
    };

    try {
        console.log('Sending payment request:', data);
        const res = await fetch(`${API_BASE}/payments/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('Response status:', res.status);
        const result = await res.json();
        console.log('Response data:', result);
        document.getElementById('create-loading').style.display = 'none';
        if (result.success) {
            logActivity('QR code generated successfully', 'success');
            showQRResult(result.data);
        } else {
            logActivity('Failed to generate QR: ' + result.error, 'error');
            showError('qr-result', result.error);
        }
    } catch (err) {
        document.getElementById('create-loading').style.display = 'none';
        logActivity('Error: ' + err.message, 'error');
        showError('qr-result', err.message);
    }
};

function showQRResult(data) {
    const el = document.getElementById('qr-result');
    // Extract just the filename from the full path
    const imagePath = data.imagePath.split('/').pop();
    el.innerHTML = `
        <div class="result-card success">
            <h4>QR Code Generated</h4>
            <div class="qr-display">
                <div class="qr-code">
                    <img src="/temp/${imagePath}" alt="QR Code" width="220" height="220">
                </div>
            </div>
            <div class="qr-text">${data.qrCode}</div>
            <div><b>MD5 Hash:</b> ${data.md5Hash}</div>
            <div><b>Bill Number:</b> ${data.billNumber}</div>
            <div><b>Amount:</b> ${data.amount} ${data.currency}</div>
            <div><b>Status:</b> <span class="status-indicator status-pending">PENDING</span></div>
            ${data.deepLink ? `<div style="margin-top:10px;"><a href="${data.deepLink}" target="_blank" class="btn btn-success">Open in Bakong App</a></div>` : ''}
            
            <div class="monitor-status" style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 5px;">
                <h4>🎯 Auto-Monitor Status</h4>
                <p>✅ Payment is being automatically monitored</p>
                <p>⏱️ Checking every 10 seconds for 30 minutes</p>
                <div style="margin-top: 10px;">
                    <button onclick="checkMonitorStatus()" class="btn" style="margin-right: 10px;">Check Monitor Status</button>
                    <button onclick="forceCheckPayment('${data.md5Hash}')" class="btn">Force Check Now</button>
                </div>
            </div>
        </div>
    `;
}

function showError(target, message) {
    document.getElementById(target).innerHTML = `<div class="result-card error">${message}</div>`;
}

// --- Check Status ---
document.getElementById('check-form').onsubmit = async function(e) {
    e.preventDefault();
    document.getElementById('check-loading').style.display = 'block';
    document.getElementById('check-result').innerHTML = '';
    logActivity('Checking payment status...');
    const identifier = document.getElementById('check-identifier').value;
    try {
        const res = await fetch(`${API_BASE}/payments/check/${identifier}`);
        const result = await res.json();
        document.getElementById('check-loading').style.display = 'none';
        if (result.success) {
            logActivity('Payment status: ' + result.data.status, result.data.status === 'PAID' ? 'success' : 'warning');
            showStatusResult(result.data);
        } else {
            logActivity('Failed to check status: ' + result.error, 'error');
            showError('check-result', result.error);
        }
    } catch (err) {
        document.getElementById('check-loading').style.display = 'none';
        logActivity('Error: ' + err.message, 'error');
        showError('check-result', err.message);
    }
};

function showStatusResult(data) {
    const el = document.getElementById('check-result');
    el.innerHTML = `
        <div class="result-card ${data.status === 'PAID' ? 'success' : 'warning'}">
            <h4>Payment Status: <span class="status-indicator status-${data.status.toLowerCase()}">${data.status}</span></h4>
            <div><b>MD5 Hash:</b> ${data.md5Hash}</div>
            <div><b>Checked At:</b> ${data.checkedAt}</div>
            ${data.paymentDetails ? `<pre>${JSON.stringify(data.paymentDetails, null, 2)}</pre>` : ''}
        </div>
    `;
}

// --- Monitor Payment ---
let monitorInterval = null;
document.getElementById('monitor-form').onsubmit = function(e) {
    e.preventDefault();
    startMonitor();
};
document.getElementById('stop-monitor').onclick = function() {
    stopMonitor();
};

function startMonitor() {
    const identifier = document.getElementById('monitor-identifier').value;
    const timeout = parseInt(document.getElementById('monitor-timeout').value) * 1000;
    const interval = parseInt(document.getElementById('monitor-interval').value) * 1000;
    let elapsed = 0;
    document.getElementById('monitor-loading').style.display = 'block';
    document.getElementById('monitor-result').innerHTML = '';
    document.getElementById('stop-monitor').style.display = 'inline-block';
    logActivity('Started monitoring payment...');
    monitorInterval = setInterval(async () => {
        elapsed += interval;
        document.getElementById('monitor-time').textContent = Math.floor(elapsed / 1000);
        try {
            const res = await fetch(`${API_BASE}/payments/check/${identifier}`);
            const result = await res.json();
            if (result.success && result.data.status === 'PAID') {
                logActivity('Payment completed!', 'success');
                showStatusResult(result.data);
                stopMonitor();
            } else if (elapsed >= timeout) {
                logActivity('Monitoring timed out', 'warning');
                showError('monitor-result', 'Monitoring timed out');
                stopMonitor();
            }
        } catch (err) {
            logActivity('Monitor error: ' + err.message, 'error');
            showError('monitor-result', err.message);
            stopMonitor();
        }
    }, interval);
}

function stopMonitor() {
    if (monitorInterval) clearInterval(monitorInterval);
    document.getElementById('monitor-loading').style.display = 'none';
    document.getElementById('stop-monitor').style.display = 'none';
    logActivity('Stopped monitoring payment', 'warning');
}

// --- Transaction History ---
async function loadTransactions() {
    document.getElementById('history-loading').style.display = 'block';
    document.getElementById('history-result').innerHTML = '';
    logActivity('Loading transaction history...');
    try {
        const res = await fetch(`${API_BASE}/payments/history?limit=50`);
        const result = await res.json();
        document.getElementById('history-loading').style.display = 'none';
        if (result.success) {
            logActivity('Loaded transaction history', 'success');
            showHistory(result.data.history);
        } else {
            logActivity('Failed to load history: ' + result.error, 'error');
            showError('history-result', result.error);
        }
    } catch (err) {
        document.getElementById('history-loading').style.display = 'none';
        logActivity('Error: ' + err.message, 'error');
        showError('history-result', err.message);
    }
}

function showHistory(history) {
    const el = document.getElementById('history-result');
    if (!history.length) {
        el.innerHTML = '<div class="result-card warning">No transactions found.</div>';
        return;
    }
    el.innerHTML = history.map(tx => `
        <div class="transaction-item">
            <div><b>Transaction ID:</b> ${tx.transactionId}</div>
            <div><b>Bill Number:</b> ${tx.paymentData.billNumber}</div>
            <div><b>Amount:</b> ${tx.paymentData.amount} ${tx.paymentData.currency}</div>
            <div><b>Status:</b> <span class="status-indicator status-${(tx.status || 'pending').toLowerCase()}">${tx.status || 'PENDING'}</span></div>
            <div><b>Created:</b> ${tx.createdAt}</div>
        </div>
    `).join('');
}

// Initial load
loadTransactions();

// Debug function to test QR generation
async function debugTest() {
    console.log('Debug test started');
    logActivity('Debug test started - checking API connection...', 'warning');
    
    const testData = {
        amount: 1.00,
        currency: 'USD',
        description: 'Debug Test Payment',
        storeLabel: 'Debug Store',
        billNumber: 'DEBUG_' + Date.now(),
        terminalLabel: 'Debug Terminal',
        isStatic: false
    };

    try {
        console.log('Sending test request:', testData);
        logActivity('Sending test API request...', 'warning');
        
        const response = await fetch(`${API_BASE}/payments/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });
        
        console.log('Response status:', response.status);
        logActivity(`API Response Status: ${response.status}`, response.ok ? 'success' : 'error');
        
        const result = await response.json();
        console.log('Response data:', result);
        
        if (result.success) {
            logActivity('Debug test successful - QR generated!', 'success');
            showQRResult(result.data);
        } else {
            logActivity('Debug test failed: ' + result.error, 'error');
            showError('qr-result', result.error);
        }
    } catch (error) {
        console.error('Debug test error:', error);
        logActivity('Debug test error: ' + error.message, 'error');
        showError('qr-result', error.message);
    }
}

// Monitor Status Functions
async function checkMonitorStatus() {
    try {
        logActivity('Checking auto-monitor status...');
        const res = await fetch(`${API_BASE}/monitor/status`);
        const result = await res.json();
        
        if (result.success) {
            const status = result.data;
            logActivity(`Monitor Status: ${status.active ? 'ACTIVE' : 'INACTIVE'} | Users: ${status.userCount} | Total: ${status.totalPayments} | Completed: ${status.completedPayments} | Pending: ${status.pendingPayments}`, 'success');
            
            // Update monitor tab
            updateMonitorTab(status);
        } else {
            logActivity('Failed to get monitor status: ' + result.error, 'error');
        }
    } catch (err) {
        logActivity('Error checking monitor status: ' + err.message, 'error');
    }
}

async function forceCheckPayment(hash) {
    try {
        logActivity(`Force checking payment: ${hash}...`);
        const res = await fetch(`${API_BASE}/monitor/force-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash })
        });
        const result = await res.json();
        
        if (result.success) {
            logActivity('Force check completed successfully', 'success');
        } else {
            logActivity('Force check failed: ' + result.error, 'error');
        }
    } catch (err) {
        logActivity('Error in force check: ' + err.message, 'error');
    }
}

function updateMonitorTab(status) {
    const monitorResult = document.getElementById('monitor-result');
    monitorResult.innerHTML = `
        <div class="result-card ${status.active ? 'success' : 'warning'}">
            <h4>Auto-Payment Monitor Status</h4>
            <div><b>Status:</b> ${status.active ? '🟢 ACTIVE' : '🔴 INACTIVE'}</div>
            <div><b>Active Users:</b> ${status.userCount}</div>
            <div><b>Total Payments:</b> ${status.totalPayments}</div>
            <div><b>Completed Payments:</b> ${status.completedPayments}</div>
            <div><b>Pending Payments:</b> ${status.pendingPayments}</div>
            <div style="margin-top: 15px;">
                <button onclick="loadActiveUsers()" class="btn">View Active Users</button>
                <button onclick="forceCheckAllPayments()" class="btn" style="margin-left: 10px;">Force Check All</button>
            </div>
        </div>
    `;
}

async function loadActiveUsers() {
    try {
        logActivity('Loading active users...');
        const res = await fetch(`${API_BASE}/monitor/users`);
        const result = await res.json();
        
        if (result.success) {
            showActiveUsers(result.data);
            logActivity(`Loaded ${result.data.length} active users`, 'success');
        } else {
            logActivity('Failed to load active users: ' + result.error, 'error');
        }
    } catch (err) {
        logActivity('Error loading active users: ' + err.message, 'error');
    }
}

function showActiveUsers(users) {
    const monitorResult = document.getElementById('monitor-result');
    let html = `
        <div class="result-card">
            <h4>Active Users (${users.length})</h4>
    `;
    
    if (users.length === 0) {
        html += '<p>No active users currently being monitored.</p>';
    } else {
        users.forEach(user => {
            html += `
                <div style="border: 1px solid #ddd; margin: 10px 0; padding: 10px; border-radius: 5px;">
                    <div><b>User ID:</b> ${user.userId}</div>
                    <div><b>Payments:</b> ${user.payments.length}</div>
                    <div><b>Total Amount:</b> ${user.totalAmount} (Paid: ${user.paidAmount})</div>
                    <div style="margin-top: 5px;">
                        ${user.payments.map(p => `
                            <small style="display: block;">
                                ${p.hash.substring(0, 8)}... - ${p.amount} ${p.status === 'PAID' ? '✅' : '⏳'}
                            </small>
                        `).join('')}
                    </div>
                </div>
            `;
        });
    }
    
    html += '</div>';
    monitorResult.innerHTML = html;
}

async function forceCheckAllPayments() {
    try {
        logActivity('Force checking all payments...');
        const res = await fetch(`${API_BASE}/monitor/force-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const result = await res.json();
        
        if (result.success) {
            logActivity(`Force check completed for ${result.data.length} payments`, 'success');
        } else {
            logActivity('Force check all failed: ' + result.error, 'error');
        }
    } catch (err) {
        logActivity('Error in force check all: ' + err.message, 'error');
    }
}
