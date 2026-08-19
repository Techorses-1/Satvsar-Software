// routes/billingDashboard.js
const express = require("express");
const router = express.Router();
const Order = require("../modals/Orders");
const Inventory = require("../modals/Inventory");

// ========== HELPER FUNCTIONS ==========

// Get date range based on period parameter (UPDATED)
const getDateRange = (period) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let startDate, endDate = today;

    switch (period) {
        case "lastmonth":
            // First day of last month to last day of last month
            const lastMonthDate = new Date();
            lastMonthDate.setMonth(today.getMonth() - 1);
            startDate = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            break;

        case "last6months":
            startDate = new Date();
            startDate.setMonth(today.getMonth() - 6);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;

        case "thisyear":
            startDate = new Date(today.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            break;

        case "lastyear":
            startDate = new Date(today.getFullYear() - 1, 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today.getFullYear() - 1, 11, 31);
            endDate.setHours(23, 59, 59, 999);
            break;

        case "thismonth":
        default:
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    return { startDate, endDate };
};

// Get months in range for chart
const getMonthsInRange = (startDate, endDate) => {
    const months = [];
    const current = new Date(startDate);

    while (current <= endDate) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        months.push(`${year}-${month}`);
        current.setMonth(current.getMonth() + 1);
    }

    return months;
};

// Initialize monthly data structure for sales
const initMonthlyData = (months) => {
    const data = {};
    months.forEach(month => {
        data[month] = { online: 0, offline: 0, total: 0 };
    });
    return data;
};

// Initialize monthly data structure for purchases
const initPurchaseMonthlyData = (months) => {
    const data = {};
    months.forEach(month => {
        data[month] = 0;
    });
    return data;
};

// Get expiry date threshold (3 months from now)
const getExpiryThreshold = () => {
    const today = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(today.getMonth() + 3);
    return threeMonthsLater;
};

// ========== MAIN DASHBOARD STATS ENDPOINT ==========

router.get("/stats", async (req, res) => {
    const startTime = Date.now();
    const { period = "thismonth" } = req.query;

    try {
        console.log(`📊 [Dashboard] Fetching dashboard statistics for period: ${period}`);

        // Get date range based on period
        const { startDate, endDate } = getDateRange(period);
        console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // ========== 1. GET SALES STATS FROM ORDERS ==========
        const orders = await Order.find({
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        }).select("orderType total createdAt items");

        console.log(`📦 Found ${orders.length} orders in date range`);

        // Calculate sales totals
        let onlineTotal = 0;
        let offlineTotal = 0;
        let onlineCount = 0;
        let offlineCount = 0;

        // Get months in range for chart
        const months = getMonthsInRange(startDate, endDate);
        const monthlyData = initMonthlyData(months);

        // Process each order
        orders.forEach(order => {
            const orderTotal = order.total || 0;
            const orderDate = new Date(order.createdAt);
            const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

            if (order.orderType === "online") {
                onlineTotal += orderTotal;
                onlineCount++;
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].online += orderTotal;
                    monthlyData[monthKey].total += orderTotal;
                }
            } else if (order.orderType === "offline") {
                offlineTotal += orderTotal;
                offlineCount++;
                if (monthlyData[monthKey]) {
                    monthlyData[monthKey].offline += orderTotal;
                    monthlyData[monthKey].total += orderTotal;
                }
            }
        });

        const combinedTotal = onlineTotal + offlineTotal;
        const totalOrders = onlineCount + offlineCount;

        // Prepare chart data array
        const salesChartData = months.map(month => ({
            month: month,
            online: monthlyData[month]?.online || 0,
            offline: monthlyData[month]?.offline || 0,
            total: monthlyData[month]?.total || 0
        }));

        // ========== 2. GET PURCHASE STATS FROM BATCHES (FILTERED BY DATE) ==========
        let totalPurchases = 0;
        let purchaseCount = 0;
        const purchaseMonthlyData = initPurchaseMonthlyData(months);

        // Get all batch inventory items
        const inventoryItems = await Inventory.find({
            isActive: true,
            inventoryType: "batch"
        });

        console.log(`📦 Found ${inventoryItems.length} batch inventory items`);

        // Process each inventory item's batches
        inventoryItems.forEach(item => {
            if (item.batches && Array.isArray(item.batches)) {
                item.batches.forEach(batch => {
                    // Check if batch was added within date range
                    const addedDate = batch.addedAt ? new Date(batch.addedAt) : null;

                    if (addedDate && addedDate >= startDate && addedDate <= endDate) {
                        // Batch added in selected period
                        const batchTotal = batch.price * batch.quantity;
                        totalPurchases += batchTotal;
                        purchaseCount++;

                        // Add to monthly chart data
                        const monthKey = `${addedDate.getFullYear()}-${String(addedDate.getMonth() + 1).padStart(2, '0')}`;
                        if (purchaseMonthlyData[monthKey] !== undefined) {
                            purchaseMonthlyData[monthKey] += batchTotal;
                        }
                    }
                });
            }
        });

        console.log(`💰 Total Purchases in period: ₹${totalPurchases.toLocaleString()} from ${purchaseCount} batches`);

        // Prepare purchase chart data
        const purchaseChartData = months.map(month => ({
            month: month,
            value: purchaseMonthlyData[month] || 0
        }));

        // ========== 3. GET INVENTORY STATS (CURRENT STATE - NOT FILTERED) ==========
        const allInventoryItems = await Inventory.find({ isActive: true });

        let totalItems = allInventoryItems.length;
        let lowStockCount = 0;
        let outOfStockCount = 0;
        let totalInventoryValue = 0;

        allInventoryItems.forEach(item => {
            const stock = item.stock || 0;
            const minQty = item.threshold || 10;

            if (stock <= 0) {
                outOfStockCount++;
            } else if (stock <= minQty) {
                lowStockCount++;
            }

            totalInventoryValue += item.totalValue || 0;
        });

        // ========== 4. GET EXPIRING ITEMS (WITHIN 3 MONTHS) ==========
        const expiryThreshold = getExpiryThreshold();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expiringItems = [];

        allInventoryItems.forEach(item => {
            if (item.inventoryType === "batch" && item.batches && Array.isArray(item.batches)) {
                item.batches.forEach(batch => {
                    if (batch.expiryDate && batch.status === "active") {
                        const expiryDate = new Date(batch.expiryDate);
                        if (expiryDate <= expiryThreshold && expiryDate >= today) {
                            expiringItems.push({
                                inventoryId: item.inventoryId,
                                productName: item.productName,
                                batchNumber: batch.batchNumber,
                                expiryDate: batch.expiryDate,
                                quantity: batch.currentQuantity || batch.quantity,
                                daysUntilExpiry: Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
                            });
                        }
                    }
                });
            }
        });

        // Sort by closest expiry
        expiringItems.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

        // ========== 5. GET LOW STOCK ITEMS ==========
        const lowStockItems = allInventoryItems.filter(item => {
            const stock = item.stock || 0;
            const minQty = item.threshold || 10;
            return stock > 0 && stock <= minQty;
        }).map(item => ({
            inventoryId: item.inventoryId,
            productName: item.productName,
            totalQuantity: item.stock,
            minimumQty: item.threshold || 10,
            hsnCode: item.hsnCode || "",
            description: item.description || "",
            unit: item.unit || "",
            rate: item.sellingPrice || 0
        }));

        // ========== 6. GET OUT OF STOCK ITEMS ==========
        const outOfStockItems = allInventoryItems.filter(item => {
            const stock = item.stock || 0;
            return stock <= 0;
        }).map(item => ({
            inventoryId: item.inventoryId,
            productName: item.productName,
            totalQuantity: item.stock
        }));

        // ========== 7. PREPARE RESPONSE ==========
        const processingTime = Date.now() - startTime;

        console.log(`✅ [Dashboard] Stats fetched successfully in ${processingTime}ms`);

        res.status(200).json({
            success: true,
            period: period,
            dateRange: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            },
            sales: {
                combinedTotal: combinedTotal,
                onlineTotal: onlineTotal,
                offlineTotal: offlineTotal,
                onlineCount: onlineCount,
                offlineCount: offlineCount,
                totalOrders: totalOrders
            },
            salesTrend: {
                months: months,
                data: salesChartData
            },
            purchases: {
                totalPurchases: totalPurchases,
                purchaseCount: purchaseCount,
                trend: purchaseChartData
            },
            inventory: {
                totalItems: totalItems,
                lowStockCount: lowStockCount,
                outOfStockCount: outOfStockCount,
                totalValue: totalInventoryValue,
                inStockCount: totalItems - lowStockCount - outOfStockCount
            },
            alerts: {
                expiringItems: expiringItems,
                expiringCount: expiringItems.length,
                lowStockItems: lowStockItems,
                lowStockCount: lowStockItems.length,
                outOfStockItems: outOfStockItems,
                outOfStockCount: outOfStockItems.length
            },
            processingTime: `${processingTime}ms`
        });

    } catch (error) {
        console.error("❌ [Dashboard] Error fetching dashboard stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard statistics",
            error: error.message
        });
    }
});

module.exports = router;