const jwt = require("jsonwebtoken");

// ADMIN MIDDLEWARE
function adminAuth(req, res, next) {
  const authHeader = req.header("Authorization");

  console.log("=== Admin Auth Debug ===");
  console.log("Auth Header:", authHeader);
  console.log("Auth Header exists:", !!authHeader);
  console.log("Starts with Bearer:", authHeader?.startsWith("Bearer "));

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("❌ No or invalid token format");
    return res.status(401).json({ message: "No or invalid token" });
  }

  const token = authHeader.replace("Bearer ", "");
  console.log("Token received:", token.substring(0, 20) + "..."); // Log first 20 chars only

  try {
    console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);

    if (decoded.role !== "admin") {
      console.log("❌ User role is not admin:", decoded.role);
      return res.status(403).json({ message: "Only admin allowed" });
    }

    console.log("✅ Admin auth successful");
    req.admin = decoded;
    next();
  } catch (err) {
    console.log("❌ JWT verification error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
}


// USER AUTH MIDDLEWARE
const auth = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Invalid or missing token" });
    }

    const token = authHeader.replace("Bearer ", "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.auth = {
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err) {
    console.error("JWT error:", err.message);
    res.status(401).json({ message: "Authentication failed" });
  }
};


// FINAL EXPORT (CORRECT)
module.exports = { adminAuth, auth };
