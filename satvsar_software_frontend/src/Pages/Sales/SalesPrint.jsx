import React from "react";
import "./Salesprint.scss";
import logo from "../../Assets/logo/satvsar.png";

const SalesPrint = ({ invoice }) => {
  if (!invoice) return null;

  const {
    invoiceNumber,
    date,
    customer,
    shippingDetails,
    deliveryAddress,
    items,
    paymentType,
    subtotal,
    discount,
    cgst,
    sgst,
    tax,
    hasMixedTaxRates,
    total,
    promoDiscount,
    loyaltyDiscount,
    businessType = "b2c",
    orderType = "offline",
  } = invoice;

  // Format date to YYYY-MM-DD only
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return "N/A";
    return dateObj.toISOString().split('T')[0];
  };

  // Format full address into single line
  const formatFullAddress = (address) => {
    if (!address) return "";
    const parts = [];
    
    if (address.addressLine1) parts.push(address.addressLine1);
    if (address.addressLine2) parts.push(address.addressLine2);
    if (address.landmark) parts.push(`Landmark: ${address.landmark}`);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    if (address.country) parts.push(address.country);
    
    return parts.join(", ");
  };

  // Dynamic terms and conditions based on business type
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

  // Corrected function to convert numbers to words
  const numberToWords = (num) => {
    if (num === 0) return 'Zero Only';

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
      'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    // Handle integer part (rupees)
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

    // Handle decimal part (paise)
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

  // Calculate discounted total for each item
  const calculateItemDiscountedTotal = (item) => {
    const quantity = item.quantity || 1;
    const price = item.price || 0;
    const discountPercentage = item.discount || 0;

    const itemTotal = price * quantity;
    const discountAmount = itemTotal * (discountPercentage / 100);
    return itemTotal - discountAmount;
  };

  // Safe number formatting
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return "₹0.00";
    return `₹${Number(value).toFixed(2)}`;
  };

  // Safe number formatting without symbol
  const formatNumber = (value) => {
    if (value === undefined || value === null) return "0.00";
    return Number(value).toFixed(2);
  };

  // Get payment method text
  const getPaymentMethodText = () => {
    switch (paymentType) {
      case 'cash': return 'Through Cash';
      case 'card': return 'Through Card';
      case 'upi': return 'Through UPI';
      default: return 'Through Cash';
    }
  };

  return (
    <div id="sales-pdf" >
      <div className="invoice-container" >

        {/* New Header Design: TAX INVOICE centered with horizontal line */}
        <div className="new-invoice-header">
          <div className="tax-invoice-title">
            <h1>TAX INVOICE</h1>
            <div className="title-line"></div>
          </div>

          {/* SATVSAR Logo centered below the line */}
          <div className="satvsar-logo">
            <img src={logo} alt="Satvsar Logo" />
          </div>
        </div>

        {/* FROM / BILL TO / SHIP TO Section */}
        <div className="addresses-section">
          <div className="from-address">
            <div className="section-title">From</div>
            <div className="company-details">
              <p><strong>Elements Corporation</strong></p>
              <p>G.F 39, Infinity Arcade, Nr Pratapnagar</p>
              <p>Bridge ONGC Road, Pratapnagar</p>
              <p>Vadodara - 340004</p>
              <p>GST: 24BNYPD2078K2ZI</p>
              <p>+91 1234567890</p>
            </div>
          </div>

          <div className="bill-to-address">
            <div className="section-title">Bill to</div>
            <div className="billing-details">
              <p><strong>{customer?.name || "N/A"}</strong></p>
              {customer?.gstNumber && <p>GST: {customer.gstNumber}</p>}
              {customer?.mobile && <p>Mobile: {customer.mobile}</p>}
              {customer?.email && <p>Email: {customer.email}</p>}
              {customer?.address && <p>Address: {customer.address}</p>}
            </div>
          </div>

          {/* Ship To Section - UPDATED FOR ONLINE ORDERS */}
          <div className="ship-to-address">
            <div className="section-title">Ship to</div>
            <div className="shipping-details">
              {orderType === 'online' && deliveryAddress ? (
                // ONLINE ORDER - Show Delivery Address in single line
                <>
                  <p><strong>{deliveryAddress.fullName || "N/A"}</strong></p>
                  {deliveryAddress.mobile && <p>Mobile: {deliveryAddress.mobile}</p>}
                  {deliveryAddress.email && <p>Email: {deliveryAddress.email}</p>}
                  <p>{formatFullAddress(deliveryAddress)}</p>
                  {deliveryAddress.instructions && (
                    <p>Instructions: {deliveryAddress.instructions}</p>
                  )}
                </>
              ) : shippingDetails ? (
                // OFFLINE ORDER WITH SHIPPING DETAILS
                <>
                  <p><strong>{shippingDetails.name || "N/A"}</strong></p>
                  {shippingDetails.gstNumber && <p>GST: {shippingDetails.gstNumber}</p>}
                  {shippingDetails.mobile && <p>Mobile: {shippingDetails.mobile}</p>}
                  {shippingDetails.email && <p>Email: {shippingDetails.email}</p>}
                  {shippingDetails.address && <p>Address: {shippingDetails.address}</p>}
                  {shippingDetails.addressLine1 && (
                    <p>
                      {shippingDetails.addressLine1}
                      {shippingDetails.addressLine2 && `, ${shippingDetails.addressLine2}`}
                      {shippingDetails.landmark && `, Landmark: ${shippingDetails.landmark}`}
                      {shippingDetails.city && `, ${shippingDetails.city}`}
                      {shippingDetails.state && `, ${shippingDetails.state}`}
                      {shippingDetails.pincode && ` - ${shippingDetails.pincode}`}
                      {shippingDetails.country && `, ${shippingDetails.country}`}
                    </p>
                  )}
                </>
              ) : (
                // OFFLINE ORDER - SAME AS BILLING
                <>
                  <p><strong>{customer?.name || "N/A"}</strong></p>
                  {customer?.gstNumber && <p>GST: {customer.gstNumber}</p>}
                  {customer?.mobile && <p>Mobile: {customer.mobile}</p>}
                  {customer?.email && <p>Email: {customer.email}</p>}
                  {customer?.address && <p>Address: {customer.address}</p>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Number and Date Section - UPDATED DATE FORMAT */}
        <div className="invoice-info-section">
          <div className="invoice-number-info">
            <p><strong>Invoice No:</strong> {invoiceNumber || "N/A"}</p>
            <p><strong>Date:</strong> {formatDate(date)}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="items-section">
          <h3>Items Details</h3>
          <table className="items-table">
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
              {items && items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.name || item.productName || "N/A"}</td>
                  <td>{item.hsn || item.hsnCode || "N/A"}</td>
                  <td>{item.quantity || 1}</td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>{formatNumber(item.discount)}</td>
                  <td>{formatCurrency(calculateItemDiscountedTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="totals-section">
          <div className="amount-details">
            <table>
              <tbody>
                <tr>
                  <td>Subtotal (Incl. Tax):</td>
                  <td>{formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td>Discount:</td>
                  <td>{formatCurrency(discount)}</td>
                </tr>
                {promoDiscount > 0 && (
                  <tr>
                    <td>Promo Discount:</td>
                    <td>{formatCurrency(promoDiscount)}</td>
                  </tr>
                )}

                {/* Loyalty Coins Discount */}
                {loyaltyDiscount > 0 && (
                  <tr>
                    <td>Loyalty Coins Discount:</td>
                    <td>{formatCurrency(loyaltyDiscount)}</td>
                  </tr>
                )}

                {/* Show CGST/SGST only if no mixed tax rates */}
                {!hasMixedTaxRates && cgst > 0 && sgst > 0 && (
                  <>
                    <tr>
                      <td>CGST ({invoice.taxPercentages && invoice.taxPercentages[0] ? invoice.taxPercentages[0] / 2 : 9}%):</td>
                      <td>{formatCurrency(cgst)}</td>
                    </tr>
                    <tr>
                      <td>SGST ({invoice.taxPercentages && invoice.taxPercentages[0] ? invoice.taxPercentages[0] / 2 : 9}%):</td>
                      <td>{formatCurrency(sgst)}</td>
                    </tr>
                  </>
                )}

                {/* Show GST only if mixed tax rates */}
                {hasMixedTaxRates && tax > 0 && (
                  <tr>
                    <td>GST:</td>
                    <td>{formatCurrency(tax)}</td>
                  </tr>
                )}

                <tr className="grand-total">
                  <td>Grand Total:</td>
                  <td>{formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="amount-in-words">
          <p><strong>Amount in Words:</strong> {numberToWords(total)} Only</p>
        </div>

        {/* Payment Method Section */}
        <div className="payment-method-section">
          <p><strong>Payment Method:</strong> {getPaymentMethodText()}</p>
        </div>

        {/* Declaration and Terms Section */}
        <div className="declaration-terms-section">
          <div className="terms-section">
            <h3>Terms & Conditions</h3>
            <p dangerouslySetInnerHTML={{ __html: termsAndConditions }}></p>
          </div>
        </div>

        {/* Footer Section */}
        <div className="invoice-footer">
          <div className="thank-you">
            <p>Thank you for your business!</p>
          </div>
          <div className="signature">
            <p>Authorized Signature</p>
            <div className="signature-line"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesPrint;