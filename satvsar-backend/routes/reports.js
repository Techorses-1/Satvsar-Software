// routes/reports.js (UPDATED - WITH DETAILED DATA FOR EXPORTS)
const express = require("express");
const router = express.Router();
const Order = require("../modals/Orders");
const Inventory = require("../modals/Inventory");
const mongoose = require("mongoose");

// ========== HELPER FUNCTIONS ==========

// Helper to get start and end of day in UTC
const getDayRange = (date) => {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
};

// Helper to get start and end of week in UTC
const getWeekRange = (date) => {
    const dayOfWeek = date.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(date);
    start.setUTCDate(date.getUTCDate() - diffToMonday);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
};

// Helper to get start and end of month in UTC
const getMonthRange = (date) => {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
};

// Helper to get start and end of year in UTC
const getYearRange = (date) => {
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
};

// Get date range based on filter
const getDateRange = (filter, customStartDate, customEndDate) => {
    const now = new Date();
    let start, end;

    switch (filter) {
        case "today":
            const todayRange = getDayRange(now);
            start = todayRange.start;
            end = todayRange.end;
            break;
        case "yesterday":
            const yesterday = new Date(now);
            yesterday.setUTCDate(now.getUTCDate() - 1);
            const yesterdayRange = getDayRange(yesterday);
            start = yesterdayRange.start;
            end = yesterdayRange.end;
            break;
        case "thisweek":
            const weekRange = getWeekRange(now);
            start = weekRange.start;
            end = weekRange.end;
            break;
        case "thismonth":
            const monthRange = getMonthRange(now);
            start = monthRange.start;
            end = monthRange.end;
            break;
        case "thisyear":
            const yearRange = getYearRange(now);
            start = yearRange.start;
            end = yearRange.end;
            break;
        case "custom":
            if (customStartDate && customEndDate) {
                const startDateObj = new Date(customStartDate);
                const endDateObj = new Date(customEndDate);
                start = new Date(Date.UTC(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate(), 0, 0, 0, 0));
                end = new Date(Date.UTC(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate(), 23, 59, 59, 999));
            }
            break;
        default:
            start = new Date(now);
            start.setUTCDate(now.getUTCDate() - 30);
            start.setUTCHours(0, 0, 0, 0);
            end = new Date(now);
            end.setUTCHours(23, 59, 59, 999);
            break;
    }
    return { startDate: start, endDate: end };
};

// Get single date for daily sales
const getSingleDate = (filter, selectedDate) => {
    const now = new Date();
    let targetDate;

    switch (filter) {
        case "today":
            targetDate = now;
            break;
        case "yesterday":
            targetDate = new Date(now);
            targetDate.setUTCDate(now.getUTCDate() - 1);
            break;
        case "custom":
            if (selectedDate) {
                const [year, month, day] = selectedDate.split('-').map(Number);
                targetDate = new Date(Date.UTC(year, month - 1, day));
            } else {
                targetDate = now;
            }
            break;
        default:
            targetDate = now;
            break;
    }

    const start = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));
    return { startDate: start, endDate: end };
};

// ========== 1. SALES REPORT (DETAILED) ==========
router.get("/sales", async (req, res) => {
    try {
        const { filter = "today", startDate, endDate, orderType = "both" } = req.query;
        const { startDate: start, endDate: end } = getDateRange(filter, startDate, endDate);

        const query = { createdAt: { $gte: start, $lte: end } };
        if (orderType !== "both") query.orderType = orderType;

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .select("orderNumber orderType total createdAt customer deliveryAddress items");

        // Summary
        let totalSales = 0, onlineTotal = 0, offlineTotal = 0, onlineCount = 0, offlineCount = 0;
        const productSales = new Map(); // For product-wise aggregation
        const orderItemsList = []; // For order-wise products

        orders.forEach(order => {
            const orderTotal = order.total || 0;
            totalSales += orderTotal;
            if (order.orderType === "online") {
                onlineTotal += orderTotal;
                onlineCount++;
            } else {
                offlineTotal += orderTotal;
                offlineCount++;
            }

            // Process each item in order
            order.items.forEach(item => {
                const productId = item.productId;
                const productName = item.productName;
                const quantity = item.quantity || 0;
                const revenue = item.totalAmount || (item.price * quantity);

                // Product sales aggregation
                if (!productSales.has(productId)) {
                    productSales.set(productId, {
                        productId,
                        productName,
                        quantitySold: 0,
                        revenue: 0,
                        orderCount: 0
                    });
                }
                const prod = productSales.get(productId);
                prod.quantitySold += quantity;
                prod.revenue += revenue;
                prod.orderCount++;

                // Order-wise products
                orderItemsList.push({
                    orderNumber: order.orderNumber,
                    orderDate: order.createdAt,
                    orderType: order.orderType,
                    customerName: order.orderType === "online" ? order.deliveryAddress?.fullName : order.customer?.name,
                    productName,
                    productId,
                    quantity,
                    price: item.price,
                    total: revenue
                });
            });
        });

        const trend = [];
        const productsSold = Array.from(productSales.values()).sort((a, b) => b.quantitySold - a.quantitySold);

        res.json({
            success: true,
            summary: {
                totalSales,
                orderCount: orders.length,
                averageOrderValue: orders.length > 0 ? totalSales / orders.length : 0,
                onlineSales: onlineTotal,
                offlineSales: offlineTotal,
                onlineOrders: onlineCount,
                offlineOrders: offlineCount
            },
            orders: orders.map(order => ({
                orderNumber: order.orderNumber,
                orderType: order.orderType,
                date: order.createdAt,
                customerName: order.orderType === "online" ? order.deliveryAddress?.fullName : order.customer?.name,
                total: order.total,
                itemsCount: order.items?.length || 0
            })),
            productsSold,
            orderItems: orderItemsList
        });

    } catch (error) {
        console.error("❌ [Sales Report] Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== 2. PURCHASE REPORT (DETAILED - EACH BATCH ADDITION SEPARATELY) ==========
router.get("/purchases", async (req, res) => {
    try {
        const { filter = "today", startDate, endDate } = req.query;
        const { startDate: start, endDate: end } = getDateRange(filter, startDate, endDate);

        const inventoryItems = await Inventory.find({ isActive: true, inventoryType: "batch" });

        let totalPurchases = 0, totalQuantity = 0, batchCount = 0;
        const batchesList = [];

        inventoryItems.forEach(item => {
            if (item.batches && Array.isArray(item.batches)) {
                item.batches.forEach(batch => {
                    const addedDate = batch.addedAt ? new Date(batch.addedAt) : null;
                    if (addedDate && addedDate >= start && addedDate <= end) {
                        const batchTotal = batch.price * batch.quantity;
                        totalPurchases += batchTotal;
                        totalQuantity += batch.quantity;
                        batchCount++;

                        batchesList.push({
                            productName: item.productName,
                            productId: item.productId,
                            batchNumber: batch.batchNumber,
                            price: batch.price,
                            quantityAdded: batch.quantity,
                            totalAmount: batchTotal,
                            addedAt: batch.addedAt,
                            manufactureDate: batch.manufactureDate,
                            expiryDate: batch.expiryDate,
                            status: batch.status
                        });
                    }
                });
            }
        });

        const summary = {
            totalPurchases,
            totalQuantity,
            batchCount,
            averagePurchaseValue: batchCount > 0 ? totalPurchases / batchCount : 0
        };

        res.json({
            success: true,
            summary,
            batches: batchesList.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
        });

    } catch (error) {
        console.error("❌ [Purchase Report] Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== 3. INVENTORY REPORT (WITH BATCH DETAILS) ==========
router.get("/inventory", async (req, res) => {
    try {
        const inventoryItems = await Inventory.find({ isActive: true });

        let totalItems = 0, totalValue = 0, lowStockCount = 0, outOfStockCount = 0;
        const itemsList = [];
        const batchDetails = [];

        inventoryItems.forEach(item => {
            const stock = item.stock || 0;
            const minQty = item.threshold || 10;
            const value = item.totalValue || 0;

            totalItems++;
            totalValue += value;

            let stockStatus = "in-stock";
            if (stock <= 0) {
                stockStatus = "out-of-stock";
                outOfStockCount++;
            } else if (stock <= minQty) {
                stockStatus = "low-stock";
                lowStockCount++;
            }

            itemsList.push({
                inventoryId: item.inventoryId,
                productName: item.productName,
                category: item.category,
                stock: stock,
                threshold: minQty,
                stockStatus: stockStatus,
                value: value,
                inventoryType: item.inventoryType
            });

            // Batch details for batch products
            if (item.inventoryType === "batch" && item.batches) {
                item.batches.forEach(batch => {
                    batchDetails.push({
                        productName: item.productName,
                        productId: item.productId,
                        batchNumber: batch.batchNumber,
                        quantity: batch.quantity,
                        currentQuantity: batch.currentQuantity,
                        price: batch.price,
                        manufactureDate: batch.manufactureDate,
                        expiryDate: batch.expiryDate,
                        addedAt: batch.addedAt,
                        status: batch.status
                    });
                });
            }
        });

        const summary = {
            totalItems,
            totalValue,
            lowStockCount,
            outOfStockCount,
            inStockCount: totalItems - lowStockCount - outOfStockCount
        };

        res.json({
            success: true,
            summary,
            items: itemsList,
            batchDetails: batchDetails.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate))
        });

    } catch (error) {
        console.error("❌ [Inventory Report] Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== 4. EXPIRY REPORT ==========
router.get("/expiry", async (req, res) => {
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setUTCMonth(today.getUTCMonth() + 3);

        const inventoryItems = await Inventory.find({ isActive: true, inventoryType: "batch" });

        const expiringItems = [];
        const expiredItems = [];

        inventoryItems.forEach(item => {
            if (item.batches && Array.isArray(item.batches)) {
                item.batches.forEach(batch => {
                    if (batch.expiryDate) {
                        const expiryDate = new Date(batch.expiryDate);
                        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

                        if (expiryDate < today) {
                            expiredItems.push({
                                productName: item.productName,
                                batchNumber: batch.batchNumber,
                                expiryDate: batch.expiryDate,
                                quantity: batch.currentQuantity || batch.quantity
                            });
                        } else if (expiryDate <= threeMonthsLater) {
                            expiringItems.push({
                                productName: item.productName,
                                batchNumber: batch.batchNumber,
                                expiryDate: batch.expiryDate,
                                quantity: batch.currentQuantity || batch.quantity,
                                daysUntilExpiry: daysUntilExpiry
                            });
                        }
                    }
                });
            }
        });

        res.json({
            success: true,
            summary: {
                expiringCount: expiringItems.length,
                expiredCount: expiredItems.length
            },
            expiringItems: expiringItems.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
            expiredItems: expiredItems.sort((a, b) => new Date(b.expiryDate) - new Date(a.expiryDate))
        });

    } catch (error) {
        console.error("❌ [Expiry Report] Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== 5. TRENDING PRODUCTS (WITH ORDER DETAILS) ==========
router.get("/trending", async (req, res) => {
    try {
        const { filter = "today", startDate, endDate, orderType = "both", limit = 10 } = req.query;
        const { startDate: start, endDate: end } = getDateRange(filter, startDate, endDate);

        const query = { createdAt: { $gte: start, $lte: end } };
        if (orderType !== "both") query.orderType = orderType;

        const orders = await Order.find(query).select("items createdAt orderNumber orderType customer deliveryAddress");

        const productMap = new Map();
        const productOrderDetails = [];

        orders.forEach(order => {
            order.items.forEach(item => {
                const productId = item.productId;
                const productName = item.productName;
                const quantity = item.quantity || 0;
                const revenue = item.totalAmount || (item.price * quantity);

                if (!productMap.has(productId)) {
                    productMap.set(productId, {
                        productId,
                        productName,
                        totalSold: 0,
                        totalRevenue: 0,
                        orderCount: 0
                    });
                }
                const product = productMap.get(productId);
                product.totalSold += quantity;
                product.totalRevenue += revenue;
                product.orderCount++;

                productOrderDetails.push({
                    productName,
                    productId,
                    orderNumber: order.orderNumber,
                    orderDate: order.createdAt,
                    orderType: order.orderType,
                    customerName: order.orderType === "online" ? order.deliveryAddress?.fullName : order.customer?.name,
                    quantity,
                    revenue,
                    price: item.price
                });
            });
        });

        const products = Array.from(productMap.values());
        const byQuantity = [...products].sort((a, b) => b.totalSold - a.totalSold).slice(0, parseInt(limit));
        const byRevenue = [...products].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, parseInt(limit));

        res.json({
            success: true,
            summary: {
                totalProductsSold: products.reduce((sum, p) => sum + p.totalSold, 0),
                totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
                uniqueProducts: products.length
            },
            byQuantity,
            byRevenue,
            productOrderDetails: productOrderDetails.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
        });

    } catch (error) {
        console.error("❌ [Trending Products] Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== 6. DAILY SALES (WITH ORDER ITEMS) ==========
router.get("/daily-sales", async (req, res) => {
    try {
        const { filter = "today", selectedDate, orderType = "both" } = req.query;
        const { startDate: start, endDate: end } = getSingleDate(filter, selectedDate);

        const query = { createdAt: { $gte: start, $lte: end } };
        if (orderType !== "both") query.orderType = orderType;

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .select("orderNumber orderType total createdAt customer deliveryAddress items");

        let totalSales = 0, onlineTotal = 0, offlineTotal = 0, onlineCount = 0, offlineCount = 0;
        const hourlyData = {};
        for (let i = 0; i < 24; i++) {
            hourlyData[i] = { hour: i, online: 0, offline: 0, total: 0 };
        }

        const orderItemsList = [];

        orders.forEach(order => {
            const orderTotal = order.total || 0;
            totalSales += orderTotal;

            const hour = new Date(order.createdAt).getUTCHours();

            if (order.orderType === "online") {
                onlineTotal += orderTotal;
                onlineCount++;
                hourlyData[hour].online += orderTotal;
            } else {
                offlineTotal += orderTotal;
                offlineCount++;
                hourlyData[hour].offline += orderTotal;
            }
            hourlyData[hour].total += orderTotal;

            // Add order items for detailed export
            order.items.forEach(item => {
                orderItemsList.push({
                    orderNumber: order.orderNumber,
                    orderTime: order.createdAt,
                    orderType: order.orderType,
                    customerName: order.orderType === "online" ? order.deliveryAddress?.fullName : order.customer?.name,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.totalAmount || (item.price * item.quantity)
                });
            });
        });

        const hourly = Object.values(hourlyData);

        const summary = {
            date: start.toISOString().split('T')[0],
            totalSales,
            orderCount: orders.length,
            averageOrderValue: orders.length > 0 ? totalSales / orders.length : 0,
            onlineSales: onlineTotal,
            offlineSales: offlineTotal,
            onlineOrders: onlineCount,
            offlineOrders: offlineCount
        };

        res.json({
            success: true,
            summary,
            hourly,
            orders: orders.map(order => ({
                orderNumber: order.orderNumber,
                orderType: order.orderType,
                time: order.createdAt,
                customerName: order.orderType === "online" ? order.deliveryAddress?.fullName : order.customer?.name,
                total: order.total,
                itemsCount: order.items?.length || 0
            })),
            orderItems: orderItemsList
        });

    } catch (error) {
        console.error("❌ [Daily Sales] Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;