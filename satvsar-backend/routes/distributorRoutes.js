// routes/distributorRoutes.js
const express = require("express");
const router = express.Router();
const Distributor = require("../modals/Distributor");
const { sendEmail } = require("../config/email");

// Company Details
const COMPANY = {
    parent: "Elements Corporation",
    brand: "Satvsar",
    address: "G.F - 39, Infinity Arcade, Near Pratapnagar Bridge, ONGC Road, Pratapnagar, Vadodara-390004. Gujarat (India)",
    gst: "24BNYPD2078K2ZI",
    phone: "+91 92747 78081",
    phone2: "+91 78610 78081",
    email: process.env.EMAIL_USER,
    website: "https://satvsar.com"
};

// ➤ SUBMIT DISTRIBUTOR APPLICATION
router.post("/submit", async (req, res) => {
    try {
        const { fullName, email, phone, city, message } = req.body;

        // Validation
        if (!fullName || !email || !phone || !city) {
            return res.status(400).json({
                success: false,
                message: "Full name, email, phone, and city are required fields"
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

        // Rate limiting - Check if same email submitted within last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentSubmission = await Distributor.findOne({
            $or: [
                { email: email.toLowerCase() },
                { phone: phone }
            ],
            createdAt: { $gte: sevenDaysAgo }
        });

        if (recentSubmission) {
            const daysLeft = Math.ceil((recentSubmission.createdAt.getTime() + (7 * 24 * 60 * 60 * 1000) - Date.now()) / (24 * 60 * 60 * 1000));
            return res.status(429).json({
                success: false,
                message: `You have already submitted an application. Please wait ${daysLeft} more day(s) before applying again.`
            });
        }

        // Create new distributor application
        const distributor = new Distributor({
            fullName: fullName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            city: city.trim(),
            message: message ? message.trim() : '',
            status: 'pending'
        });

        await distributor.save();

        // Send Thank You Email to User
        await sendEmail('distributorThankYou', email, {
            name: fullName.trim(),
            city: city.trim(),
            message: message || 'No message provided',
            COMPANY
        });

        // Send Notification Email to Admin
        await sendEmail('distributorNotification', COMPANY.email, {
            distributor: {
                distributorId: distributor.distributorId,
                fullName: distributor.fullName,
                email: distributor.email,
                phone: distributor.phone,
                city: distributor.city,
                message: distributor.message || 'No message provided',
                createdAt: distributor.createdAt
            },
            COMPANY
        });

        res.status(201).json({
            success: true,
            message: "Thank you for your interest! Our team will contact you within 48 hours.",
            distributorId: distributor.distributorId
        });

    } catch (err) {
        console.error("Distributor form error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to submit application. Please try again later.",
            error: err.message
        });
    }
});

// ➤ GET ALL DISTRIBUTOR APPLICATIONS (Admin only)
router.get("/all", async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        let filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const applications = await Distributor.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Distributor.countDocuments(filter);

        res.status(200).json({
            success: true,
            applications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error("Error fetching distributor applications:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch applications"
        });
    }
});

// ➤ GET SINGLE DISTRIBUTOR APPLICATION (Admin only)
router.get("/:distributorId", async (req, res) => {
    try {
        const { distributorId } = req.params;
        
        const application = await Distributor.findOne({ distributorId });
        
        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        res.status(200).json({
            success: true,
            application
        });
    } catch (err) {
        console.error("Error fetching distributor application:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch application"
        });
    }
});

// ➤ UPDATE APPLICATION STATUS (Admin only)
router.put("/update-status/:distributorId", async (req, res) => {
    try {
        const { distributorId } = req.params;
        const { status, notes } = req.body;

        const validStatuses = ['pending', 'contacted', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        const application = await Distributor.findOneAndUpdate(
            { distributorId },
            { 
                status, 
                isContacted: status === 'contacted' ? true : false,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        // Send status update email to user
        if (status === 'approved') {
            await sendEmail('distributorApproved', application.email, {
                name: application.fullName,
                COMPANY
            });
        } else if (status === 'rejected') {
            await sendEmail('distributorRejected', application.email, {
                name: application.fullName,
                COMPANY
            });
        }

        res.status(200).json({
            success: true,
            message: `Application status updated to ${status}`,
            application
        });
    } catch (err) {
        console.error("Error updating distributor status:", err);
        res.status(500).json({
            success: false,
            message: "Failed to update status"
        });
    }
});

// ➤ DELETE DISTRIBUTOR APPLICATION (Admin only)
router.delete("/:distributorId", async (req, res) => {
    try {
        const { distributorId } = req.params;
        
        const application = await Distributor.findOneAndDelete({ distributorId });
        
        if (!application) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Application deleted successfully"
        });
    } catch (err) {
        console.error("Error deleting distributor application:", err);
        res.status(500).json({
            success: false,
            message: "Failed to delete application"
        });
    }
});

module.exports = router;