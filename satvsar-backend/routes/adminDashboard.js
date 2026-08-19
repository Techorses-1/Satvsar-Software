const express = require("express");
const router = express.Router();

const Order = require("../modals/Orders");
const User = require("../modals/User");
const Inventory = require("../modals/Inventory");
const Review = require("../modals/Review");

const { adminAuth } = require("../middleware/auth");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build { start, end } Date objects from query params.
 * Supports: today | 7d | 30d | 90d | all  (via ?range=)
 * OR explicit ?startDate= & ?endDate= ISO strings.
 */
function getDateRange(req) {
  const { range, startDate, endDate } = req.query;

  // Explicit date override takes priority
  if (startDate || endDate) {
    return {
      start: startDate ? new Date(startDate) : new Date("1970-01-01"),
      end: endDate ? new Date(endDate) : new Date(),
    };
  }

  const end = new Date();
  const start = new Date();

  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "7d":
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "30d":
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    case "90d":
      start.setDate(end.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    case "all":
    default:
      return {
        start: new Date("1970-01-01"),
        end: new Date(),
      };
  }

  return { start, end };
}

/**
 * Build the $match stage for Order aggregations.
 * Accepts optional orderType: "online" | "offline" | "all" (default = "all")
 * ✅ UPDATED: Automatically excludes cancelled orders from revenue calculations
 */
function buildOrderMatch(start, end, orderType) {
  const match = { createdAt: { $gte: start, $lte: end } };

  if (orderType && orderType !== "all") {
    match.orderType = orderType;
  }

  return match;
}

/**
 * ✅ NEW HELPER: Build match that excludes cancelled orders
 * Use this for revenue/amount calculations
 */
function buildRevenueMatch(start, end, orderType) {
  const match = { 
    createdAt: { $gte: start, $lte: end },
    orderStatus: { $ne: "cancelled" }  // ❌ EXCLUDE CANCELLED ORDERS
  };

  if (orderType && orderType !== "all") {
    match.orderType = orderType;
  }

  return match;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🟢  KPIs
// GET /admin/dashboard/kpis?range=7d&orderType=online
// ✅ UPDATED: Excludes cancelled orders from revenue and AOV
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/kpis", adminAuth, async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const { orderType = "all" } = req.query;
    
    // Use revenue match for financial metrics (excludes cancelled)
    const revenueMatch = buildRevenueMatch(start, end, orderType);
    // Use regular match for counts (includes cancelled for counting)
    const countMatch = buildOrderMatch(start, end, orderType);

    const [
      revenueData,
      totalOrders,
      newUsers,
      pendingPayments,
      lowStock,
      onlineCount,
      offlineCount,
    ] = await Promise.all([
      // Total revenue (❌ EXCLUDES CANCELLED)
      Order.aggregate([
        { $match: revenueMatch },
        { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
      ]),

      // Total orders in range (✅ INCLUDES CANCELLED for counting)
      Order.countDocuments(countMatch),

      // New users in range (not filtered by orderType — users are global)
      User.countDocuments({ createdAt: { $gte: start, $lte: end } }),

      // Pending payments (global — not filtered by date/type)
      Order.countDocuments({ "payment.status": "pending" }),

      // Low stock count (global)
      Inventory.countDocuments({
        $expr: { $lte: ["$stock", "$threshold"] },
      }),

      // Online orders count in range (✅ INCLUDES CANCELLED for counting)
      Order.countDocuments({ ...buildOrderMatch(start, end, "online") }),

      // Offline orders count in range (✅ INCLUDES CANCELLED for counting)
      Order.countDocuments({ ...buildOrderMatch(start, end, "offline") }),
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;
    
    // Get count of non-cancelled orders for AOV calculation
    const nonCancelledOrdersCount = await Order.countDocuments(revenueMatch);
    const aov = nonCancelledOrdersCount === 0 ? 0 : totalRevenue / nonCancelledOrdersCount;

    res.json({
      totalRevenue,
      totalOrders,
      newUsers,
      aov: Number(aov.toFixed(2)),
      pendingPayments,
      lowStock,
      // Extra split — useful for the "Both" tab comparison
      onlineOrders: onlineCount,
      offlineOrders: offlineCount,
    });

  } catch (err) {
    console.error("KPI error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟢  Orders by Status
// GET /admin/dashboard/orders-by-status?range=7d&orderType=online
// ✅ UPDATED: totalAmount excludes cancelled orders
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/orders-by-status", adminAuth, async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const { orderType = "all" } = req.query;
    const match = buildOrderMatch(start, end, orderType);

    const result = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
          totalAmount: { 
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", "cancelled"] },
                0,  // ❌ CANCELLED ORDERS = ₹0 in totalAmount
                "$total"
              ]
            }
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json(result);

  } catch (err) {
    console.error("Orders by status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟢  Revenue Over Time (daily)
// GET /admin/dashboard/revenue-over-time?range=30d&orderType=all
// ✅ UPDATED: Excludes cancelled orders from revenue calculation
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/revenue-over-time", adminAuth, async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const { orderType = "all" } = req.query;

    // Use revenue match (excludes cancelled)
    const revenueMatch = buildRevenueMatch(start, end, orderType);

    const groupStage = {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
          type: "$orderType",
        },
        revenue: { $sum: "$total" },
        orderCount: { $sum: 1 },
      },
    };

    const raw = await Order.aggregate([
      { $match: revenueMatch },  // ❌ EXCLUDES CANCELLED
      groupStage,
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Build a unified day-keyed structure
    const dayMap = {};

    raw.forEach((d) => {
      const key = `${d._id.year}-${String(d._id.month).padStart(2, "0")}-${String(d._id.day).padStart(2, "0")}`;
      if (!dayMap[key]) {
        dayMap[key] = {
          label: `${d._id.day}/${d._id.month}`,
          date: key,
          online: 0,
          offline: 0,
          total: 0,
          onlineOrders: 0,
          offlineOrders: 0,
        };
      }
      if (d._id.type === "online") {
        dayMap[key].online += d.revenue;
        dayMap[key].onlineOrders += d.orderCount;
      } else {
        dayMap[key].offline += d.revenue;
        dayMap[key].offlineOrders += d.orderCount;
      }
      dayMap[key].total += d.revenue;
    });

    const result = Object.values(dayMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    res.json(result);

  } catch (err) {
    console.error("Revenue over time error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟢  Top Selling Products
// GET /admin/dashboard/top-products?range=30d&orderType=offline
// ✅ UPDATED: Excludes cancelled orders from product stats
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/top-products", adminAuth, async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const { orderType = "all" } = req.query;
    
    // Use revenue match (excludes cancelled orders)
    const revenueMatch = buildRevenueMatch(start, end, orderType);

    const data = await Order.aggregate([
      { $match: revenueMatch },  // ❌ EXCLUDES CANCELLED ORDERS
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    res.json(data);

  } catch (err) {
    console.error("Top products error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟢  Online vs Offline Comparison (for "Both" tab)
// GET /admin/dashboard/comparison?range=30d
// ✅ UPDATED: Excludes cancelled orders from revenue and AOV
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/comparison", adminAuth, async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    
    // Use revenue match (excludes cancelled orders)
    const revenueMatch = { 
      createdAt: { $gte: start, $lte: end },
      orderStatus: { $ne: "cancelled" }  // ❌ EXCLUDE CANCELLED
    };

    const data = await Order.aggregate([
      { $match: revenueMatch },
      {
        $group: {
          _id: "$orderType",
          totalRevenue: { $sum: "$total" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
          totalItems: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.quantity"] },
              },
            },
          },
        },
      },
    ]);

    // Normalise into { online: {...}, offline: {...} }
    const result = { online: null, offline: null };
    data.forEach((d) => {
      result[d._id] = {
        totalRevenue: Number(d.totalRevenue.toFixed(2)),
        totalOrders: d.totalOrders,
        avgOrderValue: Number(d.avgOrderValue.toFixed(2)),
        totalItems: d.totalItems,
      };
    });

    res.json(result);

  } catch (err) {
    console.error("Comparison error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟢  Low Stock (not filtered by orderType — inventory is global)
// GET /admin/dashboard/low-stock
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/low-stock", adminAuth, async (req, res) => {
  try {
    const items = await Inventory.find({
      $expr: { $lte: ["$stock", "$threshold"] },
    })
      .sort({ stock: 1 })
      .limit(20)
      .lean();

    res.json(items);

  } catch (err) {
    console.error("Low stock error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟢  Recent Reviews (global — not filtered by orderType)
// GET /admin/dashboard/reviews
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/reviews", adminAuth, async (req, res) => {
  try {
    const reviews = await Review.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(reviews);

  } catch (err) {
    console.error("Reviews error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 🟢  Payment Method Breakdown
// GET /admin/dashboard/payment-methods?range=30d&orderType=all
// ✅ UPDATED: Excludes cancelled orders from payment amounts
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/payment-methods", adminAuth, async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const { orderType = "all" } = req.query;
    
    // Use revenue match (excludes cancelled orders)
    const revenueMatch = buildRevenueMatch(start, end, orderType);

    const data = await Order.aggregate([
      { $match: revenueMatch },  // ❌ EXCLUDES CANCELLED ORDERS
      {
        $group: {
          _id: "$payment.method",
          count: { $sum: 1 },
          totalAmount: { $sum: "$total" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json(data);

  } catch (err) {
    console.error("Payment methods error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;