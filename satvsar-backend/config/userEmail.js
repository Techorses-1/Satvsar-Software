// config/userEmail.js - FIXED TIMELINE ICON CENTERING
const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Company Details
const COMPANY = {
    parent: "Elements Corporation",
    brand: "Satvsar",
    address: "G.F - 39, Infinity Arcade, Near Pratapnagar Bridge, ONGC Road, Pratapnagar, Vadodara-390004. Gujarat (India)",
    gst: "24BNYPD2078K2ZI",
    phone: "+91 92747 78081",
    email: "info@satvsar.com",
    website: "https://satvsar.com"
};

// Helper function to format currency
const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

// Helper function to format date
const formatDate = (dateString) => {
    if (!dateString) return 'Pending';
    return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Helper function to format date only
const formatDateOnly = (dateString) => {
    if (!dateString) return 'Pending';
    return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

// Email templates for orders
const orderEmailTemplates = {
    // Order Confirmation Email for User
    orderConfirmation: (email, orderData) => ({
        from: `"${COMPANY.brand}" <${COMPANY.email}>`,
        to: email,
        subject: `Order Confirmed! 🎉 - Order #${orderData.orderNumber}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Order Confirmed - ${COMPANY.brand}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333333;
                        background-color: #f5f0e8;
                        margin: 0;
                        padding: 20px;
                    }
                    .email-wrapper {
                        max-width: 700px;
                        width: 100%;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 24px;
                        overflow: hidden;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
                    }
                    .header {
                        background: linear-gradient(135deg, #4e221c 0%, #6b2e24 100%);
                        padding: 32px 40px;
                        text-align: center;
                    }
                    .header h1 {
                        color: #c98b30;
                        margin: 0;
                        font-size: 32px;
                        font-weight: 700;
                    }
                    .header p {
                        color: #f0e6d2;
                        margin: 8px 0 0;
                        font-size: 14px;
                    }
                    .body {
                        padding: 40px;
                    }
                    .greeting {
                        font-size: 18px;
                        color: #4e221c;
                        margin-bottom: 20px;
                        font-weight: 600;
                    }
                    .order-card {
                        background: #fefcf2;
                        border-radius: 16px;
                        padding: 20px;
                        margin: 20px 0;
                        border: 1px solid #ede8df;
                    }
                    .order-info-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px 0;
                        border-bottom: 1px solid #ede8df;
                    }
                    .order-info-row:last-child {
                        border-bottom: none;
                    }
                    .order-info-label {
                        font-weight: 600;
                        color: #6b5535;
                    }
                    .order-info-value {
                        color: #4e221c;
                        font-weight: 500;
                    }
                    .status-badge {
                        display: inline-block;
                        background: #c98b30;
                        color: white;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: 700;
                        color: #4e221c;
                        margin: 30px 0 15px 0;
                        padding-bottom: 8px;
                        border-bottom: 2px solid #c98b30;
                        display: inline-block;
                    }
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        background: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        border: 1px solid #ede8df;
                    }
                    .items-table th {
                        background: #f5f0e8;
                        padding: 12px 15px;
                        text-align: left;
                        font-weight: 600;
                        color: #4e221c;
                        font-size: 13px;
                    }
                    .items-table td {
                        padding: 15px;
                        border-bottom: 1px solid #ede8df;
                        vertical-align: top;
                    }
                    .items-table tr:last-child td {
                        border-bottom: none;
                    }
                    .product-name {
                        font-weight: 600;
                        color: #4e221c;
                        margin-bottom: 5px;
                    }
                    .product-meta {
                        font-size: 12px;
                        color: #a08060;
                    }
                    .offer-badge {
                        display: inline-block;
                        background: #c98b30;
                        color: white;
                        font-size: 10px;
                        padding: 2px 8px;
                        border-radius: 12px;
                        margin-left: 8px;
                    }
                    .summary-box {
                        background: #fefcf2;
                        border-radius: 12px;
                        padding: 20px;
                        margin: 20px 0;
                        border: 1px solid #ede8df;
                    }
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px 0;
                        color: #6b5535;
                    }
                    .summary-row.total {
                        border-top: 2px solid #c98b30;
                        margin-top: 10px;
                        padding-top: 15px;
                        font-weight: 700;
                        font-size: 18px;
                        color: #4e221c;
                    }
                    .delivery-box {
                        background: #ffffff;
                        border: 1px solid #ede8df;
                        border-radius: 12px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .delivery-box h4 {
                        color: #4e221c;
                        margin-bottom: 12px;
                        font-size: 16px;
                        font-weight: 700;
                    }
                    .delivery-address {
                        color: #6b5535;
                        line-height: 1.5;
                    }
                    .thank-you-box {
                        background: #e8e0d5;
                        border-radius: 12px;
                        padding: 25px;
                        margin: 30px 0 20px;
                        text-align: center;
                    }
                    .thank-you-box p {
                        font-style: italic;
                        color: #4e221c;
                        font-size: 16px;
                    }
                    .footer {
                        background: #fefcf2;
                        padding: 30px 40px;
                        text-align: center;
                        font-size: 12px;
                        color: #a08060;
                        border-top: 1px solid #ede8df;
                    }
                    .brand {
                        color: #c98b30;
                        font-weight: 700;
                    }
                    @media only screen and (max-width: 600px) {
                        .body {
                            padding: 25px;
                        }
                        .order-info-row {
                            flex-direction: column;
                            gap: 5px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <div class="header">
                        <h1>🪔 ${COMPANY.brand}</h1>
                        <p>Pure oil from our kitchen to yours</p>
                    </div>
                    
                    <div class="body">
                        <div class="greeting">
                            Dear <strong>${orderData.customerName}</strong>,
                        </div>
                        
                        <p style="margin-bottom: 15px;">Thank you for shopping with <span class="brand">${COMPANY.brand}</span>! Your order has been confirmed and is being processed.</p>
                        
                        <div class="order-card">
                            <div class="order-info-row">
                                <span class="order-info-label">Order Number:</span>
                                <span class="order-info-value"><strong>#${orderData.orderNumber}</strong></span>
                            </div>
                            <div class="order-info-row">
                                <span class="order-info-label">Order Date:</span>
                                <span class="order-info-value">${formatDate(orderData.orderDate)}</span>
                            </div>
                            <div class="order-info-row">
                                <span class="order-info-label">Order Status:</span>
                                <span class="order-info-value"><span class="status-badge">${orderData.orderStatus.toUpperCase()}</span></span>
                            </div>
                        </div>
                        
                        <div class="section-title">📋 Order Items</div>
                        
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th style="text-align: center; width: 80px;">Qty</th>
                                    <th style="text-align: right; width: 100px;">Price</th>
                                    <th style="text-align: right; width: 100px;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orderData.items.map(item => `
                                    <tr>
                                        <td>
                                            <div class="product-name">${item.productName}</div>
                                            <div class="product-meta">
                                                ${item.colorName ? `${item.colorName}` : ''}
                                                ${item.modelName && item.modelName !== 'Default' ? ` • ${item.modelName}` : ''}
                                                ${item.size ? ` • Size: ${item.size}` : ''}
                                                ${item.hasExtraOffer ? '<span class="offer-badge">🎉 Special Offer</span>' : ''}
                                            </div>
                                        </td>
                                        <td style="text-align: center;">${item.quantity}</td>
                                        <td style="text-align: right;">${formatCurrency(item.price)}</td>
                                        <td style="text-align: right; font-weight: 600;">${formatCurrency(item.total)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="summary-box">
                            <div class="summary-row">
                                <span>Subtotal</span>
                                <span>${formatCurrency(orderData.subtotal)}</span>
                            </div>
                            ${orderData.totalDiscount > 0 ? `
                            <div class="summary-row">
                                <span>Discount</span>
                                <span style="color: #c98b30;">-${formatCurrency(orderData.totalDiscount)}</span>
                            </div>
                            ` : ''}
                            <div class="summary-row">
                                <span>Shipping</span>
                                <span><strong>FREE</strong></span>
                            </div>
                            <div class="summary-row">
                                <span>Tax (GST ${orderData.taxRate || 5}%)</span>
                                <span>${formatCurrency(orderData.tax)}</span>
                            </div>
                            <div class="summary-row total">
                                <span>Total Amount</span>
                                <span>${formatCurrency(orderData.total)}</span>
                            </div>
                        </div>
                        
                        <div class="delivery-box">
                            <h4>📦 Delivery Address</h4>
                            <div class="delivery-address">
                                <strong>${orderData.deliveryAddress.fullName}</strong><br>
                                ${orderData.deliveryAddress.addressLine1}${orderData.deliveryAddress.addressLine2 ? ', ' + orderData.deliveryAddress.addressLine2 : ''}<br>
                                ${orderData.deliveryAddress.city}, ${orderData.deliveryAddress.state} - ${orderData.deliveryAddress.pincode}<br>
                                📞 ${orderData.deliveryAddress.mobile}
                            </div>
                        </div>
                        
                        <div class="thank-you-box">
                            <p>🪔 "Quality oil, healthy life - that's our promise to you."</p>
                        </div>
                        
                        <p style="margin-top: 20px; font-size: 13px; text-align: center; color: #a08060;">
                            We'll notify you when your order is shipped. Estimated delivery: ${formatDateOnly(orderData.estimatedDelivery)}
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>© 2025 ${COMPANY.brand} | ${COMPANY.parent}</p>
                        <p>${COMPANY.address}</p>
                        <p>📞 ${COMPANY.phone} | ✉️ ${COMPANY.email}</p>
                        <p style="margin-top: 15px;">This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    // Admin New Order Notification
    adminNewOrderNotification: (adminEmail, orderData) => ({
        from: `"${COMPANY.brand} Orders" <${COMPANY.email}>`,
        to: adminEmail,
        subject: `🔔 NEW ORDER ALERT - Order #${orderData.orderNumber}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Order Alert - ${COMPANY.brand}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
                        line-height: 1.6;
                        background-color: #f5f0e8;
                        margin: 0;
                        padding: 20px;
                    }
                    .email-wrapper {
                        max-width: 700px;
                        width: 100%;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 24px;
                        overflow: hidden;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
                    }
                    .header {
                        background: linear-gradient(135deg, #4e221c 0%, #6b2e24 100%);
                        padding: 32px 40px;
                        text-align: center;
                    }
                    .header h1 {
                        color: #c98b30;
                        margin: 0;
                        font-size: 28px;
                    }
                    .alert-badge {
                        background: #c98b30;
                        color: white;
                        display: inline-block;
                        padding: 6px 20px;
                        border-radius: 30px;
                        font-size: 14px;
                        font-weight: bold;
                        margin-top: 15px;
                    }
                    .body {
                        padding: 40px;
                    }
                    .order-card {
                        background: #fefcf2;
                        border-radius: 16px;
                        padding: 20px;
                        margin: 20px 0;
                        border: 1px solid #ede8df;
                    }
                    .order-info-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px 0;
                        border-bottom: 1px solid #ede8df;
                    }
                    .order-info-row:last-child {
                        border-bottom: none;
                    }
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        border: 1px solid #ede8df;
                    }
                    .items-table th {
                        background: #f5f0e8;
                        padding: 10px;
                        text-align: left;
                    }
                    .items-table td {
                        padding: 10px;
                        border-bottom: 1px solid #ede8df;
                    }
                    .summary-box {
                        background: #fefcf2;
                        padding: 20px;
                        margin: 20px 0;
                        border: 1px solid #ede8df;
                        border-radius: 12px;
                    }
                    .summary-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                    }
                    .delivery-box {
                        background: #ffffff;
                        border: 1px solid #ede8df;
                        border-radius: 12px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .action-button {
                        display: inline-block;
                        background: #c98b30;
                        color: white;
                        padding: 12px 24px;
                        text-decoration: none;
                        border-radius: 8px;
                        margin-top: 20px;
                        font-weight: 600;
                    }
                    .footer {
                        background: #fefcf2;
                        padding: 30px;
                        text-align: center;
                        font-size: 12px;
                        color: #a08060;
                        border-top: 1px solid #ede8df;
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <div class="header">
                        <h1>🪔 ${COMPANY.brand}</h1>
                        <div class="alert-badge">🔔 NEW ORDER RECEIVED</div>
                    </div>
                    
                    <div class="body">
                        <p>A new order has been placed on your store. Please review the details below:</p>
                        
                        <div class="order-card">
                            <div class="order-info-row">
                                <span><strong>Order Number:</strong></span>
                                <span>#${orderData.orderNumber}</span>
                            </div>
                            <div class="order-info-row">
                                <span><strong>Order Date:</strong></span>
                                <span>${formatDate(orderData.orderDate)}</span>
                            </div>
                            <div class="order-info-row">
                                <span><strong>Customer:</strong></span>
                                <span>${orderData.customerName}</span>
                            </div>
                            <div class="order-info-row">
                                <span><strong>Contact:</strong></span>
                                <span>${orderData.customerMobile}</span>
                            </div>
                            <div class="order-info-row">
                                <span><strong>Payment:</strong></span>
                                <span>${orderData.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</span>
                            </div>
                        </div>
                        
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th style="text-align: center;">Qty</th>
                                    <th style="text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orderData.items.map(item => `
                                    <tr>
                                        <td>${item.productName}</td>
                                        <td style="text-align: center;">${item.quantity}</td>
                                        <td style="text-align: right;">${formatCurrency(item.total)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <div class="summary-box">
                            <div class="summary-row">
                                <span>Subtotal:</span>
                                <span>${formatCurrency(orderData.subtotal)}</span>
                            </div>
                            <div class="summary-row">
                                <span>Discount:</span>
                                <span>${formatCurrency(orderData.totalDiscount)}</span>
                            </div>
                            <div class="summary-row">
                                <span>Tax:</span>
                                <span>${formatCurrency(orderData.tax)}</span>
                            </div>
                            <div class="summary-row" style="font-size: 18px; font-weight: bold; border-top: 2px solid #c98b30; margin-top: 10px; padding-top: 10px;">
                                <span>TOTAL:</span>
                                <span>${formatCurrency(orderData.total)}</span>
                            </div>
                        </div>
                        
                        <div class="delivery-box">
                            <h4>📦 Delivery Address</h4>
                            <p>${orderData.deliveryAddress.fullName}<br>
                            ${orderData.deliveryAddress.addressLine1}${orderData.deliveryAddress.addressLine2 ? ', ' + orderData.deliveryAddress.addressLine2 : ''}<br>
                            ${orderData.deliveryAddress.city}, ${orderData.deliveryAddress.state} - ${orderData.deliveryAddress.pincode}<br>
                            📞 ${orderData.deliveryAddress.mobile}</p>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${process.env.ADMIN_URL || 'https://admin.satvsar.com'}/orders/${orderData.orderNumber}" class="action-button">View Order Details →</a>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>${COMPANY.brand} | ${COMPANY.parent}</p>
                        <p>${COMPANY.address}</p>
                        <p>📞 ${COMPANY.phone} | ✉️ ${COMPANY.email}</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    // Order Status Update Email for User (FIXED TIMELINE ICON CENTERING)
    orderStatusUpdate: (email, orderData) => ({
        from: `"${COMPANY.brand}" <${COMPANY.email}>`,
        to: email,
        subject: `Order Update - #${orderData.orderNumber} is ${orderData.newStatus.toUpperCase()} 🚚`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Order Status Update - ${COMPANY.brand}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
                        line-height: 1.6;
                        background-color: #f5f0e8;
                        margin: 0;
                        padding: 20px;
                    }
                    .email-wrapper {
                        max-width: 700px;
                        width: 100%;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 24px;
                        overflow: hidden;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
                    }
                    .header {
                        background: linear-gradient(135deg, #4e221c 0%, #6b2e24 100%);
                        padding: 32px 40px;
                        text-align: center;
                    }
                    .header h1 {
                        color: #c98b30;
                        margin: 0;
                        font-size: 28px;
                    }
                    .body {
                        padding: 40px;
                    }
                    .greeting {
                        font-size: 18px;
                        color: #4e221c;
                        margin-bottom: 20px;
                        font-weight: 600;
                    }
                    .status-card {
                        text-align: center;
                        padding: 30px;
                        margin: 20px 0;
                        border-radius: 16px;
                        background: ${orderData.newStatus === 'delivered' ? '#e8f5e9' :
                orderData.newStatus === 'cancelled' ? '#ffebee' :
                    '#fff3e0'};
                    }
                    .status-icon {
                        font-size: 56px;
                        margin-bottom: 15px;
                        display: inline-block;
                    }
                    .status-badge-large {
                        display: inline-block;
                        background: ${orderData.newStatus === 'delivered' ? '#2e7d32' :
                orderData.newStatus === 'cancelled' ? '#c62828' :
                    '#c98b30'};
                        color: white;
                        padding: 10px 28px;
                        border-radius: 40px;
                        font-size: 18px;
                        font-weight: bold;
                        margin: 10px 0;
                    }
                    .order-card {
                        background: #fefcf2;
                        border-radius: 12px;
                        padding: 20px;
                        margin: 20px 0;
                        border: 1px solid #ede8df;
                    }
                    .order-info-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                    }
                    .timeline-container {
                        margin: 30px 0;
                        padding: 0 20px;
                    }
                    .timeline-step {
                        display: flex;
                        align-items: center;
                        margin-bottom: 25px;
                        position: relative;
                    }
                    .timeline-icon {
                        width: 48px;
                        height: 48px;
                        min-width: 48px;
                        border-radius: 50%;
                        background: #f5f0e8;
                        display: inline-block;
                        line-height: 48px;
                        text-align: center;
                        margin-right: 18px;
                        font-size: 22px;
                        position: relative;
                        z-index: 2;
                    }
                    .timeline-icon.completed {
                        background: #c98b30;
                        color: white;
                    }
                    .timeline-icon.current {
                        background: #c98b30;
                        color: white;
                        box-shadow: 0 0 0 4px rgba(201, 139, 48, 0.2);
                    }
                    .timeline-icon.pending {
                        background: #e8e0d5;
                        color: #a08060;
                    }
                    .timeline-content {
                        flex: 1;
                    }
                    .timeline-title {
                        font-weight: 700;
                        color: #4e221c;
                        font-size: 16px;
                        margin-bottom: 4px;
                    }
                    .timeline-date {
                        font-size: 12px;
                        color: #a08060;
                    }
                    .timeline-step:not(:last-child)::before {
                        content: '';
                        position: absolute;
                        left: 23px;
                        top: 48px;
                        bottom: -25px;
                        width: 2px;
                        background: #ede8df;
                        z-index: 1;
                    }
                    .footer {
                        background: #fefcf2;
                        padding: 30px;
                        text-align: center;
                        font-size: 12px;
                        color: #a08060;
                        border-top: 1px solid #ede8df;
                    }
                    .brand {
                        color: #c98b30;
                        font-weight: bold;
                    }
                    @media only screen and (max-width: 600px) {
                        .body {
                            padding: 25px;
                        }
                        .timeline-container {
                            padding: 0;
                        }
                        .timeline-icon {
                            width: 44px;
                            height: 44px;
                            min-width: 44px;
                            line-height: 44px;
                            font-size: 20px;
                        }
                        .timeline-step:not(:last-child)::before {
                            left: 21px;
                            top: 44px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <div class="header">
                        <h1>🪔 ${COMPANY.brand}</h1>
                    </div>
                    
                    <div class="body">
                        <div class="greeting">
                            Dear <strong>${orderData.customerName}</strong>,
                        </div>
                        
                        <div class="status-card">
                            <div class="status-icon">
                                ${orderData.newStatus === 'delivered' ? '📦✅' :
                orderData.newStatus === 'shipped' ? '🚚' :
                    orderData.newStatus === 'processing' ? '⚙️' :
                        orderData.newStatus === 'cancelled' ? '❌' : '🔄'}
                            </div>
                            <div class="status-badge-large">
                                ${orderData.newStatus.toUpperCase()}
                            </div>
                            <p style="margin: 12px 0 0; color: #6b5535;">
                                ${orderData.statusMessage}
                            </p>
                        </div>
                        
                        <div class="order-card">
                            <div class="order-info-row">
                                <span><strong>Order Number:</strong></span>
                                <span>#${orderData.orderNumber}</span>
                            </div>
                            <div class="order-info-row">
                                <span><strong>Order Date:</strong></span>
                                <span>${formatDateOnly(orderData.orderDate)}</span>
                            </div>
                            <div class="order-info-row">
                                <span><strong>Total Amount:</strong></span>
                                <span>${formatCurrency(orderData.total)}</span>
                            </div>
                        </div>
                        
                        <div class="timeline-container">
                            <div class="timeline-step">
                                <div class="timeline-icon ${orderData.timelineSteps[0]?.status || 'completed'}">
                                    📦
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title">Order Placed</div>
                                    <div class="timeline-date">${orderData.timelineSteps[0]?.date || formatDateOnly(orderData.orderDate)}</div>
                                </div>
                            </div>
                            <div class="timeline-step">
                                <div class="timeline-icon ${orderData.timelineSteps[1]?.status || 'pending'}">
                                    ⚙️
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title">Processing</div>
                                    <div class="timeline-date">${orderData.timelineSteps[1]?.date || 'Pending'}</div>
                                </div>
                            </div>
                            <div class="timeline-step">
                                <div class="timeline-icon ${orderData.timelineSteps[2]?.status || 'pending'}">
                                    🚚
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title">Shipped</div>
                                    <div class="timeline-date">${orderData.timelineSteps[2]?.date || 'Pending'}</div>
                                </div>
                            </div>
                            <div class="timeline-step">
                                <div class="timeline-icon ${orderData.timelineSteps[3]?.status || 'pending'}">
                                    ✅
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title">Delivered</div>
                                    <div class="timeline-date">${orderData.timelineSteps[3]?.date || 'Pending'}</div>
                                </div>
                            </div>
                        </div>
                        
                        ${orderData.newStatus === 'cancelled' ? `
                            <div style="background: #ffebee; padding: 20px; border-radius: 12px; margin: 20px 0;">
                                <p style="margin: 0; color: #c62828;"><strong>Note:</strong> If you have any questions about this cancellation, please contact our support team at ${COMPANY.email}</p>
                            </div>
                        ` : `
                            <div style="background: #e8e0d5; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                                <p style="margin: 0; font-style: italic; color: #4e221c;">Thank you for choosing ${COMPANY.brand}! We value your trust in us.</p>
                            </div>
                        `}
                    </div>
                    
                    <div class="footer">
                        <p>© 2025 ${COMPANY.brand} | ${COMPANY.parent}</p>
                        <p>📞 ${COMPANY.phone} | ✉️ ${COMPANY.email}</p>
                        <p style="margin-top: 10px;">Need help? Contact our support team anytime.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    })
};



const sendOrderEmailWithAttachment = async (type, email, orderData, pdfBuffer) => {
    try {
        const template = orderEmailTemplates[type];
        if (!template) {
            throw new Error(`Email template not found for type: ${type}`);
        }

        const mailOptions = template(email, orderData);

        // Add attachment if PDF buffer is provided
        if (pdfBuffer) {
            mailOptions.attachments = [{
                filename: `Invoice_${orderData.orderNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }];
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Order email sent: ${type} to ${email} - MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Order email sending error:', error.message);
        return { success: false, error: error.message };
    }
};

// Function to send order email
const sendOrderEmail = async (type, email, orderData) => {
    try {
        const template = orderEmailTemplates[type];
        if (!template) {
            throw new Error(`Email template not found for type: ${type}`);
        }

        const mailOptions = template(email, orderData);
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Order email sent: ${type} to ${email} - MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Order email sending error:', error.message);
        return { success: false, error: error.message };
    }
};





module.exports = { sendOrderEmail, sendOrderEmailWithAttachment, COMPANY };
