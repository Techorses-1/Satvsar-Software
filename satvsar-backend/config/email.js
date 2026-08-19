// config/email.js
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
    address: "G.F 39, Infinity Arcade, Nr Pratapnagar Bridge ONGC Road, Pratapnagar, Vadodara - 340004",
    gst: "24BNYPD2078K2ZI",
    phone: "+91 1234567890",
    email: process.env.EMAIL_USER,
    website: "https://satvsar.com"
};

// Email templates
const emailTemplates = {
    // Forgot Password Template
    forgotPassword: (email, otp) => ({
        from: `"Satvsar Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset OTP',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Reset OTP</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        background-color: #fefcf2;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: #ffffff;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 4px 24px rgba(0,0,0,0.1);
                    }
                    .header {
                        background: linear-gradient(135deg, #4e221c 0%, #6b2e24 100%);
                        padding: 30px;
                        text-align: center;
                    }
                    .header h1 {
                        color: #c98b30;
                        margin: 0;
                        font-size: 28px;
                    }
                    .header p {
                        color: #f0e6d2;
                        margin: 10px 0 0;
                        font-size: 14px;
                    }
                    .body {
                        padding: 40px 30px;
                    }
                    .otp-box {
                        text-align: center;
                        margin: 30px 0;
                    }
                    .otp-code {
                        font-size: 36px;
                        font-weight: bold;
                        color: #c98b30;
                        letter-spacing: 8px;
                        padding: 20px;
                        background-color: #fefcf2;
                        border-radius: 12px;
                        display: inline-block;
                        font-family: monospace;
                        border: 2px dashed #c98b30;
                    }
                    .warning {
                        background: #fff3e0;
                        padding: 15px;
                        border-radius: 10px;
                        margin: 20px 0;
                        font-size: 13px;
                        color: #b87c2e;
                    }
                    .footer {
                        background: #fefcf2;
                        padding: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #a08060;
                        border-top: 1px solid #ede8df;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <h1>🪔 ${COMPANY.brand}</h1>
                        <p>Pure oil from our kitchen to yours</p>
                    </div>
                    
                    <div class="body">
                        <h2 style="color: #4e221c;">Password Reset Request</h2>
                        <p>Hello,</p>
                        <p>We received a request to reset your password for your ${COMPANY.brand} account. Please use the following OTP to proceed:</p>
                        
                        <div class="otp-box">
                            <div class="otp-code">${otp}</div>
                        </div>
                        
                        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
                        
                        <div class="warning">
                            <strong>⚠️ Security Tip:</strong> If you didn't request this, please ignore this email. Someone might have entered your email by mistake.
                        </div>
                        
                        <p>For security reasons, never share this OTP with anyone.</p>
                    </div>
                    
                    <div class="footer">
                        <p>© 2024 ${COMPANY.brand} | ${COMPANY.parent}</p>
                        <p>${COMPANY.address}</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    // Contact Form - Thank You Email to User
    contactThankYou: (email, data) => ({
        from: `"${COMPANY.brand} Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Thank You for Contacting ${COMPANY.brand}!`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Thank You for Contacting ${COMPANY.brand}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        background-color: #fefcf2;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: #ffffff;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 4px 24px rgba(0,0,0,0.1);
                    }
                    .header {
                        background: linear-gradient(135deg, #4e221c 0%, #6b2e24 100%);
                        padding: 30px;
                        text-align: center;
                    }
                    .header h1 {
                        color: #c98b30;
                        margin: 0;
                        font-size: 28px;
                    }
                    .header p {
                        color: #f0e6d2;
                        margin: 10px 0 0;
                        font-size: 14px;
                    }
                    .body {
                        padding: 40px 30px;
                    }
                    .greeting {
                        font-size: 18px;
                        color: #4e221c;
                        margin-bottom: 20px;
                    }
                    .message-box {
                        background: #fefcf2;
                        border-left: 4px solid #c98b30;
                        padding: 20px;
                        margin: 25px 0;
                        border-radius: 8px;
                    }
                    .message-box p {
                        margin: 0;
                        color: #6b5535;
                    }
                    .thank-you-note {
                        background: #e8e0d5;
                        padding: 20px;
                        border-radius: 12px;
                        margin: 25px 0;
                        text-align: center;
                    }
                    .company-details {
                        background: #f5f0e8;
                        padding: 20px;
                        border-radius: 12px;
                        margin-top: 30px;
                    }
                    .company-details h3 {
                        color: #4e221c;
                        margin-top: 0;
                        margin-bottom: 15px;
                    }
                    .company-details p {
                        margin: 5px 0;
                        color: #6b5535;
                    }
                    .footer {
                        background: #fefcf2;
                        padding: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #a08060;
                        border-top: 1px solid #ede8df;
                    }
                    .brand {
                        color: #c98b30;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <h1>🪔 ${COMPANY.brand}</h1>
                        <p>Pure oil from our kitchen to yours</p>
                    </div>
                    
                    <div class="body">
                        <div class="greeting">
                            Dear <strong>${data.name}</strong>,
                        </div>
                        
                        <p>Thank you for reaching out to <span class="brand">${COMPANY.brand}</span>! We appreciate you taking the time to contact us.</p>
                        
                        <div class="message-box">
                            <p><strong>Your Message:</strong></p>
                            <p>"${data.message}"</p>
                        </div>
                        
                        <p>Our team has received your inquiry and will get back to you within <strong>24 hours</strong>. We're committed to providing you with the best possible support.</p>
                        
                        <div class="thank-you-note">
                            <p style="font-size: 24px; margin: 0;">🪔</p>
                            <p style="margin: 10px 0 0; font-style: italic;">"Quality oil, healthy life - that's our promise to you."</p>
                        </div>
                        
                        <div class="company-details">
                            <h3>About ${COMPANY.brand}</h3>
                            <p>Part of <strong>${COMPANY.parent}</strong> - committed to delivering pure, natural oils for your family's health.</p>
                            <p>📍 ${COMPANY.address}</p>
                            <p>📞 ${COMPANY.phone}</p>
                            <p>📧 ${COMPANY.email}</p>
                            <p>🔖 GST: ${COMPANY.gst}</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>&copy; 2024 ${COMPANY.brand} | All Rights Reserved</p>
                        <p>This is an automated response, please do not reply directly to this email.</p>
                        <p>${COMPANY.address}</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    // Contact Form - Admin Notification
    contactNotification: (email, data) => ({
        from: `"${COMPANY.brand} Contact Form" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `New Contact Form Submission - ${data.contact.name}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Contact Form Submission</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        background-color: #fefcf2;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: #ffffff;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 4px 24px rgba(0,0,0,0.1);
                    }
                    .header {
                        background: linear-gradient(135deg, #4e221c 0%, #6b2e24 100%);
                        padding: 25px;
                        text-align: center;
                    }
                    .header h1 {
                        color: #c98b30;
                        margin: 0;
                        font-size: 24px;
                    }
                    .body {
                        padding: 30px;
                    }
                    .alert-badge {
                        background: #c98b30;
                        color: #fff;
                        padding: 8px 16px;
                        border-radius: 20px;
                        display: inline-block;
                        margin-bottom: 20px;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    .info-card {
                        background: #fefcf2;
                        border: 1px solid #ede8df;
                        border-radius: 12px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .info-row {
                        margin-bottom: 15px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #ede8df;
                    }
                    .info-row strong {
                        color: #4e221c;
                        display: inline-block;
                        min-width: 80px;
                    }
                    .message-content {
                        background: #f5f0e8;
                        padding: 15px;
                        border-radius: 8px;
                        margin-top: 10px;
                        font-style: italic;
                    }
                    .actions {
                        margin-top: 25px;
                        text-align: center;
                    }
                    .button {
                        background: #c98b30;
                        color: white;
                        padding: 12px 24px;
                        text-decoration: none;
                        border-radius: 8px;
                        display: inline-block;
                        font-weight: bold;
                    }
                    .footer {
                        background: #fefcf2;
                        padding: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #a08060;
                        border-top: 1px solid #ede8df;
                    }
                    .company-info {
                        margin-top: 20px;
                        padding-top: 15px;
                        border-top: 1px solid #ede8df;
                        font-size: 11px;
                        color: #a08060;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <h1>🪔 New Contact Inquiry</h1>
                    </div>
                    
                    <div class="body">
                        <div class="alert-badge">🔔 ACTION REQUIRED</div>
                        
                        <p>A new message has been received from the ${COMPANY.brand} contact form.</p>
                        
                        <div class="info-card">
                            <div class="info-row">
                                <strong>Name:</strong> ${data.contact.name}
                            </div>
                            <div class="info-row">
                                <strong>Email:</strong> ${data.contact.email}
                            </div>
                            <div class="info-row">
                                <strong>Phone:</strong> ${data.contact.phone}
                            </div>
                            <div class="info-row">
                                <strong>Submitted:</strong> ${new Date(data.contact.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                            </div>
                            <div class="info-row">
                                <strong>Contact ID:</strong> ${data.contact.contactId}
                            </div>
                            <div class="info-row">
                                <strong>Message:</strong>
                                <div class="message-content">
                                    "${data.contact.message}"
                                </div>
                            </div>
                        </div>
                        
                        
                        
                        <p style="margin-top: 25px; font-size: 13px; color: #6b5535; text-align: center;">
                            <strong>⏰ Please respond to this inquiry within 24 hours.</strong>
                        </p>
                        
                        <div class="company-info">
                            <p>${COMPANY.brand} | ${COMPANY.parent}</p>
                            <p>${COMPANY.address}</p>
                            <p>📞 ${COMPANY.phone} | 📧 ${COMPANY.email}</p>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated notification from your website contact form.</p>
                        <p>© 2024 ${COMPANY.brand} - All Rights Reserved</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),




    // Add to emailTemplates object in config/email.js

    // Distributor Application - Thank You Email to User
    distributorThankYou: (email, data) => ({
        from: `"${data.COMPANY.brand} Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Thank You for Your Distributor Application - ${data.COMPANY.brand}`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Distributor Application Received</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #fefcf2;
                }
                .email-container {
                    max-width: 600px;
                    margin: 20px auto;
                    background: #ffffff;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.1);
                }
                .header {
                    background: linear-gradient(135deg, #4e221c 0%, #6b2e24 100%);
                    padding: 30px;
                    text-align: center;
                }
                .header h1 {
                    color: #c98b30;
                    margin: 0;
                    font-size: 28px;
                }
                .header p {
                    color: #f0e6d2;
                    margin: 10px 0 0;
                    font-size: 14px;
                }
                .body {
                    padding: 40px 30px;
                }
                .greeting {
                    font-size: 18px;
                    color: #4e221c;
                    margin-bottom: 20px;
                }
                .info-box {
                    background: #fefcf2;
                    border-left: 4px solid #c98b30;
                    padding: 20px;
                    margin: 25px 0;
                    border-radius: 8px;
                }
                .info-box p {
                    margin: 5px 0;
                    color: #6b5535;
                }
                .thank-you-note {
                    background: #e8e0d5;
                    padding: 20px;
                    border-radius: 12px;
                    margin: 25px 0;
                    text-align: center;
                }
                .next-steps {
                    background: #f5f0e8;
                    padding: 20px;
                    border-radius: 12px;
                    margin-top: 30px;
                }
                .next-steps h3 {
                    color: #4e221c;
                    margin-top: 0;
                    margin-bottom: 15px;
                }
                .footer {
                    background: #fefcf2;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #a08060;
                    border-top: 1px solid #ede8df;
                }
                .brand {
                    color: #c98b30;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>🪔 ${data.COMPANY.brand}</h1>
                    <p>Pure oil from our kitchen to yours</p>
                </div>
                
                <div class="body">
                    <div class="greeting">
                        Dear <strong>${data.name}</strong>,
                    </div>
                    
                    <p>Thank you for showing interest in becoming a distributor with <span class="brand">${data.COMPANY.brand}</span>! We're excited to partner with you.</p>
                    
                    <div class="info-box">
                        <p><strong>Application Details:</strong></p>
                        <p><strong>City:</strong> ${data.city}</p>
                        ${data.message ? `<p><strong>Your Message:</strong> "${data.message}"</p>` : ''}
                    </div>
                    
                    <div class="thank-you-note">
                        <p style="font-size: 24px; margin: 0;">🤝</p>
                        <p style="margin: 10px 0 0; font-style: italic;">"Together, let's bring purity to every kitchen"</p>
                    </div>
                    
                    <div class="next-steps">
                        <h3>📋 What's Next?</h3>
                        <p>Our distributor relations team will review your application and contact you within <strong>48 hours</strong>.</p>
                        <p>We'll discuss:</p>
                        <ul>
                            <li>Distributor benefits and margins</li>
                            <li>Minimum order requirements</li>
                            <li>Delivery and logistics</li>
                            <li>Marketing support</li>
                        </ul>
                    </div>
                </div>
                
                <div class="footer">
                    <p>&copy; 2024 ${data.COMPANY.brand} | ${data.COMPANY.parent}</p>
                    <p>${data.COMPANY.address}</p>
                    <p>📞 ${data.COMPANY.phone} | ✉️ ${data.COMPANY.email}</p>
                </div>
            </div>
        </body>
        </html>
    `
    }),

    // Distributor Application - Admin Notification
    distributorNotification: (email, data) => ({
        from: `"${data.COMPANY.brand} Distributor Form" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `New Distributor Application - ${data.distributor.fullName}`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Distributor Application</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background-color: #fefcf2;
                }
                .email-container {
                    max-width: 600px;
                    margin: 20px auto;
                    background: #ffffff;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.1);
                }
                .header {
                    background: linear-gradient(135deg, #4e221c 0%, #6b2e24 100%);
                    padding: 25px;
                    text-align: center;
                }
                .header h1 {
                    color: #c98b30;
                    margin: 0;
                    font-size: 24px;
                }
                .body {
                    padding: 30px;
                }
                .alert-badge {
                    background: #c98b30;
                    color: #fff;
                    padding: 8px 16px;
                    border-radius: 20px;
                    display: inline-block;
                    margin-bottom: 20px;
                    font-size: 12px;
                    font-weight: bold;
                }
                .info-card {
                    background: #fefcf2;
                    border: 1px solid #ede8df;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 20px 0;
                }
                .info-row {
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #ede8df;
                }
                .info-row strong {
                    color: #4e221c;
                    display: inline-block;
                    min-width: 100px;
                }
                .message-content {
                    background: #f5f0e8;
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 10px;
                    font-style: italic;
                }
                .actions {
                    margin-top: 25px;
                    text-align: center;
                }
                .button {
                    background: #c98b30;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 8px;
                    display: inline-block;
                    font-weight: bold;
                }
                .footer {
                    background: #fefcf2;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #a08060;
                    border-top: 1px solid #ede8df;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>🪔 New Distributor Application</h1>
                </div>
                
                <div class="body">
                    <div class="alert-badge">🔔 ACTION REQUIRED</div>
                    
                    <p>A new distributor application has been received from the ${data.COMPANY.brand} website.</p>
                    
                    <div class="info-card">
                        <div class="info-row">
                            <strong>Name:</strong> ${data.distributor.fullName}
                        </div>
                        <div class="info-row">
                            <strong>Email:</strong> ${data.distributor.email}
                        </div>
                        <div class="info-row">
                            <strong>Phone:</strong> ${data.distributor.phone}
                        </div>
                        <div class="info-row">
                            <strong>City:</strong> ${data.distributor.city}
                        </div>
                        <div class="info-row">
                            <strong>Submitted:</strong> ${new Date(data.distributor.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </div>
                        <div class="info-row">
                            <strong>Application ID:</strong> ${data.distributor.distributorId}
                        </div>
                        <div class="info-row">
                            <strong>Message:</strong>
                            <div class="message-content">
                                "${data.distributor.message}"
                            </div>
                        </div>
                    </div>
                    
                    <p style="margin-top: 25px; font-size: 13px; color: #6b5535; text-align: center;">
                        <strong>⏰ Please contact this applicant within 48 hours.</strong>
                    </p>
                </div>
                
                <div class="footer">
                    <p>© 2024 ${data.COMPANY.brand} | ${data.COMPANY.parent}</p>
                    <p>${data.COMPANY.address}</p>
                </div>
            </div>
        </body>
        </html>
    `
    }),

    // Distributor Approved Email
    distributorApproved: (email, data) => ({
        from: `"${data.COMPANY.brand} Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Congratulations! Your Distributor Application is Approved - ${data.COMPANY.brand}`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Distributor Application Approved</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #fefcf2; }
                .email-container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #2d7a4f 0%, #1e5a3b 100%); padding: 30px; text-align: center; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .body { padding: 40px 30px; }
                .success-badge { background: #2d7a4f; color: white; padding: 8px 20px; border-radius: 30px; display: inline-block; margin-bottom: 20px; font-size: 14px; font-weight: bold; }
                .footer { background: #fefcf2; padding: 20px; text-align: center; font-size: 12px; color: #a08060; border-top: 1px solid #ede8df; }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>🎉 Congratulations!</h1>
                </div>
                <div class="body">
                    <div class="success-badge">✅ APPLICATION APPROVED</div>
                    <p>Dear <strong>${data.name}</strong>,</p>
                    <p>We are pleased to inform you that your distributor application has been <strong>approved</strong>!</p>
                    <p>Our team will contact you shortly with the next steps, including:</p>
                    <ul>
                        <li>Distributor agreement and terms</li>
                        <li>Welcome kit and pricing details</li>
                        <li>First order placement</li>
                        <li>Training and support schedule</li>
                    </ul>
                    <p>Welcome to the ${data.COMPANY.brand} family! Together, let's bring purity to every kitchen.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ${data.COMPANY.brand}</p>
                </div>
            </div>
        </body>
        </html>
    `
    }),

    // Distributor Rejected Email
    distributorRejected: (email, data) => ({
        from: `"${data.COMPANY.brand} Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Update on Your Distributor Application - ${data.COMPANY.brand}`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Distributor Application Update</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #fefcf2; }
                .email-container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #c0392b 0%, #9a2a1f 100%); padding: 30px; text-align: center; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .body { padding: 40px 30px; }
                .info-badge { background: #c98b30; color: white; padding: 8px 20px; border-radius: 30px; display: inline-block; margin-bottom: 20px; font-size: 14px; font-weight: bold; }
                .footer { background: #fefcf2; padding: 20px; text-align: center; font-size: 12px; color: #a08060; border-top: 1px solid #ede8df; }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h1>📋 Application Update</h1>
                </div>
                <div class="body">
                    <div class="info-badge">ℹ️ APPLICATION STATUS</div>
                    <p>Dear <strong>${data.name}</strong>,</p>
                    <p>Thank you for your interest in becoming a distributor with ${data.COMPANY.brand}.</p>
                    <p>After careful review of your application, we regret to inform you that we are unable to proceed with your application at this time.</p>
                    <p>This decision does not reflect on you or your business. We have received a high volume of applications and are currently focusing on specific regions.</p>
                    <p>We encourage you to reapply in the future as we continue to expand our distributor network.</p>
                    <p>Thank you for your understanding.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ${data.COMPANY.brand}</p>
                </div>
            </div>
        </body>
        </html>
    `
    }),
};

// Function to send email
const sendEmail = async (type, email, data) => {
    try {
        const template = emailTemplates[type];
        if (!template) {
            throw new Error(`Email template not found for type: ${type}`);
        }

        const mailOptions = template(email, data);
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully: ${type} to ${email} - MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email sending error:', error.message);
        throw new Error('Failed to send email. Please try again later.');
    }
};

module.exports = { sendEmail, COMPANY };