// routes/orderRoutes.js - UNIFIED ORDER ROUTES
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../modals/Orders");
const CancelledOrder = require("../modals/CancelledOrder");
const Inventory = require("../modals/Inventory");
const DeletedOrder = require("../modals/deletedOrderModel");
const ProductOffer = require("../modals/ProductOffers");
const { auth } = require("../middleware/auth");
const User = require("../modals/User");
const Cart = require("../modals/Cart");
const ProductStockHistory = require("../modals/ProductStockHistory");
const {
    getNextInvoiceNumber,
    releaseInvoiceNumber,
} = require("../utils/invoiceNumber");

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
    const taxRate = 5;
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

// ============================================================
// HELPER — Restore inventory for a cancelled order
// Restores both batch.quantity and batch.currentQuantity,
// updates ProductStockHistory, and re-activates sold-out batches.
// ============================================================
async function restoreOrderStock(order, reason, source) {
    for (const item of order.items) {
        const inventory = await Inventory.findOne({ productId: item.productId });
        if (!inventory) continue;

        const batch = inventory.batches.find(
            (b) => b.batchNumber === item.batchNumber
        );
        if (!batch) continue;

        const beforeQuantity = batch.currentQuantity;

        batch.quantity += item.quantity;
        batch.currentQuantity += item.quantity;

        if (batch.status === "sold-out" && batch.currentQuantity > 0) {
            batch.status = "active";
        }

        const newQuantity = batch.currentQuantity;

        // Update ProductStockHistory
        let productStockDoc = await ProductStockHistory.findOne({
            productId: item.productId,
        });

        if (!productStockDoc) {
            productStockDoc = new ProductStockHistory({
                productId: item.productId,
                productName: item.productName,
                inventoryId: inventory._id,
                batches: [],
            });
        }

        let batchEntry = productStockDoc.batches.find(
            (b) => b.batchNumber === item.batchNumber
        );
        if (!batchEntry) {
            batchEntry = {
                batchId: require("uuid").v4(),
                batchNumber: item.batchNumber,
                currentStock: 0,
                history: [],
            };
            productStockDoc.batches.push(batchEntry);
            batchEntry =
                productStockDoc.batches[productStockDoc.batches.length - 1];
        }

        batchEntry.currentStock = newQuantity;

        batchEntry.history.push({
            movementId: require("uuid").v4(),
            type: "restored",
            quantity: item.quantity,
            previousStock: beforeQuantity,
            newStock: newQuantity,
            orderNumber: order.orderNumber,
            orderType: order.orderType,
            reason: `Order ${order.orderNumber} cancelled (${source})`,
            notes: reason || `Cancelled via ${source}`,
            addedBy: "system",
            date: new Date(),
        });

        await productStockDoc.save();
        await inventory.save();

        console.log(
            `   ↩ Restored ${item.quantity} units of ${item.productName} (Batch: ${item.batchNumber})`
        );
    }
}

// ============================================================
// HELPER — Archive cancelled order
//   - Copies order doc to CancelledOrder
//   - Deletes from Order collection
//   - Releases invoice number for reuse
// ============================================================
async function archiveCancelledOrder(order, req, reason, source) {
    const cancelled = new CancelledOrder({
        originalOrderId: order._id,
        orderNumber: order.orderNumber,
        date: order.date,
        orderType: order.orderType,
        businessType: order.businessType,
        userId: order.userId,
        customer: order.customer,
        deliveryAddress: order.deliveryAddress,
        shippingDetails: order.shippingDetails,
        items: order.items.map((it) => it.toObject()),
        checkoutMode: order.checkoutMode,
        subtotal: order.subtotal,
        baseValue: order.baseValue,
        discount: order.discount,
        promoDiscount: order.promoDiscount,
        appliedPromoCode: order.appliedPromoCode,
        loyaltyDiscount: order.loyaltyDiscount,
        loyaltyCoinsUsed: order.loyaltyCoinsUsed,
        totalSavings: order.totalSavings,
        tax: order.tax,
        cgst: order.cgst,
        sgst: order.sgst,
        taxPercentage: order.taxPercentage,
        hasMixedTaxRates: order.hasMixedTaxRates,
        taxPercentages: order.taxPercentages,
        shipping: order.shipping,
        total: order.total,
        payment: order.payment,
        timeline: {
            ...order.timeline.toObject(),
            cancelledAt: new Date(),
        },
        orderStatus: "cancelled",
        loyaltyCoinsEarned: order.loyaltyCoinsEarned,
        remarks: order.remarks,
        notes: order.notes,
        createdBy: order.createdBy,
        updatedBy: order.updatedBy,

        // Cancel metadata
        cancelledBy: {
            userId: req.user?.userId || req.user?._id || "",
            name: req.user?.name || "",
            email: req.user?.email || "",
        },
        cancelledAt: new Date(),
        cancelReason: reason || "",
        cancelSource: source,
    });

    await cancelled.save();

    // Delete from active Order collection
    await Order.findOneAndDelete({ orderNumber: order.orderNumber });

    // Release the invoice number so it can be reused
    await releaseInvoiceNumber(order.orderNumber);
}

// ======================================================================
// SECTION 1: ONLINE/E-COMMERCE ROUTES
// ======================================================================

// 📦 CREATE ONLINE ORDER
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

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID required', requestId });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items to order', requestId });
        }
        if (!address || !address.addressId) {
            return res.status(400).json({ success: false, message: 'Delivery address required', requestId });
        }

        // STEP 1: FETCH USER DATA
        console.log(`👤 [${requestId}] Fetching user data...`);
        let userData = null;
        try {
            const User = mongoose.model('User');
            userData = await User.findOne({ userId: userId });
            if (!userData) {
                console.warn(`⚠️ [${requestId}] User not found in User model: ${userId}`);
            }
        } catch (userError) {
            console.error(`❌ [${requestId}] Error fetching user data:`, userError.message);
        }

        // STEP 2: FETCH PRODUCT DETAILS AND EXTRA OFFERS
        console.log(`🔍 [${requestId}] Fetching product details and extra offers...`);
        const Product = mongoose.model('Product');
        const validatedItems = [];

        for (const item of items) {
            const product = await Product.findOne({ productId: item.productId });
            if (!product) {
                return res.status(400).json({ success: false, message: `Product not found: ${item.productId}`, requestId });
            }

            const selectedColor = product.colors?.find(c => c.colorId === item.selectedColor?.colorId) || product.colors?.[0];
            if (!selectedColor) {
                return res.status(400).json({ success: false, message: `Color not found for product: ${item.productId}`, requestId });
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

        // STEP 3: VALIDATE INVENTORY
        console.log(`🔍 [${requestId}] Validating inventory...`);
        const inventoryValidationResults = [];

        for (const validatedItem of validatedItems) {
            const inventoryItem = await Inventory.findOne({ productId: validatedItem.productId });

            if (!inventoryItem) {
                return res.status(400).json({ success: false, message: `Product not found in inventory: ${validatedItem.productName}`, requestId });
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
                    return res.status(400).json({ success: false, message: `Insufficient stock for ${validatedItem.productName}. Available: ${availableStock}, Requested: ${validatedItem.quantity}`, requestId });
                }

                batchToUse = activeBatches[0];
            } else {
                availableStock = inventoryItem.stock;
                if (availableStock < validatedItem.quantity) {
                    return res.status(400).json({ success: false, message: `Insufficient stock for ${validatedItem.productName}. Available: ${availableStock}, Requested: ${validatedItem.quantity}`, requestId });
                }
            }

            inventoryValidationResults.push({
                ...validatedItem,
                inventoryItem: inventoryItem,
                batchToUse: batchToUse,
                availableStock: availableStock
            });
        }

        // STEP 4: GENERATE ORDER NUMBER (shared series)
        const orderNumber = await getNextInvoiceNumber("ecom");

        // STEP 5: CALCULATE ORDER TOTALS
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

        // STEP 6: CREATE ORDER
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

        // CLEAR USER'S CART
        if (checkoutMode === 'cart' && userId) {
            try {
                const Cart = require("../modals/Cart");
                const deletedCount = await Cart.deleteMany({ userId: userId });
                console.log(`🗑️ [${requestId}] Cleared ${deletedCount.deletedCount} items from cart`);
            } catch (cartError) {
                console.error(`⚠️ [${requestId}] Failed to clear cart:`, cartError.message);
            }
        }

        // SEND ORDER CONFIRMATION EMAIL
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
                            console.log(`📧 Order confirmation email sent to ${user.email}`);
                        }
                    })
                    .catch(err => {
                        console.error(`❌ Error sending order confirmation email:`, err.message);
                    });
            }
        } catch (emailError) {
            console.error(`❌ Error preparing order confirmation email:`, emailError.message);
        }

        // STEP 8: UPDATE INVENTORY + PRODUCT STOCK HISTORY
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

            let productStockDoc = await ProductStockHistory.findOne({ productId: item.productId });

            if (!productStockDoc) {
                productStockDoc = new ProductStockHistory({
                    productId: item.productId,
                    productName: item.productName,
                    inventoryId: inventoryItem._id,
                    batches: []
                });
            }

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

            batchEntry.currentStock = newStock;
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
            inventoryUpdates.push(inventoryItem.save());
        }

        await Promise.all(inventoryUpdates);

        const processingTime = Date.now() - startTime;
        console.log(`🎉 [${requestId}] ONLINE order created!`, { orderNumber, processingTime: `${processingTime}ms` });

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
        const { page = 1, limit = 10, status } = req.query;

        const query = { userId, orderType: 'online' };
        if (status && status !== 'all') {
            query.orderStatus = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(query);

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
        res.status(500).json({ success: false, message: 'Failed to fetch orders' });
    }
});

// 🔍 GET SINGLE ORDER BY ORDER NUMBER
router.get('/:orderNumber', auth, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const order = await Order.findOne({ orderNumber });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({ success: true, order });

    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch order' });
    }
});

// 📊 GET ORDER STATS SUMMARY
router.get('/stats/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;

        const stats = await Order.aggregate([
            { $match: { userId, orderType: 'online' } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: "$total" },
                    pendingOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "pending"] }, 1, 0] } },
                    processingOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "processing"] }, 1, 0] } },
                    shippedOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "shipped"] }, 1, 0] } },
                    deliveredOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] } },
                    cancelledOrders: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] } }
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
        res.status(500).json({ success: false, message: 'Failed to fetch order stats' });
    }
});

// ✏️ UPDATE ORDER STATUS
router.put('/:orderNumber/status', auth, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const order = await Order.findOne({ orderNumber });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const oldStatus = order.orderStatus;

        // ============================================================
        // CANCEL FLOW — archive + restore stock + release number
        // ============================================================
        if (status === 'cancelled' && oldStatus !== 'cancelled') {
            // Update timeline + status in memory first for archive
            order.orderStatus = 'cancelled';
            order.timeline.cancelledAt = new Date();

            // Restore stock + ProductStockHistory
            await restoreOrderStock(order, req.body.reason || 'Status set to cancelled', 'status-route');

            // Archive to CancelledOrder + delete from Order + release invoice number
            await archiveCancelledOrder(order, req, req.body.reason || '', 'status-route');

            // Send email notification (optional)
            if (order.orderType === 'online') {
                try {
                    let userEmail = null;
                    let customerName = '';
                    if (order.userId) {
                        const user = await User.findOne({ userId: order.userId });
                        if (user && user.email) {
                            userEmail = user.email;
                            customerName = user.name || order.deliveryAddress?.fullName || 'Customer';
                        }
                    }
                    if (!userEmail && order.deliveryAddress?.email) {
                        userEmail = order.deliveryAddress.email;
                        customerName = order.deliveryAddress.fullName || 'Customer';
                    }

                    if (userEmail) {
                        const { sendOrderEmail } = require('../config/userEmail');
                        await sendOrderEmail('orderStatusUpdate', userEmail, {
                            orderNumber: order.orderNumber,
                            customerName,
                            orderDate: order.date || order.createdAt,
                            newStatus: 'cancelled',
                            oldStatus,
                            statusMessage: 'Your order has been cancelled.',
                            total: order.total,
                            timelineSteps: [],
                            trackingNumber: null
                        });
                        console.log(`📧 Cancellation email sent to ${userEmail}`);
                    }
                } catch (emailError) {
                    console.error(`❌ Email error on cancel:`, emailError.message);
                }
            }

            return res.json({
                success: true,
                message: 'Order cancelled and archived',
                order: order.getSummary()
            });
        }

        // ============================================================
        // NON-CANCEL STATUS CHANGES — normal flow
        // ============================================================
        order.orderStatus = status;
        const now = new Date();

        if (status === 'delivered') {
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

        // Send status update email for online orders (existing flow)
        if (oldStatus !== status && order.orderType === 'online') {
            try {
                let userEmail = null;
                let customerName = '';

                if (order.userId) {
                    const user = await User.findOne({ userId: order.userId });
                    if (user && user.email) {
                        userEmail = user.email;
                        customerName = user.name || order.deliveryAddress?.fullName || 'Customer';
                    }
                }

                if (!userEmail && order.deliveryAddress?.email) {
                    userEmail = order.deliveryAddress.email;
                    customerName = order.deliveryAddress.fullName || 'Customer';
                }

                if (userEmail) {
                    const timelineSteps = [
                        { title: 'Order Placed', status: 'completed', date: order.timeline.placedAt },
                        {
                            title: 'Processing', status: order.orderStatus === 'processing' || ['shipped', 'delivered'].includes(order.orderStatus) ? 'completed' : 'pending',
                            date: order.timeline.processingAt
                        },
                        {
                            title: 'Shipped', status: order.orderStatus === 'shipped' || order.orderStatus === 'delivered' ? 'completed' : 'pending',
                            date: order.timeline.shippedAt
                        },
                        {
                            title: 'Delivered', status: order.orderStatus === 'delivered' ? 'completed' : 'pending',
                            date: order.timeline.deliveredAt
                        }
                    ];

                    const currentStepIndex = timelineSteps.findIndex(step =>
                        step.title.toLowerCase() === order.orderStatus
                    );
                    if (currentStepIndex >= 0) {
                        timelineSteps[currentStepIndex].status = 'current';
                    }

                    const statusMessages = {
                        'pending': 'Your order has been received and is awaiting confirmation.',
                        'processing': 'Your order is being prepared for shipment.',
                        'shipped': 'Your order has been shipped and is on its way to you!',
                        'delivered': 'Your order has been delivered. We hope you enjoy your purchase!',
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

                    let pdfBuffer = null;
                    if (status === 'shipped' || status === 'delivered') {
                        try {
                            const { generateInvoicePDF } = require('../services/pdfGenerator');
                            pdfBuffer = await generateInvoicePDF(order);
                            console.log(`📄 PDF generated for order ${order.orderNumber} (${status})`);
                        } catch (pdfError) {
                            console.error(`❌ Failed to generate PDF:`, pdfError.message);
                        }
                    }

                    const { sendOrderEmailWithAttachment } = require('../config/userEmail');
                    await sendOrderEmailWithAttachment('orderStatusUpdate', userEmail, emailData, pdfBuffer);

                    console.log(`📧 Status update email sent to ${userEmail} (${oldStatus} → ${status})`);
                }
            } catch (emailError) {
                console.error(`❌ Error preparing status update email:`, emailError.message);
            }
        }

        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            order: order.getSummary()
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Failed to update order status' });
    }
});

// ❌ CANCEL ORDER
router.put('/:orderNumber/cancel', auth, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const { reason } = req.body;

        console.log(`🔄 [CANCEL] Cancelling order: ${orderNumber}`);

        const order = await Order.findOne({ orderNumber });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
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

        // Restore stock + ProductStockHistory
        await restoreOrderStock(order, reason, 'cancel-route');

        // Archive + delete + release number
        await archiveCancelledOrder(order, req, reason || '', 'cancel-route');

        console.log(`✅ [CANCEL] Order ${orderNumber} cancelled, archived, number released`);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order: order.getSummary()
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel order' });
    }
});

// 🎯 GET RECENT ORDERS
router.get('/recent/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 5 } = req.query;

        const recentOrders = await Order.find({ userId, orderType: 'online' })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .select('orderNumber createdAt total orderStatus items');

        res.json({ success: true, orders: recentOrders });

    } catch (error) {
        console.error('Error fetching recent orders:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch recent orders' });
    }
});

// 👑 ADMIN: GET ALL ORDERS
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

        const query = {};

        if (orderType && orderType !== 'all') query.orderType = orderType;
        if (status && status !== 'all') query.orderStatus = status;
        if (userId) query.userId = userId;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const orders = await Order.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await Order.countDocuments(query);

        const stats = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 0, "$total"] }
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
                            $cond: [{ $eq: ["$orderStatus", "cancelled"] }, null, "$total"]
                        }
                    }
                }
            }
        ]);

        const statusBreakdown = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 },
                    totalAmount: {
                        $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 0, "$total"] }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

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
                                0,
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
            filters: { orderType, status, userId, startDate, endDate, sortBy, sortOrder }
        });

    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch orders' });
    }
});

// ======================================================================
// SECTION 2: OFFLINE/BILLING ROUTES
// ======================================================================

// 🧾 CREATE OFFLINE ORDER
router.post("/create-invoice", async (req, res) => {
    const startTime = Date.now();
    const requestId = `OFFLINE_ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        console.log(`🏪 [${requestId}] Starting OFFLINE order creation`);

        if (!req.body.items || req.body.items.length === 0) {
            return res.status(400).json({ success: false, message: "Order must contain at least one item", requestId });
        }

        if (!req.body.customer || !req.body.customer.mobile || !req.body.customer.name) {
            return res.status(400).json({ success: false, message: "Customer name and mobile are required", requestId });
        }

        let invoiceDate;
        if (req.body.date) {
            invoiceDate = new Date(req.body.date);
            if (isNaN(invoiceDate.getTime())) invoiceDate = new Date();
        } else {
            invoiceDate = new Date();
        }

        // Validate inventory
        const inventoryValidation = [];

        for (const [index, item] of req.body.items.entries()) {
            if (!item.productId || !item.batchNumber || !item.quantity || item.quantity < 1) {
                inventoryValidation.push({ productId: item.productId, productName: item.name, error: "Invalid item data" });
                continue;
            }

            const inventoryItem = await Inventory.findOne({ productId: item.productId });

            if (!inventoryItem) {
                inventoryValidation.push({ productId: item.productId, productName: item.name, batchNumber: item.batchNumber, error: "Product not found in inventory" });
                continue;
            }

            const batch = inventoryItem.batches.find(b => b.batchNumber === item.batchNumber);

            if (!batch) {
                inventoryValidation.push({ productId: item.productId, productName: item.name, batchNumber: item.batchNumber, error: "Batch not found", availableBatches: inventoryItem.batches.map(b => b.batchNumber) });
                continue;
            }

            const isExpired = new Date(batch.expiryDate) < new Date();
            if (isExpired) {
                inventoryValidation.push({ productId: item.productId, productName: item.name, batchNumber: item.batchNumber, error: "Batch has expired", expiryDate: batch.expiryDate });
                continue;
            }

            if (batch.currentQuantity < item.quantity) {
                inventoryValidation.push({ productId: item.productId, productName: item.name, batchNumber: item.batchNumber, error: "Insufficient quantity", available: batch.currentQuantity, requested: item.quantity });
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
                requestId,
                validationErrors: failedValidations
            });
        }

        // Generate order number (shared series)
        const orderNumber = await getNextInvoiceNumber("ecom");

        // Prepare order data
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
            appliedPromoCode: req.body.appliedPromoCode ? { ...req.body.appliedPromoCode, appliedAt: new Date() } : null,
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

        // Update inventory + ProductStockHistory
        const inventoryUpdates = [];

        for (const validation of inventoryValidation) {
            if (validation.valid) {
                const batch = validation.inventoryItem.batches.find(b => b.batchNumber === validation.batchNumber);
                if (!batch) continue;

                const oldQuantity = batch.currentQuantity;
                batch.quantity -= validation.quantity;
                batch.currentQuantity -= validation.quantity;

                if (batch.currentQuantity === 0) {
                    batch.status = "sold-out";
                }

                const newQuantity = batch.currentQuantity;

                let productStockDoc = await ProductStockHistory.findOne({ productId: validation.productId });
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

// 📋 GET ALL ORDERS
router.get("/all/get-invoices", async (req, res) => {
    try {
        const testConnection = await Order.findOne();

        const { page = 1, limit = 50, orderType, status, startDate, endDate } = req.query;
        const query = {};

        if (orderType && orderType !== 'all') query.orderType = orderType;
        if (status && status !== 'all') query.orderStatus = status;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(query);

        res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            filters: { orderType, status, startDate, endDate }
        });

    } catch (error) {
        console.error("❌ ERROR in get-invoices route:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
            error: error.message
        });
    }
});

// 🔍 GET ORDER BY ORDER NUMBER
router.get("/get-invoice/:orderNumber", async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const order = await Order.findOne({ orderNumber });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.status(200).json({ success: true, data: order });
    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({ success: false, message: "Failed to fetch order", error: error.message });
    }
});

// ✏️ UPDATE ORDER
router.put("/update-invoice/:orderNumber", async (req, res) => {
    const startTime = Date.now();
    const requestId = `UPDATE_ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        const { orderNumber } = req.params;
        const { customer, payment, remarks, deliveryAddress } = req.body;

        console.log(`🔄 [${requestId}] Updating order: ${orderNumber}`);

        const order = await Order.findOne({ orderNumber });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found", requestId });
        }

        if (order.orderType !== 'offline') {
            return res.status(400).json({ success: false, message: "This route is only for updating offline orders", requestId });
        }

        const updatePayload = {};
        const changes = [];

        if (deliveryAddress !== undefined) {
            if (deliveryAddress === null) {
                updatePayload.deliveryAddress = null;
                changes.push("Delivery address: Cleared (same as billing)");
            } else if (typeof deliveryAddress === 'object') {
                if (!deliveryAddress.fullName || !deliveryAddress.mobile) {
                    return res.status(400).json({ success: false, message: "Delivery name and mobile are required", requestId });
                }

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

        if (payment && payment.method) {
            if (payment.method !== order.payment.method) {
                updatePayload["payment.method"] = payment.method;
                changes.push(`Payment method: ${order.payment.method} → ${payment.method}`);
            }
        }

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

        if (remarks !== undefined && remarks !== order.remarks) {
            updatePayload.remarks = remarks;
            changes.push(`Remarks updated`);
        }

        if (Object.keys(updatePayload).length === 0) {
            return res.status(200).json({ success: true, message: "No changes detected", data: order, requestId, changes: [] });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber },
            updatePayload,
            { new: true, runValidators: true }
        );

        const processingTime = Date.now() - startTime;

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
        res.status(500).json({ success: false, message: "Failed to update order", error: error.message, requestId, processingTime: `${processingTime}ms` });
    }
});

// 🗑️ DELETE ORDER (now archives instead of hard delete + releases number)
router.delete("/delete-invoice/:orderNumber", auth, async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const { reason } = req.body || {};

        console.log(`🗑️ Attempting to delete order: ${orderNumber}`);

        const orderToDelete = await Order.findOne({ orderNumber });
        if (!orderToDelete) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (orderToDelete.orderType !== 'offline') {
            return res.status(400).json({
                success: false,
                message: "This route is only for deleting offline orders. Online orders must be cancelled instead."
            });
        }

        // Restore stock + ProductStockHistory
        await restoreOrderStock(orderToDelete, reason || 'Deleted', 'delete-route');

        // Archive + delete + release number
        await archiveCancelledOrder(orderToDelete, req, reason || '', 'delete-route');

        console.log(`✅ Order deleted & archived: ${orderNumber}`);

        res.status(200).json({
            success: true,
            message: "Order deleted, archived, and inventory restored"
        });

    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, message: "Failed to delete order", error: error.message });
    }
});

// ======================================================================
// SECTION 3: COMMON/UNIFIED ROUTES
// ======================================================================

// 📊 GET DASHBOARD STATS
router.get("/dashboard/stats", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);

        const matchStage = {};
        if (startDate || endDate) {
            matchStage.createdAt = dateFilter;
        }

        const overallStats = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: "$total" },
                    onlineOrders: { $sum: { $cond: [{ $eq: ["$orderType", "online"] }, 1, 0] } },
                    offlineOrders: { $sum: { $cond: [{ $eq: ["$orderType", "offline"] }, 1, 0] } },
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayStats = await Order.aggregate([
            { $match: { createdAt: { $gte: today } } },
            {
                $group: {
                    _id: null,
                    todayOrders: { $sum: 1 },
                    todayRevenue: { $sum: "$total" }
                }
            }
        ]);

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
                todayStats: todayStats[0] || { todayOrders: 0, todayRevenue: 0 },
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
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats', error: error.message });
    }
});

// 🔄 UPDATE ORDER PRODUCTS
router.put("/update-order-products/:orderNumber", async (req, res) => {
    const requestId = `UPDATE_PROD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
        const { orderNumber } = req.params;
        const { updatedItems, originalItems, userDetails } = req.body;

        console.log(`🔄 [${requestId}] Updating order products: ${orderNumber}`);

        if (!updatedItems || !Array.isArray(updatedItems)) {
            return res.status(400).json({ success: false, message: "Updated items are required", requestId });
        }
        if (!originalItems || !Array.isArray(originalItems)) {
            return res.status(400).json({ success: false, message: "Original items are required", requestId });
        }

        const order = await Order.findOne({ orderNumber });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found", requestId });
        }

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

        const changes = {
            itemsToRestore: [],
            itemsToDeduct: [],
            itemsUnchanged: []
        };

        for (const [key, originalItem] of originalMap.entries()) {
            const updatedItem = updatedMap.get(key);
            if (!updatedItem) {
                changes.itemsToRestore.push({ ...originalItem, changeType: "removed", quantityToRestore: originalItem.quantity });
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
                changes.itemsToDeduct.push({ ...updatedItem, changeType: "added", quantityToDeduct: updatedItem.quantity });
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
            return res.status(400).json({ success: false, message: "Inventory validation failed", validationErrors, requestId });
        }

        // RESTORE items
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
                orderNumber,
                orderType: order.orderType,
                reason: `Invoice ${orderNumber} edit - ${item.changeType}`,
                notes: `Product: ${item.productName} | Restored: ${item.quantityToRestore}`,
                addedBy: userDetails?.name || "system",
                date: new Date()
            });

            await productStockDoc.save();
            await inventoryItem.save();
        }

        // DEDUCT items
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
                orderNumber,
                orderType: order.orderType,
                reason: `Invoice ${orderNumber} edit - ${item.changeType}`,
                notes: `Product: ${item.productName} | Deducted: ${item.quantityToDeduct}`,
                addedBy: userDetails?.name || "system",
                date: new Date()
            });

            await productStockDoc.save();
            await inventoryItem.save();
        }

        // Recalc totals
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