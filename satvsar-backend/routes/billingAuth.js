const express = require('express');
const router = express.Router();
const BillingUser = require("../modals/BillingUser");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// CREATE NEW BILLING USER (No auth required for now)
router.post('/billing-users/register', async (req, res) => {
    try {
        const { name, email, phone, password, permissions } = req.body;

        // Check if billing user already exists
        const existingUser = await BillingUser.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: "Email already registered",
                field: "email"
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new billing user - REMOVED createdBy field
        const billingUser = new BillingUser({
            name,
            email,
            phone,
            password: hashedPassword,
            permissions: permissions || []
        });

        const savedUser = await billingUser.save();

        // Remove password from response
        const userResponse = savedUser.toObject();
        delete userResponse.password;

        res.status(201).json({
            message: "Billing user registered successfully",
            user: {
                userId: userResponse.userId,
                name: userResponse.name,
                email: userResponse.email,
                phone: userResponse.phone,
                permissions: userResponse.permissions,
                isActive: userResponse.isActive,
                createdAt: userResponse.createdAt
            }
        });
    } catch (error) {
        console.error("Registration error:", error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: "Validation error",
                error: error.message
            });
        }

        res.status(500).json({
            message: "Registration failed",
            error: error.message
        });
    }
});

// BILLING USER LOGIN
router.post('/billing-users/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const billingUser = await BillingUser.findOne({ email });
        if (!billingUser) {
            return res.status(400).json({ message: "No billing user found with this email" });
        }

        // Check if user is active
        if (!billingUser.isActive) {
            return res.status(403).json({ message: "Account is deactivated. Contact admin." });
        }

        // Verify password
        const match = await bcrypt.compare(password, billingUser.password);
        if (!match) {
            return res.status(400).json({ message: "Wrong password" });
        }

        // Generate token
        const token = jwt.sign(
            {
                id: billingUser._id,
                userId: billingUser.userId,
                role: 'billing_user',
                permissions: billingUser.permissions
            },
            process.env.JWT_SECRET || "SECRET123",
            { expiresIn: "7d" }
        );

        // Remove password from response
        const userResponse = billingUser.toObject();
        delete userResponse.password;

        res.json({
            message: "Login Success",
            token,
            user: userResponse
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: err.message });
    }
});

// GET ALL BILLING USERS
router.get('/billing-users', async (req, res) => {
    try {
        const billingUsers = await BillingUser.find({})
            .sort({ createdAt: -1 })
            .select('-password');

        res.json(billingUsers);
    } catch (error) {
        console.error('Error fetching billing users:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// UPDATE BILLING USER
router.put('/billing-users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, phone, permissions, password, isActive } = req.body;

        // Find billing user
        const billingUser = await BillingUser.findOne({ userId });
        if (!billingUser) {
            return res.status(404).json({ message: 'Billing user not found' });
        }

        // Check if email is already taken by another user
        if (email && email !== billingUser.email) {
            const existingUser = await BillingUser.findOne({ email });
            if (existingUser && existingUser.userId !== userId) {
                return res.status(400).json({
                    message: "Email already taken by another user",
                    field: "email"
                });
            }
        }

        // Update user fields
        if (name) billingUser.name = name;
        if (email) billingUser.email = email;
        if (phone) billingUser.phone = phone;
        if (permissions) billingUser.permissions = permissions;
        if (typeof isActive !== 'undefined') billingUser.isActive = isActive;

        // Update password if provided
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            billingUser.password = await bcrypt.hash(password, salt);
        }

        const updatedUser = await billingUser.save();

        // Remove password from response
        const userResponse = updatedUser.toObject();
        delete userResponse.password;

        res.json({
            message: "Billing user updated successfully",
            user: userResponse
        });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({
            message: "Update failed",
            error: error.message
        });
    }
});

// DELETE BILLING USER
router.delete('/billing-users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const deletedUser = await BillingUser.findOneAndDelete({ userId });

        if (!deletedUser) {
            return res.status(404).json({ message: 'Billing user not found' });
        }

        res.json({ message: "Billing user deleted successfully" });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({
            message: "Delete failed",
            error: error.message
        });
    }
});




router.post("/register", async (req, res) => {
  try {
    // Check if user already exists
    const existingUser = await BillingUser.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already registered",
        field: "email"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Create new user
    const user = new BillingUser({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      password: hashedPassword
    });

    const savedUser = await user.save();

    // Create JWT token
    const token = jwt.sign(
      { userId: savedUser.userId },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        userId: savedUser.userId,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone,
        permissions: savedUser.permissions || []
      }
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: "Validation error",
        error: error.message
      });
    }

    res.status(500).json({
      message: "Registration failed",
      error: error.message
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    // Find user by email
    const user = await BillingUser.findOne({ email: req.body.email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
        field: "email"
      });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
        field: "password"
      });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.userId },
      process.env.JWT_SECRET,
      { expiresIn: "10h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        permissions: user.permissions || []
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Login failed",
      error: error.message
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await BillingUser.findOne({ userId: decoded.userId });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        permissions: user.permissions || []
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(401).json({
      message: "Invalid token",
      error: error.message
    });
  }
});


module.exports = router;