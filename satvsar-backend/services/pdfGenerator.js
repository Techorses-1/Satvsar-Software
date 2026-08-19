const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Helper function to format currency
const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`;
};

// Helper function to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
};

// Helper function to format full address
const formatFullAddress = (address) => {
    if (!address) return '';
    const parts = [];
    if (address.addressLine1) parts.push(address.addressLine1);
    if (address.addressLine2) parts.push(address.addressLine2);
    if (address.landmark) parts.push(`Landmark: ${address.landmark}`);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    if (address.country) parts.push(address.country);
    return parts.join(', ');
};

// Helper function to convert number to words
const numberToWords = (num) => {
    if (num === 0) return 'Zero Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
        'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    let integerPart = Math.floor(num);
    let words = '';

    if (integerPart >= 10000000) {
        words += numberToWords(Math.floor(integerPart / 10000000)) + ' Crore ';
        integerPart %= 10000000;
    }

    if (integerPart >= 100000) {
        words += numberToWords(Math.floor(integerPart / 100000)) + ' Lakh ';
        integerPart %= 100000;
    }

    if (integerPart >= 1000) {
        words += numberToWords(Math.floor(integerPart / 1000)) + ' Thousand ';
        integerPart %= 1000;
    }

    if (integerPart >= 100) {
        words += numberToWords(Math.floor(integerPart / 100)) + ' Hundred ';
        integerPart %= 100;
    }

    if (integerPart > 0) {
        if (words !== '') words += ' ';

        if (integerPart < 20) {
            words += ones[integerPart];
        } else {
            words += tens[Math.floor(integerPart / 10)];
            if (integerPart % 10 > 0) {
                words += ' ' + ones[integerPart % 10];
            }
        }
    }

    const decimalPart = Math.round((num - Math.floor(num)) * 100);
    if (decimalPart > 0) {
        if (words !== '') words += ' and ';
        if (decimalPart < 20) {
            words += ones[decimalPart] + ' Paise';
        } else {
            words += tens[Math.floor(decimalPart / 10)];
            if (decimalPart % 10 > 0) {
                words += ' ' + ones[decimalPart % 10] + ' Paise';
            }
        }
    }

    return words;
};

// Calculate item discounted total
const calculateItemDiscountedTotal = (item) => {
    const quantity = item.quantity || 1;
    const price = item.price || 0;
    const discountPercentage = item.discount || 0;
    const itemTotal = price * quantity;
    const discountAmount = itemTotal * (discountPercentage / 100);
    return itemTotal - discountAmount;
};

// Get logo as base64
const getLogoBase64 = () => {
    try {
        const logoPath = path.join(process.cwd(), 'logo', 'logo.png');
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            return `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }
        return '';
    } catch (error) {
        console.error('Error loading logo:', error);
        return '';
    }
};

// Generate Invoice HTML
const generateInvoiceHTML = (order) => {
    const logoBase64 = getLogoBase64();
    const isOnlineOrder = order.orderType === 'online';
    const isOfflineOrder = order.orderType === 'offline';

    // Get payment method
    const paymentMethod = order.paymentType || order.payment?.method || 'cash';
    const getPaymentMethodText = () => {
        switch (paymentMethod) {
            case 'cash': return 'Through Cash';
            case 'card': return 'Through Card';
            case 'upi': return 'Through UPI';
            default: return 'Through Cash';
        }
    };

    // Terms and conditions
    const businessType = order.businessType || 'b2c';
    const termsAndConditions = businessType === "b2b" ? `
        Any Sort of Complaint for this Invoice should be Communicated within One Week.<br />
        Goods once sold will not be taken back.<br />
        Only manufacturing defects are eligible for replacement within 1 day of purchase. <br />
        Interest @ 18% p.a. will be charged if payment is not made within due date.<br />
        Cheque Should be Drawn in Favor of "Elements Corporation"<br />
        Subject to VADODARA Jurisdiction.<br />
        "E.&O.E"<br />
    ` : `
        Any Sort of Complaint for this Invoice should be Communicated within One Week.<br />
        Goods once sold will not be taken back.<br />
        Only manufacturing defects are eligible for replacement within 1 day of purchase. <br />
        Subject to VADODARA Jurisdiction.<br />
    `;

    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Invoice ${order.orderNumber}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: Arial, sans-serif;
                font-size: 12px;
                color: #333;
                background: #fff;
                padding: 20px;
            }
            .invoice-container {
                max-width: 210mm;
                margin: 0 auto;
                background: #fff;
            }
            .new-invoice-header {
                text-align: center;
                margin-bottom: 15px;
            }
            .tax-invoice-title h1 {
                margin: 0 0 8px 0;
                font-size: 24px;
                font-weight: bold;
                color: #000;
                text-transform: uppercase;
            }
            .title-line {
                width: 90%;
                height: 2px;
                background: #000;
                margin: 0 auto 15px auto;
            }
            .satvsar-logo img {
                max-width: 120px;
                height: auto;
                display: block;
                margin: 0 auto;
            }
            .addresses-section {
                display: flex;
                justify-content: space-between;
                gap: 15px;
                margin: 20px 0;
            }
            .from-address, .bill-to-address, .ship-to-address {
                flex: 1;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
            }
            .section-title {
                font-weight: bold;
                font-size: 12px;
                margin-bottom: 10px;
                padding-bottom: 5px;
                border-bottom: 1px solid #eee;
            }
            .company-details p, .billing-details p, .shipping-details p {
                margin: 4px 0;
                font-size: 11px;
                line-height: 1.4;
            }
            .invoice-info-section {
                margin-bottom: 15px;
            }
            .invoice-number-info {
                text-align: right;
            }
            .invoice-number-info p {
                margin: 3px 0;
                font-size: 12px;
            }
            .items-section {
                margin: 15px 0;
            }
            .items-section h3 {
                margin: 0 0 10px 0;
                font-size: 14px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
            }
            .items-table th, .items-table td {
                border: 1px solid #ddd;
                padding: 8px 6px;
                font-size: 11px;
                word-wrap: break-word;
            }
            .items-table th {
                background: #f5f5f5;
                font-weight: bold;
                text-align: center;
            }
            .items-table td {
                text-align: right;
            }
            .items-table td:nth-child(2), .items-table td:nth-child(3) {
                text-align: left;
            }
            .items-table th:nth-child(1), .items-table td:nth-child(1) {
                width: 6%;
            }
            .items-table th:nth-child(2), .items-table td:nth-child(2) {
                width: 36%;
            }
            .items-table th:nth-child(3), .items-table td:nth-child(3) {
                width: 12%;
            }
            .items-table th:nth-child(4), .items-table td:nth-child(4) {
                width: 7%;
            }
            .items-table th:nth-child(5), .items-table td:nth-child(5) {
                width: 13%;
            }
            .items-table th:nth-child(6), .items-table td:nth-child(6) {
                width: 8%;
            }
            .items-table th:nth-child(7), .items-table td:nth-child(7) {
                width: 18%;
            }
            .totals-section {
                display: flex;
                justify-content: flex-end;
                margin: 15px 0;
            }
            .amount-details {
                width: 280px;
            }
            .amount-details table {
                width: 100%;
                border-collapse: collapse;
            }
            .amount-details td {
                padding: 5px 6px;
                text-align: right;
            }
            .amount-details td:first-child {
                text-align: left;
                font-weight: bold;
            }
            .grand-total td {
                font-size: 14px;
                font-weight: bold;
                border-top: 2px solid #333;
                padding-top: 8px;
            }
            .amount-in-words {
                margin: 15px 0;
                padding: 8px;
                background: #f9f9f9;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            .amount-in-words p {
                margin: 0;
                font-size: 11px;
                font-style: italic;
            }
            .payment-method-section {
                margin: 15px 0;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            .declaration-terms-section {
                margin: 15px 0;
            }
            .terms-section h3 {
                margin: 0 0 10px 0;
                font-size: 12px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
            }
            .terms-section p {
                margin: 0 0 5px 0;
                font-size: 10px;
                line-height: 1.4;
            }
            .invoice-footer {
                display: flex;
                justify-content: space-between;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
            }
            .thank-you p, .signature p {
                margin: 0;
                font-size: 11px;
            }
            .signature {
                text-align: right;
            }
            .signature-line {
                width: 150px;
                height: 1px;
                background: #333;
                margin: 8px auto 0 auto;
            }
            @media print {
                body {
                    padding: 0;
                    margin: 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <!-- Header -->
            <div class="new-invoice-header">
                <div class="tax-invoice-title">
                    <h1>TAX INVOICE</h1>
                    <div class="title-line"></div>
                </div>
                <div class="satvsar-logo">
                    ${logoBase64 ? `<img src="${logoBase64}" alt="Satvsar Logo" />` : '<div style="height: 60px;"></div>'}
                </div>
            </div>
            
            <!-- Addresses Section -->
            <div class="addresses-section">
                <div class="from-address">
                    <div class="section-title">From</div>
                    <div class="company-details">
                        <p><strong>Elements Corporation</strong></p>
                        <p>G.F 39, Infinity Arcade, Nr Pratapnagar</p>
                        <p>Bridge ONGC Road, Pratapnagar</p>
                        <p>Vadodara - 340004</p>
                        <p>GST: 24BNYPD2078K2ZI</p>
                        <p>+91 1234567890</p>
                    </div>
                </div>
                
                <!-- ========== BILL TO - CUSTOMER ACCOUNT DETAILS ========== -->
                <div class="bill-to-address">
                    <div class="section-title">Bill to</div>
                    <div class="billing-details">
                        <p><strong>${order.customer?.name || 'N/A'}</strong></p>
                        ${order.customer?.gstNumber ? `<p>GST: ${order.customer.gstNumber}</p>` : ''}
                        ${order.customer?.mobile ? `<p>Mobile: ${order.customer.mobile}</p>` : ''}
                        ${order.customer?.email ? `<p>Email: ${order.customer.email}</p>` : ''}
                        ${!isOnlineOrder && order.customer?.address ? `<p>Address: ${order.customer.address}</p>` : ''}
                    </div>
                </div>
                
                <!-- ========== SHIP TO - DELIVERY ADDRESS ========== -->
                <div class="ship-to-address">
                    <div class="section-title">Ship to</div>
                    <div class="shipping-details">
                        ${isOnlineOrder && order.deliveryAddress ? `
                            <p><strong>${order.deliveryAddress.fullName || 'N/A'}</strong></p>
                            ${order.deliveryAddress.mobile ? `<p>Mobile: ${order.deliveryAddress.mobile}</p>` : ''}
                            ${order.deliveryAddress.email ? `<p>Email: ${order.deliveryAddress.email}</p>` : ''}
                            <p>${formatFullAddress(order.deliveryAddress)}</p>
                        ` : order.shippingDetails ? `
                            <p><strong>${order.shippingDetails.name || 'N/A'}</strong></p>
                            ${order.shippingDetails.gstNumber ? `<p>GST: ${order.shippingDetails.gstNumber}</p>` : ''}
                            ${order.shippingDetails.mobile ? `<p>Mobile: ${order.shippingDetails.mobile}</p>` : ''}
                            ${order.shippingDetails.email ? `<p>Email: ${order.shippingDetails.email}</p>` : ''}
                            ${order.shippingDetails.address ? `<p>Address: ${order.shippingDetails.address}</p>` : ''}
                        ` : `
                            <p><strong>${order.customer?.name || 'N/A'}</strong></p>
                            ${order.customer?.gstNumber ? `<p>GST: ${order.customer.gstNumber}</p>` : ''}
                            ${order.customer?.mobile ? `<p>Mobile: ${order.customer.mobile}</p>` : ''}
                            ${order.customer?.email ? `<p>Email: ${order.customer.email}</p>` : ''}
                            ${order.customer?.address ? `<p>Address: ${order.customer.address}</p>` : ''}
                        `}
                    </div>
                </div>
            </div>
            
            <!-- Invoice Info -->
            <div class="invoice-info-section">
                <div class="invoice-number-info">
                    <p><strong>Invoice No:</strong> ${order.orderNumber || 'N/A'}</p>
                    <p><strong>Date:</strong> ${formatDate(order.date)}</p>
                </div>
            </div>
            
            <!-- Items Table -->
            <div class="items-section">
                <h3>Items Details</h3>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Sr No</th>
                            <th>Product Name</th>
                            <th>Item Code</th>
                            <th>Qty</th>
                            <th>Price (Incl. Tax)</th>
                            <th>Disc %</th>
                            <th>Total Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items && order.items.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.productName || item.name || 'N/A'}</td>
                                <td>${item.hsn || item.hsnCode || 'N/A'}</td>
                                <td>${item.quantity || 1}</td>
                                <td>${formatCurrency(item.price)}</td>
                                <td>${item.discount || 0}%</td>
                                <td>${formatCurrency(calculateItemDiscountedTotal(item))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- Totals Section -->
<div class="totals-section">
    <div class="amount-details">
        <table>
            <tbody>
                <tr>
                    <td>Subtotal (Incl. Tax):</td>
                    <td>${formatCurrency(order.subtotal)}</td>
                </tr>
                <tr>
                    <td>Discount:</td>
                    <td>${formatCurrency(order.discount)}</td>
                </tr>
                ${order.promoDiscount > 0 ? `
                <tr>
                    <td>Promo Discount:</td>
                    <td>${formatCurrency(order.promoDiscount)}</td>
                </tr>
                ` : ''}
                ${order.loyaltyDiscount > 0 ? `
                <tr>
                    <td>Loyalty Coins Discount:</td>
                    <td>${formatCurrency(order.loyaltyDiscount)}</td>
                </tr>
                ` : ''}
                ${!order.hasMixedTaxRates && order.cgst > 0 && order.sgst > 0 ? `
                <tr>
                    <td>CGST (${order.taxPercentages && order.taxPercentages[0] ? order.taxPercentages[0] / 2 : 9}%):</td>
                    <td>${formatCurrency(order.cgst)}</td>
                </tr>
                <tr>
                    <td>SGST (${order.taxPercentages && order.taxPercentages[0] ? order.taxPercentages[0] / 2 : 9}%):</td>
                    <td>${formatCurrency(order.sgst)}</td>
                </tr>
                ` : ''}
                ${order.hasMixedTaxRates && order.tax > 0 ? `
                <tr>
                    <td>GST:</td>
                    <td>${formatCurrency(order.tax)}</td>
                </tr>
                ` : ''}
                <tr class="grand-total">
                    <td>Grand Total:</td>
                    <td>${formatCurrency(order.total)}</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
            
            <!-- Amount in Words -->
            <div class="amount-in-words">
                <p><strong>Amount in Words:</strong> ${numberToWords(order.total)} Only</p>
            </div>
            
            <!-- Payment Method -->
            <div class="payment-method-section">
                <p><strong>Payment Method:</strong> ${getPaymentMethodText()}</p>
            </div>
            
            <!-- Terms & Conditions -->
            <div class="declaration-terms-section">
                <div class="terms-section">
                    <h3>Terms & Conditions</h3>
                    <p>${termsAndConditions}</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="invoice-footer">
                <div class="thank-you">
                    <p>Thank you for your business!</p>
                </div>
                <div class="signature">
                    <p>Authorized Signature</p>
                    <div class="signature-line"></div>
                </div>
            </div>
        </div>
    </body>
    </html>`;
};

// Main function to generate PDF
const generateInvoicePDF = async (order) => {
    let browser = null;
    try {
        const html = generateInvoiceHTML(order);

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '10mm',
                right: '10mm'
            }
        });

        await browser.close();
        return pdf;

    } catch (error) {
        console.error('Error generating PDF:', error);
        if (browser) await browser.close();
        throw error;
    }
};

module.exports = { generateInvoicePDF };