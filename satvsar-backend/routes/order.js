// routes/orderRoutes.js - UNIFIED ORDER ROUTES (ALL ROUTE NAMES KEPT SAME)
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../modals/Orders");
const GlobalCounter = require("../modals/globalCounter");
const Inventory = require("../modals/Inventory");
const DeletedOrder = require("../modals/deletedOrderModel");
const ProductOffer = require("../modals/ProductOffers"); // ✅ ADDED
const { auth } = require("../middleware/auth");
const User = require("../modals/User");
const Cart = require("../modals/Cart");  // Add this line with other imports
const ProductStockHistory = require("../modals/ProductStockHistory");

// Check if offer is valid
function isOfferValid(offer) {
    if (!offer || !offer.isActive) return false;

    const now = new Date();
    if (offer.startDate > now) return false;
    if (!offer.endDate) return true;

    return now >= offer.startDate && now <= offer.endDate;
}

// Calculate tax (5% INCLUDED in price)
function calculateTaxIncluded(priceWithTax) {
    const taxRate = 5; // 5%
    const taxAmount = (priceWithTax * taxRate) / (100 + taxRate);
    const baseValue = priceWithTax - taxAmount;
    const cgst = taxAmount / 2;
    const sgst = taxAmount / 2;

    return {
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        baseValue: parseFloat(baseValue.toFixed(2)),
        cgst: parseFloat(cgst.toFixed(2)),
        sgst: parseFloat(sgst.toFixed(2)),
        taxRate: taxRate
    };
}

// ======================================================================
// SECTION 1: ONLINE/E-COMMERCE ROUTES
// ======================================================================

// 📦 CREATE ONLINE ORDER (UPDATED VERSION WITH EMAIL, CUSTOMER DETAILS & CART CLEARING)
router.post('/create', auth, async (req, res) => {
    const startTime = Date.now();
    const requestId = `ONLINE_ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        console.log(`🛒 [${requestId}] Starting ONLINE order creation`);

        const {
            userId,
            checkoutMode = 'cart',
            items,
            address,
            paymentMethod = 'cod'
        } = req.body;

        console.log(`📥 [${requestId}] Request data:`, {
            userId,
            checkoutMode,
            itemsCount: items?.length || 0,
            hasAddress: !!address,
            paymentMethod
        });

        // 🛡️ VALIDATION
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID required',
                requestId
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No items to order',
                requestId
            });
        }

        if (!address || !address.addressId) {
            return res.status(400).json({
                success: false,
                message: 'Delivery address required',
                requestId
            });
        }

        // 🛡️ STEP 1: FETCH USER DATA FROM USER MODEL
        console.log(`👤 [${requestId}] Fetching user data for online order...`);

        let userData = null;
        try {
            const User = mongoose.model('User');
            userData = await User.findOne({ userId: userId });

            if (!userData) {
                console.warn(`⚠️ [${requestId}] User not found in User model: ${userId}`);
            } else {
                console.log(`✅ [${requestId}] User data fetched:`, {
                    userId: userData.userId,
                    name: userData.name,
                    email: userData.email,
                    mobile: userData.mobile
                });
            }
        } catch (userError) {
            console.error(`❌ [${requestId}] Error fetching user data:`, userError.message);
        }

        // 🛡️ STEP 2: FETCH PRODUCT DETAILS AND EXTRA OFFERS FROM DATABASE
        console.log(`🔍 [${requestId}] Fetching product details and extra offers...`);

        const Product = mongoose.model('Product');
        const validatedItems = [];

        for (const item of items) {
            const product = await Product.findOne({ productId: item.productId });
            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: `Product not found: ${item.productId}`,
                    requestId
                });
            }

            const selectedColor = product.colors?.find(c => c.colorId === item.selectedColor?.colorId) || product.colors?.[0];
            if (!selectedColor) {
                return res.status(400).json({
                    success: false,
                    message: `Color not found for product: ${item.productId}`,
                    requestId
                });
            }

            const currentPrice = selectedColor.currentPrice;

            const extraOffer = await ProductOffer.findOne({
                productId: item.productId,
                colorId: selectedColor.colorId,
                isActive: true,
                startDate: { $lte: new Date() },
                $or: [{ endDate: null }, { endDate: { $gte: new Date() } }]
            });

            const hasExtraOffer = extraOffer && isOfferValid(extraOffer);

            let finalPrice = currentPrice;
            let extraOfferPercentage = 0;
            let extraDiscountAmount = 0;

            if (hasExtraOffer) {
                extraOfferPercentage = extraOffer.offerPercentage;
                extraDiscountAmount = (currentPrice * extraOfferPercentage) / 100;
                finalPrice = currentPrice - extraDiscountAmount;
            }

            const priceWithTaxForOne = finalPrice;
            const totalPriceWithTax = priceWithTaxForOne * item.quantity;
            const taxCalculation = calculateTaxIncluded(totalPriceWithTax);

            const originalMRP = selectedColor.originalPrice || currentPrice;
            const totalSavingsPerItem = (originalMRP - finalPrice) * item.quantity;

            validatedItems.push({
                productId: item.productId,
                productName: product.productName,
                barcode: item.barcode || "",
                hsn: product.hsnCode || "",
                category: product.categoryName || "",
                colorId: selectedColor.colorId,
                colorName: selectedColor.colorName,
                modelId: item.selectedModel?.modelId || "",
                modelName: item.selectedModel?.modelName || product.modelName || "Default",
                size: item.selectedSize || "",
                thumbnailImage: selectedColor.images?.[0] || product.thumbnailImage || "",
                quantity: item.quantity,
                originalMRP: originalMRP,
                currentPrice: currentPrice,
                finalPrice: finalPrice,
                extraOfferPercentage: extraOfferPercentage,
                extraDiscountAmount: extraDiscountAmount,
                priceWithTax: priceWithTaxForOne,
                totalPriceWithTax: totalPriceWithTax,
                baseValue: taxCalculation.baseValue,
                taxAmount: taxCalculation.taxAmount,
                taxRate: taxCalculation.taxRate,
                cgst: taxCalculation.cgst,
                sgst: taxCalculation.sgst,
                savedAmount: totalSavingsPerItem,
                hasExtraOffer: hasExtraOffer,
                extraOfferId: extraOffer?._id || null,
                extraOfferLabel: extraOffer?.offerLabel || null,
                purchasedFromStock: 0,
                inventoryId: null,
                status: 'pending'
            });
        }

        // 🛡️ STEP 3: VALIDATE INVENTORY FOR ALL ITEMS
        console.log(`🔍 [${requestId}] Validating inventory...`);

        const inventoryValidationResults = [];

        for (const validatedItem of validatedItems) {
            const inventoryItem = await Inventory.findOne({ productId: validatedItem.productId });

            if (!inventoryItem) {
                return res.status(400).json({
                    success: false,
                    message: `Product not found in inventory: ${validatedItem.productName}`,
                    requestId
                });
            }

            let availableStock = 0;
            let batchToUse = null;

            if (inventoryItem.inventoryType === "batch") {
                const currentDate = new Date();
                const activeBatches = inventoryItem.batches.filter(batch =>
                    batch.status === "active" &&
                    new Date(batch.expiryDate) > currentDate &&
                    batch.currentQuantity > 0
                ).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

                availableStock = activeBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);

                if (availableStock < validatedItem.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${validatedItem.productName}. Available: ${availableStock}, Requested: ${validatedItem.quantity}`,
                        requestId
                    });
                }

                batchToUse = activeBatches[0];
            } else {
                availableStock = inventoryItem.stock;

                if (availableStock < validatedItem.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${validatedItem.productName}. Available: ${availableStock}, Requested: ${validatedItem.quantity}`,
                        requestId
                    });
                }
            }

            inventoryValidationResults.push({
                ...validatedItem,
                inventoryItem: inventoryItem,
                batchToUse: batchToUse,
                availableStock: availableStock
            });
        }

        // 🛡️ STEP 4: GENERATE ORDER NUMBER
        const orderNumber = await Order.generateOrderNumber();

        // 🛡️ STEP 5: CALCULATE ORDER TOTALS
        let subtotal = 0;
        let totalDiscount = 0;
        let totalSavings = 0;
        let totalBaseValue = 0;
        let totalTax = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalFinalPrice = 0;

        const orderItems = [];

        for (const item of inventoryValidationResults) {
            subtotal += item.currentPrice * item.quantity;
            totalDiscount += item.extraDiscountAmount * item.quantity;
            totalSavings += item.savedAmount;
            totalBaseValue += item.baseValue;
            totalTax += item.taxAmount;
            totalCgst += item.cgst;
            totalSgst += item.sgst;
            totalFinalPrice += item.totalPriceWithTax;

            orderItems.push({
                productId: item.productId,
                productName: item.productName,
                barcode: item.barcode,
                hsn: item.hsn,
                category: item.category,
                colorId: item.colorId,
                colorName: item.colorName,
                modelId: item.modelId,
                modelName: item.modelName,
                size: item.size,
                thumbnailImage: item.thumbnailImage,
                batchNumber: item.batchToUse?.batchNumber || "SIMPLE",
                expiryDate: item.batchToUse?.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                quantity: item.quantity,
                originalMRP: item.originalMRP,
                currentPrice: item.currentPrice,
                price: item.finalPrice,
                finalPriceWithTax: item.priceWithTax,
                discount: item.extraOfferPercentage,
                offerPercentage: item.extraOfferPercentage,
                discountAmount: item.extraDiscountAmount,
                extraOfferPercentage: item.extraOfferPercentage,
                extraDiscountAmount: item.extraDiscountAmount,
                hasExtraOffer: item.hasExtraOffer,
                extraOfferId: item.extraOfferId,
                extraOfferLabel: item.extraOfferLabel,
                taxRate: item.taxRate,
                taxSlab: item.taxRate,
                baseValue: item.baseValue,
                taxAmount: item.taxAmount,
                cgstAmount: item.cgst,
                sgstAmount: item.sgst,
                cgst: item.cgst,
                sgst: item.sgst,
                totalAmount: item.totalPriceWithTax,
                savedAmount: item.savedAmount,
                purchasedFromStock: item.availableStock,
                inventoryId: item.inventoryItem._id.toString(),
                status: 'pending'
            });
        }

        const taxPercentages = [...new Set(orderItems.map(item => item.taxRate || item.taxSlab))];
        const hasMixedTaxRates = taxPercentages.length > 1;
        const shipping = 0;
        const total = totalFinalPrice;

        // 🛡️ STEP 6: CREATE ORDER DOCUMENT
        const orderData = {
            orderNumber,
            date: new Date(),
            orderType: 'online',
            userId,
            checkoutMode,
            items: orderItems,
            deliveryAddress: {
                addressId: address.addressId,
                fullName: address.fullName,
                mobile: address.mobile,
                email: address.email || "",
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2 || "",
                landmark: address.landmark || "",
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                country: address.country || "India",
                addressType: address.addressType || "home",
                instructions: address.instructions || "",
                isDefault: address.isDefault || false
            },
            customer: userData ? {
                customerId: userData.userId,
                customerNumber: "",
                name: userData.name || "",
                email: userData.email || "",
                mobile: userData.mobile || "",
                gstNumber: "",
                address: ""
            } : {
                customerId: userId,
                customerNumber: "",
                name: address.fullName || "",
                email: address.email || "",
                mobile: address.mobile || "",
                gstNumber: "",
                address: ""
            },
            subtotal: parseFloat(subtotal.toFixed(2)),
            discount: parseFloat(totalDiscount.toFixed(2)),
            totalDiscount: parseFloat(totalDiscount.toFixed(2)),
            totalSavings: parseFloat(totalSavings.toFixed(2)),
            baseValue: parseFloat(totalBaseValue.toFixed(2)),
            tax: parseFloat(totalTax.toFixed(2)),
            cgst: parseFloat(totalCgst.toFixed(2)),
            sgst: parseFloat(totalSgst.toFixed(2)),
            taxPercentage: taxPercentages[0] || 5,
            taxRate: taxPercentages[0] || 5,
            taxPercentages: taxPercentages,
            hasMixedTaxRates: hasMixedTaxRates,
            shipping: parseFloat(shipping.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            payment: {
                method: paymentMethod,
                status: paymentMethod === 'cod' ? 'pending' : 'paid'
            },
            orderStatus: 'pending',
            timeline: {
                placedAt: new Date(),
                estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            }
        };

        const newOrder = new Order(orderData);
        await newOrder.save();

        // 🗑️ CLEAR USER'S CART
        if (checkoutMode === 'cart' && userId) {
            try {
                const Cart = require("../modals/Cart");
                const deletedCount = await Cart.deleteMany({ userId: userId });
                console.log(`🗑️ [${requestId}] Cleared ${deletedCount.deletedCount} items from cart for user: ${userId}`);
            } catch (cartError) {
                console.error(`⚠️ [${requestId}] Failed to clear cart:`, cartError.message);
            }
        }

        // 📧 SEND ORDER CONFIRMATION EMAIL
        try {
            const user = await User.findOne({ userId: userId });
            if (user && user.email) {
                const emailData = {
                    orderNumber: newOrder.orderNumber,
                    customerName: orderData.deliveryAddress.fullName,
                    orderDate: newOrder.date,
                    orderStatus: newOrder.orderStatus,
                    items: orderItems.map(item => ({
                        productName: item.productName,
                        price: item.finalPriceWithTax,
                        quantity: item.quantity,
                        total: item.totalAmount,
                        hasExtraOffer: item.hasExtraOffer || false,
                        discount: item.discount || 0,
                        discountAmount: item.discountAmount || 0
                    })),
                    subtotal: newOrder.subtotal,
                    totalDiscount: newOrder.totalDiscount,
                    tax: newOrder.tax,
                    total: newOrder.total,
                    deliveryAddress: orderData.deliveryAddress,
                    estimatedDelivery: newOrder.timeline.estimatedDelivery
                };

                const { sendOrderEmail } = require('../config/userEmail');
                sendOrderEmail('orderConfirmation', user.email, emailData)
                    .then(result => {
                        if (result.success) {
                            console.log(`📧 Order confirmation email sent to ${user.email} for order ${newOrder.orderNumber}`);
                        }
                    })
                    .catch(err => {
                        console.error(`❌ Error sending order confirmation email:`, err.message);
                    });
            }
        } catch (emailError) {
            console.error(`❌ Error preparing order confirmation email:`, emailError.message);
        }

        // 🛡️ STEP 8: UPDATE INVENTORY AND PRODUCT STOCK HISTORY
        const ProductStockHistory = require("../modals/ProductStockHistory");
        const inventoryUpdates = [];

        for (const item of inventoryValidationResults) {
            const inventoryItem = item.inventoryItem;
            const oldStock = item.batchToUse?.currentQuantity || inventoryItem.stock;
            let newStock;

            if (inventoryItem.inventoryType === "batch" && item.batchToUse) {
                item.batchToUse.currentQuantity -= item.quantity;
                newStock = item.batchToUse.currentQuantity;
                if (item.batchToUse.currentQuantity === 0) {
                    item.batchToUse.status = "sold-out";
                }
            } else {
                inventoryItem.stock -= item.quantity;
                newStock = inventoryItem.stock;
            }

            // ✅ UPDATE PRODUCT STOCK HISTORY (NEW WAY)
            let productStockDoc = await ProductStockHistory.findOne({
                productId: item.productId
            });

            if (!productStockDoc) {
                productStockDoc = new ProductStockHistory({
                    productId: item.productId,
                    productName: item.productName,
                    inventoryId: inventoryItem._id,
                    batches: []
                });
            }

            // Find or create batch entry
            let batchEntry = productStockDoc.batches.find(b => b.batchNumber === (item.batchToUse?.batchNumber || "SIMPLE"));
            if (!batchEntry) {
                batchEntry = {
                    batchId: require('uuid').v4(),
                    batchNumber: item.batchToUse?.batchNumber || "SIMPLE",
                    currentStock: 0,
                    history: []
                };
                productStockDoc.batches.push(batchEntry);
                batchEntry = productStockDoc.batches[productStockDoc.batches.length - 1];
            }

            // Update current stock
            batchEntry.currentStock = newStock;

            // Add movement to history
            batchEntry.history.push({
                movementId: require('uuid').v4(),
                type: "deducted",
                quantity: item.quantity,
                previousStock: oldStock,
                newStock: newStock,
                orderNumber: orderNumber,
                orderType: "online",
                reason: `Sold in online order ${orderNumber}`,
                notes: `Customer: ${orderData.deliveryAddress.fullName}`,
                addedBy: "ecommerce_system",
                date: new Date()
            });

            await productStockDoc.save();

            // ✅ Keep inventory stockHistory ONLY for inventory operations (NO order entries!)
            // We are NOT pushing to inventory.stockHistory anymore for orders

            inventoryUpdates.push(inventoryItem.save());
        }

        await Promise.all(inventoryUpdates);

        const processingTime = Date.now() - startTime;

        console.log(`🎉 [${requestId}] ONLINE order created successfully!`, {
            orderNumber,
            itemsCount: newOrder.items.length,
            totalAmount: newOrder.total,
            totalDiscount: newOrder.totalDiscount,
            processingTime: `${processingTime}ms`
        });

        res.status(201).json({
            success: true,
            message: "Online order created successfully",
            order: {
                orderId: newOrder._id,
                orderNumber: newOrder.orderNumber,
                customer: newOrder.deliveryAddress.fullName,
                customerDetails: newOrder.customer,
                items: newOrder.items.map(item => ({
                    productName: item.productName,
                    hsn: item.hsn,
                    category: item.category,
                    quantity: item.quantity,
                    originalMRP: item.originalMRP,
                    currentPrice: item.currentPrice,
                    finalPrice: item.price,
                    discount: item.discount,
                    discountAmount: item.discountAmount,
                    hasExtraOffer: item.hasExtraOffer,
                    extraOfferPercentage: item.extraOfferPercentage,
                    total: item.totalAmount,
                    image: item.thumbnailImage
                })),
                pricing: {
                    subtotal: newOrder.subtotal,
                    totalDiscount: newOrder.totalDiscount,
                    totalSavings: newOrder.totalSavings,
                    tax: newOrder.tax,
                    taxRate: newOrder.taxRate,
                    shipping: newOrder.shipping,
                    total: newOrder.total
                },
                deliveryAddress: newOrder.deliveryAddress,
                status: newOrder.orderStatus,
                estimatedDelivery: newOrder.timeline.estimatedDelivery
            },
            requestId,
            processingTime: `${processingTime}ms`
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`💥 [${requestId}] Error creating online order:`, error);
        res.status(500).json({
            success: false,
            message: "Failed to create online order",
            error: error.message,
            requestId,
            processingTime: `${processingTime}ms`
        });
    }
});



// 📋 GET USER'S ONLINE ORDERS
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            page = 1,
            limit = 10,
            status
        } = req.query;

        const query = {
            userId,
            orderType: 'online'
        };

        if (status && status !== 'all') {
            query.orderStatus = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(query);

        // Calculate summary
        const summary = {
            totalOrders: total,
            pendingOrders: await Order.countDocuments({ userId, orderType: 'online', orderStatus: 'pending' }),
            deliveredOrders: await Order.countDocuments({ userId, orderType: 'online', orderStatus: 'delivered' }),
            cancelledOrders: await Order.countDocuments({ userId, orderType: 'online', orderStatus: 'cancelled' })
        };

        res.json({
            success: true,
            orders,
            summary,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

// 🔍 GET SINGLE ORDER BY ORDER NUMBER (FOR ONLINE)
router.get('/:orderNumber', auth, async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const order = await Order.findOne({ orderNumber });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            order
        });

    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order'
        });
    }
});

// 📊 GET ORDER STATS SUMMARY (ONLINE USER)
router.get('/stats/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;

        const stats = await Order.aggregate([
            {
                $match: {
                    userId,
                    orderType: 'online'
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: "$total" },
                    pendingOrders: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "pending"] }, 1, 0] }
                    },
                    processingOrders: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "processing"] }, 1, 0] }
                    },
                    shippedOrders: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "shipped"] }, 1, 0] }
                    },
                    deliveredOrders: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] }
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            totalOrders: 0,
            totalSpent: 0,
            pendingOrders: 0,
            processingOrders: 0,
            shippedOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0
        };

        // Calculate monthly stats
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const monthlyStats = await Order.aggregate([
            {
                $match: {
                    userId,
                    orderType: 'online',
                    createdAt: {
                        $gte: new Date(currentYear, currentMonth, 1),
                        $lt: new Date(currentYear, currentMonth + 1, 1)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    monthlyOrders: { $sum: 1 },
                    monthlySpent: { $sum: "$total" }
                }
            }
        ]);

        const monthlyResult = monthlyStats[0] || {
            monthlyOrders: 0,
            monthlySpent: 0
        };

        res.json({
            success: true,
            stats: {
                ...result,
                ...monthlyResult,
                averageOrderValue: result.totalOrders > 0
                    ? (result.totalSpent / result.totalOrders).toFixed(2)
                    : 0
            }
        });

    } catch (error) {
        console.error('Error fetching order stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order stats'
        });
    }
});

// ✏️ UPDATE ORDER STATUS (user cancellation) - WITH PDF ATTACHMENT FOR SHIPPED/DELIVERED
router.put('/:orderNumber/status', auth, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const order = await Order.findOne({ orderNumber });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Store old status for comparison
        const oldStatus = order.orderStatus;

        // Update status
        order.orderStatus = status;

        // Update timeline
        const now = new Date();
        if (status === 'cancelled') {
            order.timeline.cancelledAt = now;

            // Restore stock if cancelled
            for (const item of order.items) {
                const inventory = await Inventory.findOne({ productId: item.productId });
                if (inventory) {
                    const batch = inventory.batches.find(b => b.batchNumber === item.batchNumber);
                    if (batch) {
                        batch.quantity += item.quantity;
                        await inventory.save();
                    }
                }
            }
        } else if (status === 'delivered') {
            order.timeline.deliveredAt = now;
            order.payment.status = 'paid';
            order.payment.paymentDate = now;
            order.payment.paidAmount = order.total;
        } else if (status === 'shipped') {
            order.timeline.shippedAt = now;
        } else if (status === 'processing') {
            order.timeline.processingAt = now;
        }

        await order.save();

        // ==================== 📧 SEND STATUS UPDATE EMAIL WITH PDF ATTACHMENT ====================
        // Only send email if status actually changed and order is online
        if (oldStatus !== status && order.orderType === 'online') {
            try {
                // Get user email
                let userEmail = null;
                let customerName = '';

                if (order.userId) {
                    const user = await User.findOne({ userId: order.userId });
                    if (user && user.email) {
                        userEmail = user.email;
                        customerName = user.name || order.deliveryAddress?.fullName || 'Customer';
                    }
                }

                // If no user found, use delivery address email
                if (!userEmail && order.deliveryAddress?.email) {
                    userEmail = order.deliveryAddress.email;
                    customerName = order.deliveryAddress.fullName || 'Customer';
                }

                if (userEmail) {
                    // Prepare timeline steps for email
                    const timelineSteps = [
                        { title: 'Order Placed', status: 'completed', date: order.timeline.placedAt },
                        {
                            title: 'Processing', status: order.orderStatus === 'processing' || ['shipped', 'delivered'].includes(order.orderStatus) ? 'completed' :
                                order.orderStatus === 'cancelled' ? 'skipped' : 'pending',
                            date: order.timeline.processingAt
                        },
                        {
                            title: 'Shipped', status: order.orderStatus === 'shipped' || order.orderStatus === 'delivered' ? 'completed' :
                                order.orderStatus === 'cancelled' ? 'skipped' : 'pending',
                            date: order.timeline.shippedAt
                        },
                        {
                            title: 'Delivered', status: order.orderStatus === 'delivered' ? 'completed' :
                                order.orderStatus === 'cancelled' ? 'skipped' : 'pending',
                            date: order.timeline.deliveredAt
                        }
                    ];

                    // Mark current status
                    if (order.orderStatus !== 'cancelled') {
                        const currentStepIndex = timelineSteps.findIndex(step =>
                            step.title.toLowerCase() === order.orderStatus
                        );
                        if (currentStepIndex >= 0) {
                            timelineSteps[currentStepIndex].status = 'current';
                        }
                    }

                    // Status messages
                    const statusMessages = {
                        'pending': 'Your order has been received and is awaiting confirmation.',
                        'processing': 'Your order is being prepared for shipment.',
                        'shipped': 'Your order has been shipped and is on its way to you!',
                        'delivered': 'Your order has been delivered. We hope you enjoy your purchase!',
                        'cancelled': 'Your order has been cancelled as requested.'
                    };

                    const emailData = {
                        orderNumber: order.orderNumber,
                        customerName: customerName,
                        orderDate: order.date || order.createdAt,
                        newStatus: status,
                        oldStatus: oldStatus,
                        statusMessage: statusMessages[status] || `Your order status has been updated to ${status}.`,
                        total: order.total,
                        timelineSteps: timelineSteps,
                        trackingNumber: order.trackingNumber || null
                    };

                    // ✅✅✅ GENERATE PDF FOR SHIPPED AND DELIVERED STATUS
                    let pdfBuffer = null;
                    if (status === 'shipped' || status === 'delivered') {
                        try {
                            const { generateInvoicePDF } = require('../services/pdfGenerator');
                            pdfBuffer = await generateInvoicePDF(order);
                            console.log(`📄 PDF generated for order ${order.orderNumber} (${status})`);
                        } catch (pdfError) {
                            console.error(`❌ Failed to generate PDF for order ${order.orderNumber}:`, pdfError.message);
                            // Continue without PDF - don't fail the email
                        }
                    }

                    // Send email with PDF attachment if available
                    const { sendOrderEmailWithAttachment } = require('../config/userEmail');
                    await sendOrderEmailWithAttachment('orderStatusUpdate', userEmail, emailData, pdfBuffer);

                    console.log(`📧 Status update email sent to ${userEmail} for order ${order.orderNumber} (${oldStatus} → ${status})${pdfBuffer ? ' with PDF attachment' : ''}`);
                } else {
                    console.log(`ℹ️ No email found for order ${order.orderNumber}, skipping status update email`);
                }
            } catch (emailError) {
                console.error(`❌ Error preparing status update email:`, emailError.message);
                // Don't fail the status update if email fails
            }
        }

        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            order: order.getSummary()
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
});

// ❌ CANCEL ORDER (user request)
router.put('/:orderNumber/cancel', auth, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const { reason } = req.body;

        console.log(`🔄 [CANCEL] Cancelling order: ${orderNumber}`);

        const order = await Order.findOne({ orderNumber });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (!['pending', 'processing'].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order in ${order.orderStatus} status`
            });
        }

        order.orderStatus = 'cancelled';
        order.timeline.cancelledAt = new Date();
        order.notes = reason ? `Cancelled by user: ${reason}` : 'Cancelled by user';

        // ========== RESTORE STOCK AND UPDATE PRODUCT STOCK HISTORY ==========
        const ProductStockHistory = require("../modals/ProductStockHistory");

        for (const item of order.items) {
            const inventory = await Inventory.findOne({ productId: item.productId });

            if (inventory) {
                const batch = inventory.batches.find(b => b.batchNumber === item.batchNumber);

                if (batch) {
                    const beforeQuantity = batch.currentQuantity;

                    batch.quantity += item.quantity;
                    batch.currentQuantity += item.quantity;

                    if (batch.status === "sold-out" && batch.currentQuantity > 0) {
                        batch.status = "active";
                    }

                    const newQuantity = batch.currentQuantity;

                    // ✅ UPDATE PRODUCT STOCK HISTORY (RESTORE ENTRY)
                    let productStockDoc = await ProductStockHistory.findOne({
                        productId: item.productId
                    });

                    if (!productStockDoc) {
                        productStockDoc = new ProductStockHistory({
                            productId: item.productId,
                            productName: item.productName,
                            inventoryId: inventory._id,
                            batches: []
                        });
                    }

                    let batchEntry = productStockDoc.batches.find(b => b.batchNumber === item.batchNumber);
                    if (!batchEntry) {
                        batchEntry = {
                            batchId: require('uuid').v4(),
                            batchNumber: item.batchNumber,
                            currentStock: 0,
                            history: []
                        };
                        productStockDoc.batches.push(batchEntry);
                        batchEntry = productStockDoc.batches[productStockDoc.batches.length - 1];
                    }

                    batchEntry.currentStock = newQuantity;

                    batchEntry.history.push({
                        movementId: require('uuid').v4(),
                        type: "restored",
                        quantity: item.quantity,
                        previousStock: beforeQuantity,
                        newStock: newQuantity,
                        orderNumber: orderNumber,
                        orderType: order.orderType,
                        reason: `Order ${orderNumber} cancelled by user`,
                        notes: reason || "User requested cancellation",
                        addedBy: "system",
                        date: new Date()
                    });

                    await productStockDoc.save();

                    // ❌ NO LONGER pushing to inventory.stockHistory for cancellations
                    await inventory.save();

                    console.log(`✅ [CANCEL] Restored ${item.quantity} units of ${item.productName} (Batch: ${item.batchNumber})`);
                }
            }
        }

        await order.save();

        console.log(`✅ [CANCEL] Order ${orderNumber} cancelled successfully with stock restored`);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order: order.getSummary()
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    }
});

// 🎯 GET RECENT ORDERS (for dashboard)
router.get('/recent/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 5 } = req.query;

        const recentOrders = await Order.find({
            userId,
            orderType: 'online'
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .select('orderNumber createdAt total orderStatus items');

        res.json({
            success: true,
            orders: recentOrders
        });

    } catch (error) {
        console.error('Error fetching recent orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent orders'
        });
    }
});

// 👑 ADMIN: GET ALL ORDERS (with filters and pagination)
router.get('/all/orders', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 40,
            status,
            userId,
            startDate,
            endDate,
            orderType,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};

        // Filter by order type
        if (orderType && orderType !== 'all') {
            query.orderType = orderType;
        }

        // Filter by status
        if (status && status !== 'all') {
            query.orderStatus = status;
        }

        // Filter by user ID
        if (userId) {
            query.userId = userId;
        }

        // Filter by date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        // Get orders with pagination
        const orders = await Order.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await Order.countDocuments(query);

        // ✅ UPDATED STATS - EXCLUDING CANCELLED ORDERS FROM REVENUE
        const stats = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$orderStatus", "cancelled"] },
                                0,  // ❌ CANCELLED ORDERS = ₹0 for revenue
                                "$total"
                            ]
                        }
                    },
                    totalItems: { $sum: { $size: "$items" } },
                    totalQuantity: {
                        $sum: {
                            $reduce: {
                                input: "$items",
                                initialValue: 0,
                                in: { $add: ["$$value", "$$this.quantity"] }
                            }
                        }
                    },
                    avgOrderValue: {
                        $avg: {
                            $cond: [
                                { $eq: ["$orderStatus", "cancelled"] },
                                null,  // ❌ EXCLUDE cancelled from average
                                "$total"
                            ]
                        }
                    }
                }
            }
        ]);

        // Get status breakdown (still includes cancelled for counting)
        const statusBreakdown = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$orderStatus", "cancelled"] },
                                0,  // ❌ CANCELLED = ₹0 in status amounts
                                "$total"
                            ]
                        }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get top products
        const topProducts = await Order.aggregate([
            { $match: query },
            { $unwind: "$items" },
            {
                $group: {
                    _id: {
                        productId: "$items.productId",
                        productName: "$items.productName"
                    },
                    totalSold: { $sum: "$items.quantity" },
                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$orderStatus", "cancelled"] },
                                0,  // ❌ CANCELLED products don't count in revenue
                                "$items.totalAmount"
                            ]
                        }
                    }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            orders,
            stats: {
                ...(stats[0] || {
                    totalOrders: 0,
                    totalRevenue: 0,
                    totalItems: 0,
                    totalQuantity: 0,
                    avgOrderValue: 0
                }),
                statusBreakdown,
                topProducts
            },
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            filters: {
                orderType,
                status,
                userId,
                startDate,
                endDate,
                sortBy,
                sortOrder
            }
        });

    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});

// ======================================================================
// SECTION 2: OFFLINE/BILLING ROUTES (EXACT SAME NAMES AS BEFORE)
// ======================================================================

// 🧾 CREATE OFFLINE ORDER (from billing software)
router.post("/create-invoice", async (req, res) => {
    const startTime = Date.now();
    const requestId = `OFFLINE_ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        console.log(`🏪 [${requestId}] Starting OFFLINE order creation (invoice)`);

        if (!req.body.items || req.body.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Order must contain at least one item",
                requestId: requestId
            });
        }

        if (!req.body.customer || !req.body.customer.mobile || !req.body.customer.name) {
            return res.status(400).json({
                success: false,
                message: "Customer name and mobile are required",
                requestId: requestId
            });
        }

        let invoiceDate;
        if (req.body.date) {
            invoiceDate = new Date(req.body.date);
            if (isNaN(invoiceDate.getTime())) {
                invoiceDate = new Date();
            }
        } else {
            invoiceDate = new Date();
        }

        // 🛡️ STEP 2: Validate ALL inventory items
        const inventoryValidation = [];

        for (const [index, item] of req.body.items.entries()) {
            if (!item.productId || !item.batchNumber || !item.quantity || item.quantity < 1) {
                inventoryValidation.push({
                    productId: item.productId,
                    productName: item.name,
                    error: "Invalid item data"
                });
                continue;
            }

            const inventoryItem = await Inventory.findOne({ productId: item.productId });

            if (!inventoryItem) {
                inventoryValidation.push({
                    productId: item.productId,
                    productName: item.name,
                    batchNumber: item.batchNumber,
                    error: "Product not found in inventory"
                });
                continue;
            }

            const batch = inventoryItem.batches.find(b => b.batchNumber === item.batchNumber);

            if (!batch) {
                inventoryValidation.push({
                    productId: item.productId,
                    productName: item.name,
                    batchNumber: item.batchNumber,
                    error: "Batch not found",
                    availableBatches: inventoryItem.batches.map(b => b.batchNumber)
                });
                continue;
            }

            const isExpired = new Date(batch.expiryDate) < new Date();
            if (isExpired) {
                inventoryValidation.push({
                    productId: item.productId,
                    productName: item.name,
                    batchNumber: item.batchNumber,
                    error: "Batch has expired",
                    expiryDate: batch.expiryDate
                });
                continue;
            }

            if (batch.currentQuantity < item.quantity) {
                inventoryValidation.push({
                    productId: item.productId,
                    productName: item.name,
                    batchNumber: item.batchNumber,
                    error: "Insufficient quantity",
                    available: batch.currentQuantity,
                    requested: item.quantity
                });
                continue;
            }

            inventoryValidation.push({
                productId: item.productId,
                productName: item.name,
                batchNumber: item.batchNumber,
                inventoryItem: inventoryItem,
                batch: batch,
                quantity: item.quantity,
                valid: true
            });
        }

        const failedValidations = inventoryValidation.filter(item => !item.valid);
        if (failedValidations.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Inventory validation failed",
                requestId: requestId,
                validationErrors: failedValidations
            });
        }

        // 🛡️ STEP 3: Generate order number
        const orderNumber = await Order.generateOrderNumber();

        // 🛡️ STEP 4: Prepare order data
        const orderItems = [];

        for (const validation of inventoryValidation) {
            if (validation.valid) {
                const item = req.body.items.find(i =>
                    i.productId === validation.productId &&
                    i.batchNumber === validation.batchNumber
                );

                const price = item.price || 0;
                const quantity = item.quantity || 1;
                const discountPercent = item.discount || 0;
                const taxRate = item.taxSlab || 18;

                const itemTotalBeforeDiscount = price * quantity;
                const itemDiscountAmount = itemTotalBeforeDiscount * (discountPercent / 100);
                const itemTotalAfterDiscount = itemTotalBeforeDiscount - itemDiscountAmount;
                const baseValue = itemTotalAfterDiscount / (1 + taxRate / 100);
                const taxAmount = itemTotalAfterDiscount - baseValue;
                const cgstAmount = taxAmount / 2;
                const sgstAmount = taxAmount / 2;

                orderItems.push({
                    productId: item.productId,
                    productName: item.name,
                    barcode: item.barcode || "",
                    hsn: item.hsn || "",
                    category: item.category || "",
                    batchNumber: item.batchNumber,
                    expiryDate: validation.batch.expiryDate,
                    quantity: quantity,
                    price: price,
                    discount: discountPercent,
                    taxSlab: taxRate,
                    baseValue: parseFloat(baseValue.toFixed(2)),
                    discountAmount: parseFloat(itemDiscountAmount.toFixed(2)),
                    taxAmount: parseFloat(taxAmount.toFixed(2)),
                    cgstAmount: parseFloat(cgstAmount.toFixed(2)),
                    sgstAmount: parseFloat(sgstAmount.toFixed(2)),
                    totalAmount: parseFloat(itemTotalAfterDiscount.toFixed(2)),
                    purchasedFromStock: validation.batch.currentQuantity,
                    inventoryId: validation.inventoryItem._id.toString(),
                    status: 'delivered'
                });
            }
        }

        // Calculate totals
        const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discount = orderItems.reduce((sum, item) => sum + item.discountAmount, 0);
        const baseValue = orderItems.reduce((sum, item) => sum + item.baseValue, 0);
        const tax = orderItems.reduce((sum, item) => sum + item.taxAmount, 0);
        const cgst = orderItems.reduce((sum, item) => sum + item.cgstAmount, 0);
        const sgst = orderItems.reduce((sum, item) => sum + item.sgstAmount, 0);

        let finalTotal = subtotal - discount;
        let promoDiscount = 0;
        if (req.body.appliedPromoCode && req.body.appliedPromoCode.discount) {
            promoDiscount = finalTotal * (req.body.appliedPromoCode.discount / 100);
            finalTotal -= promoDiscount;
        }

        let loyaltyDiscount = 0;
        if (req.body.loyaltyCoinsUsed && req.body.loyaltyCoinsUsed > 0) {
            loyaltyDiscount = Math.min(req.body.loyaltyCoinsUsed, finalTotal);
            finalTotal -= loyaltyDiscount;
        }

        // Create order document
        const orderData = {
            orderNumber,
            date: invoiceDate,
            orderType: 'offline',
            businessType: req.body.businessType || 'b2c',
            customer: {
                customerId: req.body.customer.customerId || "",
                customerNumber: req.body.customer.customerNumber || "",
                name: req.body.customer.name,
                email: req.body.customer.email || "",
                mobile: req.body.customer.mobile,
                gstNumber: req.body.customer.gstNumber || "",
                address: req.body.customer.address || ""
            },
            deliveryAddress: req.body.deliveryAddress ? {
                addressId: req.body.deliveryAddress.addressId || "",
                fullName: req.body.deliveryAddress.fullName || req.body.customer.name,
                mobile: req.body.deliveryAddress.mobile || req.body.customer.mobile,
                email: req.body.deliveryAddress.email || req.body.customer.email || "",
                addressLine1: req.body.deliveryAddress.addressLine1 || "",
                addressLine2: req.body.deliveryAddress.addressLine2 || "",
                landmark: req.body.deliveryAddress.landmark || "",
                city: req.body.deliveryAddress.city || "",
                state: req.body.deliveryAddress.state || "",
                pincode: req.body.deliveryAddress.pincode || "",
                country: req.body.deliveryAddress.country || "India",
                addressType: req.body.deliveryAddress.addressType || "shipping",
                instructions: req.body.deliveryAddress.instructions || "",
                isDefault: req.body.deliveryAddress.isDefault || false
            } : null,
            items: orderItems,
            subtotal: parseFloat(subtotal.toFixed(2)),
            baseValue: parseFloat(baseValue.toFixed(2)),
            discount: parseFloat(discount.toFixed(2)),
            promoDiscount: parseFloat(promoDiscount.toFixed(2)),
            appliedPromoCode: req.body.appliedPromoCode ? {
                ...req.body.appliedPromoCode,
                appliedAt: new Date()
            } : null,
            loyaltyDiscount: parseFloat(loyaltyDiscount.toFixed(2)),
            loyaltyCoinsUsed: req.body.loyaltyCoinsUsed || 0,
            tax: parseFloat(tax.toFixed(2)),
            cgst: parseFloat(cgst.toFixed(2)),
            sgst: parseFloat(sgst.toFixed(2)),
            hasMixedTaxRates: req.body.hasMixedTaxRates || false,
            taxPercentages: req.body.taxPercentages || [],
            total: parseFloat(finalTotal.toFixed(2)),
            payment: {
                method: req.body.paymentType || 'cash',
                status: 'paid',
                paidAmount: parseFloat(finalTotal.toFixed(2)),
                paymentDate: invoiceDate
            },
            remarks: req.body.remarks || "",
            orderStatus: 'delivered',
            createdAt: invoiceDate,
            updatedAt: invoiceDate,
            timeline: {
                placedAt: invoiceDate,
                deliveredAt: invoiceDate
            },
            loyaltyCoinsEarned: Math.floor(baseValue / 100),
            createdBy: req.body.userDetails?.name || "billing_system",
            updatedBy: req.body.userDetails?.name || "billing_system"
        };

        const newOrder = new Order(orderData);
        await newOrder.save();

        // 🛡️ UPDATE INVENTORY AND PRODUCT STOCK HISTORY
        const ProductStockHistory = require("../modals/ProductStockHistory");
        const inventoryUpdates = [];

        for (const validation of inventoryValidation) {
            if (validation.valid) {
                const batch = validation.inventoryItem.batches.find(
                    b => b.batchNumber === validation.batchNumber
                );

                if (!batch) continue;

                const oldQuantity = batch.currentQuantity;
                batch.quantity -= validation.quantity;
                batch.currentQuantity -= validation.quantity;

                if (batch.currentQuantity === 0) {
                    batch.status = "sold-out";
                }

                const newQuantity = batch.currentQuantity;

                // ✅ UPDATE PRODUCT STOCK HISTORY (NEW WAY)
                let productStockDoc = await ProductStockHistory.findOne({
                    productId: validation.productId
                });

                if (!productStockDoc) {
                    productStockDoc = new ProductStockHistory({
                        productId: validation.productId,
                        productName: validation.productName,
                        inventoryId: validation.inventoryItem._id,
                        batches: []
                    });
                }

                let batchEntry = productStockDoc.batches.find(b => b.batchNumber === validation.batchNumber);
                if (!batchEntry) {
                    batchEntry = {
                        batchId: require('uuid').v4(),
                        batchNumber: validation.batchNumber,
                        currentStock: 0,
                        history: []
                    };
                    productStockDoc.batches.push(batchEntry);
                    batchEntry = productStockDoc.batches[productStockDoc.batches.length - 1];
                }

                batchEntry.currentStock = newQuantity;

                batchEntry.history.push({
                    movementId: require('uuid').v4(),
                    type: "sold",
                    quantity: validation.quantity,
                    previousStock: oldQuantity,
                    newStock: newQuantity,
                    orderNumber: orderNumber,
                    orderType: "offline",
                    reason: "Offline order sale",
                    notes: `Order: ${orderNumber} | Customer: ${req.body.customer.name}`,
                    addedBy: "billing_system",
                    date: invoiceDate
                });

                await productStockDoc.save();

                // ❌ NO LONGER pushing to inventory.stockHistory for order sales
                inventoryUpdates.push(validation.inventoryItem.save());
            }
        }

        await Promise.all(inventoryUpdates);

        const processingTime = Date.now() - startTime;

        res.status(201).json({
            success: true,
            message: "Order (invoice) created successfully",
            data: newOrder.toObject(),
            requestId,
            processingTime: `${processingTime}ms`
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`💥 [${requestId}] Error creating order:`, error);
        res.status(500).json({
            success: false,
            message: "Failed to create order",
            error: error.message,
            requestId,
            processingTime: `${processingTime}ms`
        });
    }
});

// 📋 GET ALL ORDERS - DEBUG VERSION
router.get("/all/get-invoices", async (req, res) => {
    console.log("========== 🚀 GET INVOICES REQUEST RECEIVED ==========");
    console.log("📅 Time:", new Date().toISOString());
    console.log("🌐 Request URL:", req.originalUrl);
    console.log("🔍 Query Parameters:", req.query);
    console.log("👤 IP Address:", req.ip);
    console.log("📋 Request Headers:");
    console.log(JSON.stringify(req.headers, null, 2));
    console.log("======================================================");

    try {
        // Test if database connection works
        console.log("🔌 Testing database connection...");
        const testConnection = await Order.findOne();
        console.log("✅ Database connection successful");

        const {
            page = 1,
            limit = 50,
            orderType,
            status,
            startDate,
            endDate
        } = req.query;

        console.log("🔧 Building query with params:", {
            page, limit, orderType, status, startDate, endDate
        });

        const query = {};

        // Filter by order type
        if (orderType && orderType !== 'all') {
            query.orderType = orderType;
        }

        // Filter by status
        if (status && status !== 'all') {
            query.orderStatus = status;
        }

        // Filter by date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        console.log("🔍 Final MongoDB query:", JSON.stringify(query, null, 2));

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get orders
        console.log("📦 Fetching orders from database...");
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(query);

        console.log("✅ Database query successful:");
        console.log(`   Total orders: ${total}`);
        console.log(`   Returning: ${orders.length} orders`);
        console.log(`   First order number: ${orders[0]?.orderNumber}`);
        console.log(`   First order date: ${orders[0]?.date}`);

        // Log sample order structure
        if (orders.length > 0) {
            console.log("📝 Sample order structure:");
            console.log({
                orderNumber: orders[0].orderNumber,
                date: orders[0].date,
                businessType: orders[0].businessType,
                customer: orders[0].customer?.name,
                total: orders[0].total,
                itemsCount: orders[0].items?.length
            });
        }

        res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            filters: {
                orderType,
                status,
                startDate,
                endDate
            },
            debug: {
                requestTime: new Date().toISOString(),
                queryUsed: query,
                ordersReturned: orders.length
            }
        });

        console.log("📤 Response sent successfully");
        console.log("======================================================");

    } catch (error) {
        console.error("❌ ERROR in get-invoices route:");
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        console.error("Full error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 🔍 GET ORDER BY ORDER NUMBER - KEEPING OLD NAME
router.get("/get-invoice/:orderNumber", async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const order = await Order.findOne({ orderNumber });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch order",
            error: error.message
        });
    }
});

// ✏️ UPDATE ORDER - KEEPING OLD NAME
router.put("/update-invoice/:orderNumber", async (req, res) => {
    const startTime = Date.now();
    const requestId = `UPDATE_ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        const { orderNumber } = req.params;
        const { customer, payment, remarks, deliveryAddress } = req.body; // ✅ Changed shippingDetails to deliveryAddress

        console.log(`🔄 [${requestId}] Updating order: ${orderNumber}`);

        // Find order
        const order = await Order.findOne({ orderNumber });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
                requestId
            });
        }

        // Only offline orders can be updated via this route
        if (order.orderType !== 'offline') {
            return res.status(400).json({
                success: false,
                message: "This route is only for updating offline orders",
                requestId
            });
        }

        // Build update payload
        const updatePayload = {};
        const changes = [];

        // ✅ Update delivery address (previously shippingDetails)
        if (deliveryAddress !== undefined) {
            if (deliveryAddress === null) {
                updatePayload.deliveryAddress = null;
                changes.push("Delivery address: Cleared (same as billing)");
            } else if (typeof deliveryAddress === 'object') {
                // Validate delivery address
                if (!deliveryAddress.fullName || !deliveryAddress.mobile) {
                    console.log(`❌ [${requestId}] Delivery address validation failed:`, {
                        hasFullName: !!deliveryAddress.fullName,
                        hasMobile: !!deliveryAddress.mobile
                    });
                    return res.status(400).json({
                        success: false,
                        message: "Delivery name and mobile are required",
                        requestId
                    });
                }

                // Update delivery address
                updatePayload.deliveryAddress = {
                    addressId: deliveryAddress.addressId || "",
                    fullName: deliveryAddress.fullName,
                    email: deliveryAddress.email || "",
                    mobile: deliveryAddress.mobile,
                    addressLine1: deliveryAddress.addressLine1 || "",
                    addressLine2: deliveryAddress.addressLine2 || "",
                    landmark: deliveryAddress.landmark || "",
                    city: deliveryAddress.city || "",
                    state: deliveryAddress.state || "",
                    pincode: deliveryAddress.pincode || "",
                    country: deliveryAddress.country || "India",
                    addressType: deliveryAddress.addressType || "shipping",
                    instructions: deliveryAddress.instructions || "",
                    isDefault: deliveryAddress.isDefault || false
                };
                changes.push(`Delivery address updated to ${deliveryAddress.fullName}`);
            }
        }

        // Update payment
        if (payment && payment.method) {
            if (payment.method !== order.payment.method) {
                updatePayload["payment.method"] = payment.method;
                changes.push(`Payment method: ${order.payment.method} → ${payment.method}`);
            }
        }

        // Update customer
        if (customer) {
            const updatedCustomer = { ...order.customer };
            let customerChanged = false;

            if (customer.name && customer.name !== updatedCustomer.name) {
                updatedCustomer.name = customer.name;
                customerChanged = true;
                changes.push(`Customer name: ${order.customer.name} → ${customer.name}`);
            }
            if (customer.mobile && customer.mobile !== updatedCustomer.mobile) {
                updatedCustomer.mobile = customer.mobile;
                customerChanged = true;
                changes.push(`Customer mobile updated`);
            }
            if (customer.gstNumber !== undefined) {
                updatedCustomer.gstNumber = customer.gstNumber || "";
                customerChanged = true;
                changes.push(`Customer GST updated`);
            }
            if (customer.address !== undefined) {
                updatedCustomer.address = customer.address || "";
                customerChanged = true;
                changes.push(`Customer address updated`);
            }

            if (customerChanged) {
                updatePayload.customer = updatedCustomer;
            }
        }

        // Update remarks
        if (remarks !== undefined && remarks !== order.remarks) {
            updatePayload.remarks = remarks;
            changes.push(`Remarks updated`);
        }

        // Check if any changes
        if (Object.keys(updatePayload).length === 0) {
            return res.status(200).json({
                success: true,
                message: "No changes detected",
                data: order,
                requestId,
                changes: []
            });
        }

        // Update order
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber },
            updatePayload,
            { new: true, runValidators: true }
        );

        const processingTime = Date.now() - startTime;

        console.log(`✅ [${requestId}] Order updated successfully`, {
            orderNumber,
            changesApplied: changes.length,
            processingTime: `${processingTime}ms`
        });

        res.status(200).json({
            success: true,
            message: "Order updated successfully",
            data: updatedOrder,
            requestId,
            changes,
            processingTime: `${processingTime}ms`
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;

        console.error(`💥 [${requestId}] Error updating order:`, error);
        res.status(500).json({
            success: false,
            message: "Failed to update order",
            error: error.message,
            requestId,
            processingTime: `${processingTime}ms`
        });
    }
});

// 🗑️ DELETE ORDER - KEEPING OLD NAME
router.delete("/delete-invoice/:orderNumber", async (req, res) => {
    try {
        const { orderNumber } = req.params;

        console.log(`🗑️ Attempting to delete order: ${orderNumber}`);

        // Find order
        const orderToDelete = await Order.findOne({ orderNumber });
        if (!orderToDelete) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Only offline orders can be deleted via this route
        if (orderToDelete.orderType !== 'offline') {
            return res.status(400).json({
                success: false,
                message: "This route is only for deleting offline orders. Online orders must be cancelled instead."
            });
        }

        // Archive order first (you need to create DeletedOrder model)
        /*
        const deletedOrder = new DeletedOrder({
            originalOrderNumber: orderNumber,
            orderData: orderToDelete.toObject(),
            deletedBy: req.user?.username || "system",
            deletedAt: new Date()
        });
        await deletedOrder.save();
        */

        // Restore inventory quantities
        const stockRestorationDetails = [];
        for (const item of orderToDelete.items) {
            const inventoryItem = await Inventory.findOne({ productId: item.productId });
            if (inventoryItem) {
                const batch = inventoryItem.batches.find(b => b.batchNumber === item.batchNumber);
                if (batch) {
                    const beforeStock = batch.quantity;
                    batch.quantity += item.quantity;
                    const afterStock = batch.quantity;

                    stockRestorationDetails.push({
                        productId: item.productId,
                        productName: item.productName,
                        batchNumber: item.batchNumber,
                        quantityRestored: item.quantity,
                        beforeDeletionStock: beforeStock,
                        afterRestorationStock: afterStock
                    });

                    await inventoryItem.save();
                }
            }
        }

        // Delete order
        await Order.findOneAndDelete({ orderNumber });

        console.log(`✅ Order deleted successfully:`, {
            orderNumber,
            customer: orderToDelete.customer?.name || 'Unknown',
            itemsRestored: stockRestorationDetails.length
        });

        res.status(200).json({
            success: true,
            message: "Order deleted successfully and inventory restored",
            restorationDetails: {
                itemsRestored: stockRestorationDetails.length,
                details: stockRestorationDetails
            }
        });

    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({
            success: false,
            message: "Failed to delete order",
            error: error.message
        });
    }
});

// ======================================================================
// SECTION 3: COMMON/UNIFIED ROUTES
// ======================================================================

// 📊 GET DASHBOARD STATS (BOTH ONLINE & OFFLINE)
router.get("/dashboard/stats", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate) {
            dateFilter.$gte = new Date(startDate);
        }
        if (endDate) {
            dateFilter.$lte = new Date(endDate);
        }

        const matchStage = {};
        if (startDate || endDate) {
            matchStage.createdAt = dateFilter;
        }

        // Get overall stats
        const overallStats = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: "$total" },
                    onlineOrders: {
                        $sum: { $cond: [{ $eq: ["$orderType", "online"] }, 1, 0] }
                    },
                    offlineOrders: {
                        $sum: { $cond: [{ $eq: ["$orderType", "offline"] }, 1, 0] }
                    },
                    totalItems: {
                        $sum: {
                            $reduce: {
                                input: "$items",
                                initialValue: 0,
                                in: { $add: ["$$value", "$$this.quantity"] }
                            }
                        }
                    }
                }
            }
        ]);

        // Get status breakdown
        const statusBreakdown = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$total" }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get type breakdown
        const typeBreakdown = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$orderType",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$total" }
                }
            }
        ]);

        // Get today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayStats = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: today }
                }
            },
            {
                $group: {
                    _id: null,
                    todayOrders: { $sum: 1 },
                    todayRevenue: { $sum: "$total" }
                }
            }
        ]);

        // Get top products
        const topProducts = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$items" },
            {
                $group: {
                    _id: {
                        productId: "$items.productId",
                        productName: "$items.productName"
                    },
                    totalSold: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: "$items.totalAmount" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        // Get payment method breakdown
        const paymentBreakdown = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$payment.method",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$total" }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            success: true,
            stats: {
                ...(overallStats[0] || {
                    totalOrders: 0,
                    totalRevenue: 0,
                    onlineOrders: 0,
                    offlineOrders: 0,
                    totalItems: 0
                }),
                todayStats: todayStats[0] || {
                    todayOrders: 0,
                    todayRevenue: 0
                },
                statusBreakdown,
                typeBreakdown,
                topProducts,
                paymentBreakdown,
                averageOrderValue: overallStats[0] && overallStats[0].totalOrders > 0
                    ? (overallStats[0].totalRevenue / overallStats[0].totalOrders).toFixed(2)
                    : 0
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats',
            error: error.message
        });
    }
});





// 🔄 UPDATE ORDER PRODUCTS (WITH PROPER INVENTORY MANAGEMENT)
router.put("/update-order-products/:orderNumber", async (req, res) => {
    const requestId = `UPDATE_PROD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
        const { orderNumber } = req.params;
        const { updatedItems, originalItems, userDetails } = req.body;

        console.log(`🔄 [${requestId}] Updating order products: ${orderNumber}`);

        if (!updatedItems || !Array.isArray(updatedItems)) {
            return res.status(400).json({
                success: false,
                message: "Updated items are required",
                requestId
            });
        }

        if (!originalItems || !Array.isArray(originalItems)) {
            return res.status(400).json({
                success: false,
                message: "Original items are required",
                requestId
            });
        }

        const order = await Order.findOne({ orderNumber });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
                requestId
            });
        }

        // Build maps
        const originalMap = new Map();
        originalItems.forEach(item => {
            const key = `${item.productId}_${item.batchNumber}`;
            originalMap.set(key, { ...item, originalQuantity: item.quantity });
        });

        const updatedMap = new Map();
        updatedItems.forEach(item => {
            const key = `${item.productId}_${item.batchNumber}`;
            updatedMap.set(key, { ...item, newQuantity: item.quantity });
        });

        // Calculate changes
        const changes = {
            itemsToRestore: [],
            itemsToDeduct: [],
            itemsUnchanged: []
        };

        for (const [key, originalItem] of originalMap.entries()) {
            const updatedItem = updatedMap.get(key);
            if (!updatedItem) {
                changes.itemsToRestore.push({
                    ...originalItem,
                    changeType: "removed",
                    quantityToRestore: originalItem.quantity
                });
            } else if (updatedItem.quantity < originalItem.quantity) {
                const quantityDecrease = originalItem.quantity - updatedItem.quantity;
                changes.itemsToRestore.push({
                    ...originalItem,
                    changeType: "decreased",
                    quantityToRestore: quantityDecrease,
                    newQuantity: updatedItem.quantity
                });
            } else if (updatedItem.quantity === originalItem.quantity) {
                changes.itemsUnchanged.push(originalItem);
            }
        }

        for (const [key, updatedItem] of updatedMap.entries()) {
            const originalItem = originalMap.get(key);
            if (!originalItem) {
                changes.itemsToDeduct.push({
                    ...updatedItem,
                    changeType: "added",
                    quantityToDeduct: updatedItem.quantity
                });
            } else if (updatedItem.quantity > originalItem.quantity) {
                const quantityIncrease = updatedItem.quantity - originalItem.quantity;
                changes.itemsToDeduct.push({
                    ...updatedItem,
                    changeType: "increased",
                    quantityToDeduct: quantityIncrease,
                    originalQuantity: originalItem.quantity
                });
            }
        }

        // Validate availability for deductions
        const validationErrors = [];
        for (const item of changes.itemsToDeduct) {
            const inventoryItem = await Inventory.findOne({ productId: item.productId });
            if (!inventoryItem) {
                validationErrors.push({ productId: item.productId, error: "Product not found" });
                continue;
            }
            const batch = inventoryItem.batches.find(b => b.batchNumber === item.batchNumber);
            if (!batch) {
                validationErrors.push({ productId: item.productId, error: "Batch not found" });
                continue;
            }
            if (batch.currentQuantity < item.quantityToDeduct) {
                validationErrors.push({
                    productId: item.productId,
                    error: "Insufficient stock",
                    available: batch.currentQuantity,
                    required: item.quantityToDeduct
                });
            }
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Inventory validation failed",
                validationErrors,
                requestId
            });
        }

        const ProductStockHistory = require("../modals/ProductStockHistory");

        // RESTORE items (add back to inventory)
        for (const item of changes.itemsToRestore) {
            const inventoryItem = await Inventory.findOne({ productId: item.productId });
            if (!inventoryItem) continue;

            const batch = inventoryItem.batches.find(b => b.batchNumber === item.batchNumber);
            if (!batch) continue;

            const beforeQuantity = batch.currentQuantity;
            batch.quantity += item.quantityToRestore;
            batch.currentQuantity += item.quantityToRestore;

            if (batch.status === "sold-out" && batch.currentQuantity > 0) {
                batch.status = "active";
            }

            const newQuantity = batch.currentQuantity;

            // ✅ UPDATE PRODUCT STOCK HISTORY
            let productStockDoc = await ProductStockHistory.findOne({ productId: item.productId });
            if (!productStockDoc) {
                productStockDoc = new ProductStockHistory({
                    productId: item.productId,
                    productName: item.productName,
                    inventoryId: inventoryItem._id,
                    batches: []
                });
            }

            let batchEntry = productStockDoc.batches.find(b => b.batchNumber === item.batchNumber);
            if (!batchEntry) {
                batchEntry = {
                    batchId: require('uuid').v4(),
                    batchNumber: item.batchNumber,
                    currentStock: 0,
                    history: []
                };
                productStockDoc.batches.push(batchEntry);
                batchEntry = productStockDoc.batches[productStockDoc.batches.length - 1];
            }

            batchEntry.currentStock = newQuantity;
            batchEntry.history.push({
                movementId: require('uuid').v4(),
                type: "restored",
                quantity: item.quantityToRestore,
                previousStock: beforeQuantity,
                newStock: newQuantity,
                orderNumber: orderNumber,
                orderType: order.orderType,
                reason: `Invoice ${orderNumber} edit - ${item.changeType}`,
                notes: `Product: ${item.productName} | Restored: ${item.quantityToRestore}`,
                addedBy: userDetails?.name || "system",
                date: new Date()
            });

            await productStockDoc.save();
            await inventoryItem.save();
        }

        // DEDUCT items (remove from inventory)
        for (const item of changes.itemsToDeduct) {
            const inventoryItem = await Inventory.findOne({ productId: item.productId });
            if (!inventoryItem) continue;

            const batch = inventoryItem.batches.find(b => b.batchNumber === item.batchNumber);
            if (!batch) continue;

            const beforeQuantity = batch.currentQuantity;
            batch.quantity -= item.quantityToDeduct;
            batch.currentQuantity -= item.quantityToDeduct;

            if (batch.currentQuantity === 0) {
                batch.status = "sold-out";
            }

            const newQuantity = batch.currentQuantity;

            // ✅ UPDATE PRODUCT STOCK HISTORY
            let productStockDoc = await ProductStockHistory.findOne({ productId: item.productId });
            if (!productStockDoc) {
                productStockDoc = new ProductStockHistory({
                    productId: item.productId,
                    productName: item.productName,
                    inventoryId: inventoryItem._id,
                    batches: []
                });
            }

            let batchEntry = productStockDoc.batches.find(b => b.batchNumber === item.batchNumber);
            if (!batchEntry) {
                batchEntry = {
                    batchId: require('uuid').v4(),
                    batchNumber: item.batchNumber,
                    currentStock: 0,
                    history: []
                };
                productStockDoc.batches.push(batchEntry);
                batchEntry = productStockDoc.batches[productStockDoc.batches.length - 1];
            }

            batchEntry.currentStock = newQuantity;
            batchEntry.history.push({
                movementId: require('uuid').v4(),
                type: "deducted",
                quantity: item.quantityToDeduct,
                previousStock: beforeQuantity,
                newStock: newQuantity,
                orderNumber: orderNumber,
                orderType: order.orderType,
                reason: `Invoice ${orderNumber} edit - ${item.changeType}`,
                notes: `Product: ${item.productName} | Deducted: ${item.quantityToDeduct}`,
                addedBy: userDetails?.name || "system",
                date: new Date()
            });

            await productStockDoc.save();
            await inventoryItem.save();
        }

        // Update order items and totals
        const finalItems = updatedItems.map(item => {
            const price = item.price || 0;
            const quantity = item.quantity || 1;
            const discountPercent = item.discount || 0;
            const taxRate = item.taxSlab || 18;

            const itemTotalBeforeDiscount = price * quantity;
            const itemDiscountAmount = itemTotalBeforeDiscount * (discountPercent / 100);
            const itemTotalAfterDiscount = itemTotalBeforeDiscount - itemDiscountAmount;
            const baseValue = itemTotalAfterDiscount / (1 + taxRate / 100);
            const taxAmount = itemTotalAfterDiscount - baseValue;
            const cgstAmount = taxAmount / 2;
            const sgstAmount = taxAmount / 2;

            return {
                ...item,
                baseValue: parseFloat(baseValue.toFixed(2)),
                discountAmount: parseFloat(itemDiscountAmount.toFixed(2)),
                taxAmount: parseFloat(taxAmount.toFixed(2)),
                cgstAmount: parseFloat(cgstAmount.toFixed(2)),
                sgstAmount: parseFloat(sgstAmount.toFixed(2)),
                totalAmount: parseFloat(itemTotalAfterDiscount.toFixed(2))
            };
        });

        order.items = finalItems;
        order.subtotal = finalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        order.discount = finalItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
        order.baseValue = finalItems.reduce((sum, item) => sum + (item.baseValue || 0), 0);
        order.tax = finalItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        order.cgst = finalItems.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
        order.sgst = finalItems.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);

        let finalTotal = order.subtotal - order.discount;
        if (order.appliedPromoCode && order.appliedPromoCode.discount) {
            order.promoDiscount = finalTotal * (order.appliedPromoCode.discount / 100);
            finalTotal -= order.promoDiscount;
        }
        if (order.loyaltyCoinsUsed && order.loyaltyCoinsUsed > 0) {
            order.loyaltyDiscount = Math.min(order.loyaltyCoinsUsed, finalTotal);
            finalTotal -= order.loyaltyDiscount;
        }

        order.total = parseFloat(finalTotal.toFixed(2));
        order.updatedAt = new Date();
        order.updatedBy = userDetails?.name || "system";

        await order.save();

        const processingTime = Date.now() - startTime;

        res.status(200).json({
            success: true,
            message: "Order products updated successfully",
            data: { order },
            summary: {
                itemsRestoredCount: changes.itemsToRestore.length,
                itemsDeductedCount: changes.itemsToDeduct.length,
                itemsUnchangedCount: changes.itemsUnchanged.length,
                newOrderTotal: order.total
            },
            requestId,
            processingTime: `${processingTime}ms`
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`💥 Error updating order products:`, error);
        res.status(500).json({
            success: false,
            message: "Failed to update order products",
            error: error.message,
            requestId,
            processingTime: `${processingTime}ms`
        });
    }
});

module.exports = router;