// routes/contactRoutes.js (WITHOUT moment)
const express = require("express");
const router = express.Router();
const Contact = require("../modals/Contact");
const { sendEmail } = require("../config/email");

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

// ➤ SUBMIT CONTACT FORM
router.post("/submit", async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        // Validation
        if (!name || !email || !phone || !message) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        // Validate phone (10 digits)
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 10-digit phone number"
            });
        }

        // Validate message length
        if (message.length < 10) {
            return res.status(400).json({
                success: false,
                message: "Message must be at least 10 characters"
            });
        }

        // Rate limiting - Check if same email submitted within last 3 days
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const recentSubmission = await Contact.findOne({
            email: email.toLowerCase(),
            createdAt: { $gte: threeDaysAgo }
        });

        if (recentSubmission) {
            const daysLeft = Math.ceil((recentSubmission.createdAt.getTime() + (3 * 24 * 60 * 60 * 1000) - Date.now()) / (24 * 60 * 60 * 1000));
            return res.status(429).json({
                success: false,
                message: `You have already submitted an inquiry. Please wait ${daysLeft} more day(s) before sending another message.`
            });
        }

        // Create new contact entry
        const contact = new Contact({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            message: message.trim(),
            status: 'pending'
        });

        await contact.save();

        // Send Thank You Email to User
        await sendEmail('contactThankYou', email, {
            name: name.trim(),
            message: message.trim(),
            COMPANY
        });

        // Send Notification Email to Admin
        await sendEmail('contactNotification', COMPANY.email, {
            contact: {
                contactId: contact.contactId,
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                message: contact.message,
                createdAt: contact.createdAt
            },
            COMPANY
        });

        res.status(201).json({
            success: true,
            message: "Thank you for contacting us! We'll get back to you within 24 hours.",
            contactId: contact.contactId
        });

    } catch (err) {
        console.error("Contact form error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to send message. Please try again later.",
            error: err.message
        });
    }
});

// ➤ GET ALL CONTACT SUBMISSIONS (Admin only - Add auth middleware)
router.get("/admin/all", async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            count: contacts.length,
            contacts
        });
    } catch (err) {
        console.error("Get contacts error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch contacts"
        });
    }
});

// ➤ UPDATE CONTACT STATUS (Admin only)
router.put("/admin/update/:contactId", async (req, res) => {
    try {
        const { contactId } = req.params;
        const { status, isReplied } = req.body;

        const contact = await Contact.findOneAndUpdate(
            { contactId },
            { status, isReplied, updatedAt: new Date() },
            { new: true }
        );

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found"
            });
        }

        res.json({
            success: true,
            message: "Contact updated successfully",
            contact
        });
    } catch (err) {
        console.error("Update contact error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to update contact"
        });
    }
});

module.exports = router;