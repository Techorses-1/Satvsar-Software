// routes/admin.js
const express = require("express");
const router = express.Router();
const Admin = require("../modals/Admin");
const User = require("../modals/User"); // ← ADD THIS import
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER ADMIN
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ✅ CHECK IN BOTH MODELS
    let adminExist = await Admin.findOne({ email });
    if (adminExist) {
      return res.status(400).json({ message: "Email already exists as Admin" });
    }

    let userExist = await User.findOne({ email });
    if (userExist) {
      return res.status(400).json({ 
        message: "This email is already registered as a User. Cannot register as Admin." 
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashed,
    });

    res.json({ message: "Admin registered", admin });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LOGIN ADMIN (no changes needed)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    let admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "No admin found" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
      {
        id: admin._id,
        adminId: admin.adminId,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login Success",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        adminId: admin.adminId
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;