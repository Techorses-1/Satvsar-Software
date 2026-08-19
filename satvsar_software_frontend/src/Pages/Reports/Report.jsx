// Reports.jsx (COMPLETE WITH MULTI-SHEET EXPORT)
import React, { useState, useEffect } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import {
    FiDollarSign,
    FiShoppingCart,
    FiPackage,
    FiAlertTriangle,
    FiCalendar,
    FiTrendingUp,
    FiTrendingDown,
    FiClock,
    FiDownload,
} from "react-icons/fi";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import * as XLSX from "xlsx";
import "./Report.scss";

const Reports = () => {
    // Tab state
    const [activeTab, setActiveTab] = useState("sales-purchase");

    // Time filter states
    const [timeFilter, setTimeFilter] = useState("today");
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

    // Daily sales date picker
    const [dailySalesDate, setDailySalesDate] = useState("");
    const [dailySalesFilter, setDailySalesFilter] = useState("today");

    // Order type filter (offline/online/both)
    const [orderType, setOrderType] = useState("both");

    // Data states
    const [salesPurchaseData, setSalesPurchaseData] = useState(null);
    const [inventoryExpiryData, setInventoryExpiryData] = useState(null);
    const [trendingData, setTrendingData] = useState(null);
    const [dailySalesData, setDailySalesData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Chart colors
    const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#a4de6c"];
    const ONLINE_COLOR = "#8884d8";
    const OFFLINE_COLOR = "#82ca9d";

    // API base URL
    const API_URL = import.meta.env.VITE_API_URL;

    // Fetch data based on active tab
    useEffect(() => {
        if (activeTab === "sales-purchase") {
            fetchSalesPurchaseData();
        } else if (activeTab === "inventory-expiry") {
            fetchInventoryExpiryData();
        } else if (activeTab === "trending") {
            fetchTrendingData();
        } else if (activeTab === "daily-sales") {
            fetchDailySalesData();
        }
    }, [activeTab, timeFilter, customStartDate, customEndDate, orderType, dailySalesFilter, dailySalesDate]);

    // Get date range for API
    const getDateRange = () => {
        const today = new Date();
        let startDate, endDate;

        switch (timeFilter) {
            case "today":
                startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
                endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
                break;
            case "thisweek":
                const dayOfWeek = today.getUTCDay();
                const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const weekStart = new Date(today);
                weekStart.setUTCDate(today.getUTCDate() - diffToMonday);
                startDate = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate(), 0, 0, 0, 0));
                endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
                break;
            case "thismonth":
                startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
                break;
            case "thisyear":
                startDate = new Date(Date.UTC(today.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
                break;
            case "custom":
                if (customStartDate && customEndDate) {
                    const startParts = customStartDate.split('-');
                    const endParts = customEndDate.split('-');
                    startDate = new Date(Date.UTC(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]), 0, 0, 0, 0));
                    endDate = new Date(Date.UTC(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]), 23, 59, 59, 999));
                } else {
                    startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
                    endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
                }
                break;
            default:
                startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));
                endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
        }
        return { startDate, endDate };
    };

    // Get single date for daily sales
    const getFormattedDateForDailySales = () => {
        const today = new Date();
        if (dailySalesFilter === "today") {
            return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
        } else if (dailySalesFilter === "yesterday") {
            const yesterday = new Date(today);
            yesterday.setUTCDate(today.getUTCDate() - 1);
            return `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`;
        } else if (dailySalesFilter === "custom" && dailySalesDate) {
            return dailySalesDate;
        }
        return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    };

    // Fetch Sales & Purchase Data
    const fetchSalesPurchaseData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { startDate, endDate } = getDateRange();
            const salesResponse = await fetch(`${API_URL}/reports/sales?filter=custom&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&orderType=${orderType}`);
            const salesResult = await salesResponse.json();
            const purchaseResponse = await fetch(`${API_URL}/reports/purchases?filter=custom&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
            const purchaseResult = await purchaseResponse.json();
            setSalesPurchaseData({
                sales: salesResult.success ? salesResult : null,
                purchases: purchaseResult.success ? purchaseResult : null
            });
        } catch (err) {
            console.error("Error fetching sales/purchase data:", err);
            setError("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    // Fetch Inventory & Expiry Data
    const fetchInventoryExpiryData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [inventoryRes, expiryRes] = await Promise.all([
                fetch(`${API_URL}/reports/inventory`),
                fetch(`${API_URL}/reports/expiry`)
            ]);
            const inventoryResult = await inventoryRes.json();
            const expiryResult = await expiryRes.json();
            setInventoryExpiryData({
                inventory: inventoryResult.success ? inventoryResult : null,
                expiry: expiryResult.success ? expiryResult : null
            });
        } catch (err) {
            console.error("Error fetching inventory/expiry data:", err);
            setError("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    // Fetch Trending Products Data
    const fetchTrendingData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { startDate, endDate } = getDateRange();
            const response = await fetch(`${API_URL}/reports/trending?filter=custom&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&orderType=${orderType}&limit=100`);
            const result = await response.json();
            setTrendingData(result.success ? result : null);
        } catch (err) {
            console.error("Error fetching trending data:", err);
            setError("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    // Fetch Daily Sales Data
    const fetchDailySalesData = async () => {
        setLoading(true);
        setError(null);
        try {
            const formattedDate = getFormattedDateForDailySales();
            const response = await fetch(`${API_URL}/reports/daily-sales?filter=custom&selectedDate=${formattedDate}&orderType=${orderType}`);
            const result = await response.json();
            setDailySalesData(result.success ? result : null);
        } catch (err) {
            console.error("Error fetching daily sales data:", err);
            setError("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    // ========== EXPORT FUNCTIONS WITH MULTIPLE SHEETS ==========

    // Export Sales Data (4 sheets)
    const exportSalesData = () => {
        if (!salesPurchaseData?.sales) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryData = [{
            "Total Sales": salesPurchaseData.sales.summary?.totalSales || 0,
            "Order Count": salesPurchaseData.sales.summary?.orderCount || 0,
            "Average Order Value": salesPurchaseData.sales.summary?.averageOrderValue || 0,
            "Online Sales": salesPurchaseData.sales.summary?.onlineSales || 0,
            "Offline Sales": salesPurchaseData.sales.summary?.offlineSales || 0,
            "Online Orders": salesPurchaseData.sales.summary?.onlineOrders || 0,
            "Offline Orders": salesPurchaseData.sales.summary?.offlineOrders || 0
        }];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        // Sheet 2: Orders List
        const ordersData = (salesPurchaseData.sales.orders || []).map(order => ({
            "Order Number": order.orderNumber,
            "Date": new Date(order.date).toLocaleDateString(),
            "Customer Name": order.customerName || "Guest",
            "Order Type": order.orderType === "online" ? "Online" : "Offline",
            "Total Amount": order.total,
            "Items Count": order.itemsCount
        }));
        const wsOrders = XLSX.utils.json_to_sheet(ordersData);
        XLSX.utils.book_append_sheet(wb, wsOrders, "Orders List");

        // Sheet 3: Products Sold
        const productsData = (salesPurchaseData.sales.productsSold || []).map(product => ({
            "Product Name": product.productName,
            "Quantity Sold": product.quantitySold,
            "Revenue": product.revenue,
            "Order Count": product.orderCount
        }));
        const wsProducts = XLSX.utils.json_to_sheet(productsData);
        XLSX.utils.book_append_sheet(wb, wsProducts, "Products Sold");

        // Sheet 4: Order-wise Products
        const orderItemsData = (salesPurchaseData.sales.orderItems || []).map(item => ({
            "Order Number": item.orderNumber,
            "Order Date": new Date(item.orderDate).toLocaleDateString(),
            "Order Type": item.orderType === "online" ? "Online" : "Offline",
            "Customer Name": item.customerName || "Guest",
            "Product Name": item.productName,
            "Quantity": item.quantity,
            "Price": item.price,
            "Total": item.total
        }));
        const wsOrderItems = XLSX.utils.json_to_sheet(orderItemsData);
        XLSX.utils.book_append_sheet(wb, wsOrderItems, "Order-wise Products");

        const fileName = `Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Export Purchase Data (2 sheets)
    const exportPurchaseData = () => {
        if (!salesPurchaseData?.purchases) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryData = [{
            "Total Purchases": salesPurchaseData.purchases.summary?.totalPurchases || 0,
            "Total Quantity": salesPurchaseData.purchases.summary?.totalQuantity || 0,
            "Batch Count": salesPurchaseData.purchases.summary?.batchCount || 0,
            "Average Purchase Value": salesPurchaseData.purchases.summary?.averagePurchaseValue || 0
        }];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        // Sheet 2: Batches List (each addition separately)
        const batchesData = (salesPurchaseData.purchases.batches || []).map(batch => ({
            "Product Name": batch.productName,
            "Batch Number": batch.batchNumber,
            "Price per Unit": batch.price,
            "Quantity Added": batch.quantityAdded,
            "Total Amount": batch.totalAmount,
            "Added Date": new Date(batch.addedAt).toLocaleString(),
            "Manufacture Date": new Date(batch.manufactureDate).toLocaleDateString(),
            "Expiry Date": new Date(batch.expiryDate).toLocaleDateString(),
            "Status": batch.status
        }));
        const wsBatches = XLSX.utils.json_to_sheet(batchesData);
        XLSX.utils.book_append_sheet(wb, wsBatches, "Batches List");

        const fileName = `Purchase_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Export Inventory Data (2 sheets)
    const exportInventoryData = () => {
        if (!inventoryExpiryData?.inventory) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: Inventory Summary
        const summaryData = inventoryExpiryData.inventory.items.map(item => ({
            "Product Name": item.productName,
            "Category": item.category || "General",
            "Stock": item.stock,
            "Threshold": item.threshold,
            "Status": item.stockStatus === "in-stock" ? "In Stock" : item.stockStatus === "low-stock" ? "Low Stock" : "Out of Stock",
            "Value": item.value,
            "Type": item.inventoryType === "batch" ? "Batch Product" : "Simple Product"
        }));
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Inventory Summary");

        // Sheet 2: Batch Details (for batch products)
        const batchData = (inventoryExpiryData.inventory.batchDetails || []).map(batch => ({
            "Product Name": batch.productName,
            "Batch Number": batch.batchNumber,
            "Total Quantity": batch.quantity,
            "Current Quantity": batch.currentQuantity,
            "Price per Unit": batch.price,
            "Manufacture Date": new Date(batch.manufactureDate).toLocaleDateString(),
            "Expiry Date": new Date(batch.expiryDate).toLocaleDateString(),
            "Added Date": new Date(batch.addedAt).toLocaleString(),
            "Status": batch.status
        }));
        if (batchData.length > 0) {
            const wsBatch = XLSX.utils.json_to_sheet(batchData);
            XLSX.utils.book_append_sheet(wb, wsBatch, "Batch Details");
        }

        const fileName = `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Export Expiry Data
    const exportExpiryData = () => {
        if (!inventoryExpiryData?.expiry) return;

        const wb = XLSX.utils.book_new();

        const expiringData = (inventoryExpiryData.expiry.expiringItems || []).map(item => ({
            "Product Name": item.productName,
            "Batch Number": item.batchNumber,
            "Expiry Date": new Date(item.expiryDate).toLocaleDateString(),
            "Quantity": item.quantity,
            "Days Until Expiry": item.daysUntilExpiry,
            "Status": "Expiring Soon"
        }));
        const wsExpiring = XLSX.utils.json_to_sheet(expiringData);
        XLSX.utils.book_append_sheet(wb, wsExpiring, "Expiring Soon");

        const expiredData = (inventoryExpiryData.expiry.expiredItems || []).map(item => ({
            "Product Name": item.productName,
            "Batch Number": item.batchNumber,
            "Expiry Date": new Date(item.expiryDate).toLocaleDateString(),
            "Quantity": item.quantity,
            "Status": "Expired"
        }));
        const wsExpired = XLSX.utils.json_to_sheet(expiredData);
        XLSX.utils.book_append_sheet(wb, wsExpired, "Expired");

        const fileName = `Expiry_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Export Trending Products (2 sheets)
    const exportTrendingData = () => {
        if (!trendingData) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: Top Products
        const topProductsData = (trendingData.byQuantity || []).map((product, index) => ({
            "Rank": index + 1,
            "Product Name": product.productName,
            "Quantity Sold": product.totalSold,
            "Revenue": product.totalRevenue,
            "Orders Count": product.orderCount
        }));
        const wsTop = XLSX.utils.json_to_sheet(topProductsData);
        XLSX.utils.book_append_sheet(wb, wsTop, "Top Products");

        // Sheet 2: Product Sales Details
        const productDetailsData = (trendingData.productOrderDetails || []).map(detail => ({
            "Product Name": detail.productName,
            "Order Number": detail.orderNumber,
            "Order Date": new Date(detail.orderDate).toLocaleDateString(),
            "Order Type": detail.orderType === "online" ? "Online" : "Offline",
            "Customer Name": detail.customerName || "Guest",
            "Quantity": detail.quantity,
            "Price": detail.price,
            "Revenue": detail.revenue
        }));
        const wsDetails = XLSX.utils.json_to_sheet(productDetailsData);
        XLSX.utils.book_append_sheet(wb, wsDetails, "Product Sales Details");

        const fileName = `Trending_Products_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Export Daily Sales Data (3 sheets)
    const exportDailySalesData = () => {
        if (!dailySalesData) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryData = [{
            "Date": dailySalesData.summary?.date || "N/A",
            "Total Sales": dailySalesData.summary?.totalSales || 0,
            "Order Count": dailySalesData.summary?.orderCount || 0,
            "Average Order Value": dailySalesData.summary?.averageOrderValue || 0,
            "Online Sales": dailySalesData.summary?.onlineSales || 0,
            "Offline Sales": dailySalesData.summary?.offlineSales || 0,
            "Online Orders": dailySalesData.summary?.onlineOrders || 0,
            "Offline Orders": dailySalesData.summary?.offlineOrders || 0
        }];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        // Sheet 2: Orders List
        const ordersData = (dailySalesData.orders || []).map(order => ({
            "Order Number": order.orderNumber,
            "Time": new Date(order.time).toLocaleTimeString(),
            "Customer Name": order.customerName || "Guest",
            "Order Type": order.orderType === "online" ? "Online" : "Offline",
            "Total Amount": order.total,
            "Items Count": order.itemsCount
        }));
        const wsOrders = XLSX.utils.json_to_sheet(ordersData);
        XLSX.utils.book_append_sheet(wb, wsOrders, "Orders List");

        // Sheet 3: Order Items
        const orderItemsData = (dailySalesData.orderItems || []).map(item => ({
            "Order Number": item.orderNumber,
            "Time": new Date(item.orderTime).toLocaleTimeString(),
            "Order Type": item.orderType === "online" ? "Online" : "Offline",
            "Customer Name": item.customerName || "Guest",
            "Product Name": item.productName,
            "Quantity": item.quantity,
            "Price": item.price,
            "Total": item.total
        }));
        const wsItems = XLSX.utils.json_to_sheet(orderItemsData);
        XLSX.utils.book_append_sheet(wb, wsItems, "Order Items");

        const fileName = `Daily_Sales_${dailySalesData.summary?.date || new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Format currency
    const formatCurrency = (value) => `₹${(value || 0).toLocaleString()}`;

    // Format date
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

    // Get daily sales filter name
    const getDailySalesFilterName = () => {
        if (dailySalesFilter === "today") return "Today";
        if (dailySalesFilter === "yesterday") return "Yesterday";
        if (dailySalesFilter === "custom" && dailySalesDate) {
            const [year, month, day] = dailySalesDate.split('-');
            return `${day}/${month}/${year}`;
        }
        return "Select Date";
    };

    return (
        <div>
            <Navbar>
                <div className="reports-container">
                    {/* Header */}
                    <div className="reports-header">
                        <h1>Reports</h1>
                        <p>View and analyze your business data</p>
                    </div>

                    {/* Main Tabs */}
                    <div className="reports-tabs">
                        <button className={`tab-btn ${activeTab === "sales-purchase" ? "active" : ""}`} onClick={() => setActiveTab("sales-purchase")}>
                            <FiDollarSign /> Sales & Purchase
                        </button>
                        <button className={`tab-btn ${activeTab === "inventory-expiry" ? "active" : ""}`} onClick={() => setActiveTab("inventory-expiry")}>
                            <FiPackage /> Inventory & Expiry
                        </button>
                        <button className={`tab-btn ${activeTab === "trending" ? "active" : ""}`} onClick={() => setActiveTab("trending")}>
                            <FiTrendingUp /> Trending Products
                        </button>
                        <button className={`tab-btn ${activeTab === "daily-sales" ? "active" : ""}`} onClick={() => setActiveTab("daily-sales")}>
                            <FiClock /> Daily Sales
                        </button>
                    </div>

                    {/* Filters Bar */}
                    {(activeTab === "sales-purchase" || activeTab === "trending") && (
                        <div className="filters-bar">
                            <div className="time-filters">
                                <button className={`filter-btn ${timeFilter === "today" ? "active" : ""}`} onClick={() => { setTimeFilter("today"); setShowCustomDatePicker(false); }}>Today</button>
                                <button className={`filter-btn ${timeFilter === "thisweek" ? "active" : ""}`} onClick={() => { setTimeFilter("thisweek"); setShowCustomDatePicker(false); }}>This Week</button>
                                <button className={`filter-btn ${timeFilter === "thismonth" ? "active" : ""}`} onClick={() => { setTimeFilter("thismonth"); setShowCustomDatePicker(false); }}>This Month</button>
                                <button className={`filter-btn ${timeFilter === "thisyear" ? "active" : ""}`} onClick={() => { setTimeFilter("thisyear"); setShowCustomDatePicker(false); }}>This Year</button>
                                <button className={`filter-btn ${timeFilter === "custom" ? "active" : ""}`} onClick={() => { setTimeFilter("custom"); setShowCustomDatePicker(!showCustomDatePicker); }}>Custom</button>
                            </div>
                            {timeFilter === "custom" && showCustomDatePicker && (
                                <div className="custom-date-picker">
                                    <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} placeholder="Start Date" />
                                    <span>to</span>
                                    <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} placeholder="End Date" />
                                </div>
                            )}
                            <div className="order-type-filters">
                                <button className={`order-type-btn ${orderType === "offline" ? "active" : ""}`} onClick={() => setOrderType("offline")}>Offline</button>
                                <button className={`order-type-btn ${orderType === "online" ? "active" : ""}`} onClick={() => setOrderType("online")}>Online</button>
                                <button className={`order-type-btn ${orderType === "both" ? "active" : ""}`} onClick={() => setOrderType("both")}>Both</button>
                            </div>
                        </div>
                    )}

                    {/* Daily Sales Filters */}
                    {activeTab === "daily-sales" && (
                        <div className="filters-bar">
                            <div className="time-filters">
                                <button className={`filter-btn ${dailySalesFilter === "today" ? "active" : ""}`} onClick={() => { setDailySalesFilter("today"); setDailySalesDate(""); }}>Today</button>
                                <button className={`filter-btn ${dailySalesFilter === "yesterday" ? "active" : ""}`} onClick={() => { setDailySalesFilter("yesterday"); setDailySalesDate(""); }}>Yesterday</button>
                                <button className={`filter-btn ${dailySalesFilter === "custom" ? "active" : ""}`} onClick={() => setDailySalesFilter("custom")}>Select Date</button>
                                {dailySalesFilter === "custom" && (<input type="date" className="date-picker-input" value={dailySalesDate} onChange={(e) => setDailySalesDate(e.target.value)} />)}
                            </div>
                            <div className="order-type-filters">
                                <button className={`order-type-btn ${orderType === "offline" ? "active" : ""}`} onClick={() => setOrderType("offline")}>Offline</button>
                                <button className={`order-type-btn ${orderType === "online" ? "active" : ""}`} onClick={() => setOrderType("online")}>Online</button>
                                <button className={`order-type-btn ${orderType === "both" ? "active" : ""}`} onClick={() => setOrderType("both")}>Both</button>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (<div className="loading-state"><div className="spinner"></div><p>Loading data...</p></div>)}

                    {/* Error State */}
                    {error && (<div className="error-state"><FiAlertTriangle /><p>{error}</p></div>)}

                    {/* Content */}
                    {!loading && !error && (
                        <>
                            {/* Tab 1: Sales & Purchase */}
                            {activeTab === "sales-purchase" && salesPurchaseData && (
                                <div className="tab-content">
                                    <div className="tab-header">
                                        <h2>Sales & Purchase Report</h2>
                                        <div className="export-buttons">
                                            <button className="export-btn" onClick={exportSalesData}><FiDownload /> Export Sales (4 Sheets)</button>
                                            <button className="export-btn" onClick={exportPurchaseData}><FiDownload /> Export Purchases (2 Sheets)</button>
                                        </div>
                                    </div>

                                    {/* Sales Summary Cards */}
                                    <div className="summary-grid">
                                        <div className="summary-card sales-card"><FiDollarSign className="card-icon" /><div><h3>Total Sales</h3><p className="amount">{formatCurrency(salesPurchaseData.sales?.summary?.totalSales)}</p><small>{salesPurchaseData.sales?.summary?.orderCount} orders</small></div></div>
                                        <div className="summary-card online-card"><FiTrendingUp className="card-icon" /><div><h3>Online Sales</h3><p className="amount">{formatCurrency(salesPurchaseData.sales?.summary?.onlineSales)}</p><small>{salesPurchaseData.sales?.summary?.onlineOrders} orders</small></div></div>
                                        <div className="summary-card offline-card"><FiTrendingDown className="card-icon" /><div><h3>Offline Sales</h3><p className="amount">{formatCurrency(salesPurchaseData.sales?.summary?.offlineSales)}</p><small>{salesPurchaseData.sales?.summary?.offlineOrders} orders</small></div></div>
                                        <div className="summary-card purchase-card"><FiShoppingCart className="card-icon" /><div><h3>Total Purchases</h3><p className="amount">{formatCurrency(salesPurchaseData.purchases?.summary?.totalPurchases)}</p><small>{salesPurchaseData.purchases?.summary?.batchCount} batches</small></div></div>
                                    </div>

                                    {/* Recent Orders Table */}
                                    <div className="table-card">
                                        <h3>Recent Orders</h3>
                                        <div className="table-responsive">
                                            <table><thead><tr><th>Order #</th><th>Date</th><th>Customer</th><th>Type</th><th>Total</th></tr></thead>
                                                <tbody>{(salesPurchaseData.sales?.orders || []).slice(0, 10).map((order, idx) => (<tr key={idx}><td>{order.orderNumber}</td><td>{formatDate(order.date)}</td><td>{order.customerName || "Guest"}</td><td><span className={`badge ${order.orderType}`}>{order.orderType}</span></td><td>{formatCurrency(order.total)}</td></tr>))}</tbody></table>
                                        </div>
                                    </div>

                                    {/* Purchase Batches Table */}
                                    <div className="table-card">
                                        <h3>Recent Purchase Batches</h3>
                                        <div className="table-responsive">
                                            <table><thead><tr><th>Product</th><th>Batch</th><th>Price</th><th>Quantity</th><th>Total</th><th>Added Date</th></tr></thead>
                                                <tbody>{(salesPurchaseData.purchases?.batches || []).slice(0, 10).map((batch, idx) => (<tr key={idx}><td>{batch.productName}</td><td>{batch.batchNumber}</td><td>{formatCurrency(batch.price)}</td><td>{batch.quantityAdded}</td><td>{formatCurrency(batch.totalAmount)}</td><td>{formatDate(batch.addedAt)}</td></tr>))}</tbody></table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab 2: Inventory & Expiry */}
                            {activeTab === "inventory-expiry" && inventoryExpiryData && (
                                <div className="tab-content">
                                    <div className="tab-header">
                                        <h2>Inventory & Expiry Report</h2>
                                        <div className="export-buttons">
                                            <button className="export-btn" onClick={exportInventoryData}><FiDownload /> Export Inventory (2 Sheets)</button>
                                            <button className="export-btn" onClick={exportExpiryData}><FiDownload /> Export Expiry</button>
                                        </div>
                                    </div>

                                    {/* Inventory Summary Cards */}
                                    <div className="summary-grid">
                                        <div className="summary-card inventory-card"><FiPackage className="card-icon" /><div><h3>Total Items</h3><p className="amount">{inventoryExpiryData.inventory?.summary?.totalItems}</p><small>products in stock</small></div></div>
                                        <div className="summary-card value-card"><FiDollarSign className="card-icon" /><div><h3>Inventory Value</h3><p className="amount">{formatCurrency(inventoryExpiryData.inventory?.summary?.totalValue)}</p><small>total stock value</small></div></div>
                                        <div className="summary-card lowstock-card"><FiAlertTriangle className="card-icon" /><div><h3>Low Stock</h3><p className="amount">{inventoryExpiryData.inventory?.summary?.lowStockCount}</p><small>items below threshold</small></div></div>
                                        <div className="summary-card outstock-card"><FiAlertTriangle className="card-icon" /><div><h3>Out of Stock</h3><p className="amount">{inventoryExpiryData.inventory?.summary?.outOfStockCount}</p><small>items unavailable</small></div></div>
                                    </div>

                                    {/* Inventory Items Table */}
                                    <div className="table-card">
                                        <h3>Inventory Items</h3>
                                        <div className="table-responsive">
                                            <table><thead><tr><th>Product Name</th><th>Category</th><th>Stock</th><th>Threshold</th><th>Status</th><th>Value</th></tr></thead>
                                                <tbody>{(inventoryExpiryData.inventory?.items || []).slice(0, 10).map((item, idx) => (<tr key={idx}><td>{item.productName}</td><td>{item.category || "General"}</td><td>{item.stock}</td><td>{item.threshold}</td><td><span className={`badge ${item.stockStatus}`}>{item.stockStatus === "in-stock" ? "In Stock" : item.stockStatus === "low-stock" ? "Low Stock" : "Out of Stock"}</span></td><td>{formatCurrency(item.value)}</td></tr>))}</tbody></table>
                                        </div>
                                    </div>

                                    {/* Expiring Items */}
                                    {(inventoryExpiryData.expiry?.expiringItems?.length > 0 || inventoryExpiryData.expiry?.expiredItems?.length > 0) && (
                                        <div className="table-card expiry-card">
                                            <h3>Expiry Alerts</h3>
                                            {inventoryExpiryData.expiry?.expiringItems?.length > 0 && (<><h4>Expiring Soon (Within 3 Months)</h4><div className="table-responsive"><table><thead><tr><th>Product</th><th>Batch</th><th>Expiry Date</th><th>Quantity</th><th>Days Left</th></tr></thead><tbody>{(inventoryExpiryData.expiry.expiringItems || []).slice(0, 10).map((item, idx) => (<tr key={idx}><td>{item.productName}</td><td>{item.batchNumber}</td><td>{formatDate(item.expiryDate)}</td><td>{item.quantity}</td><td className="warning">{item.daysUntilExpiry} days</td></tr>))}</tbody></table></div></>)}
                                            {inventoryExpiryData.expiry?.expiredItems?.length > 0 && (<><h4 className="expired-title">Expired Products</h4><div className="table-responsive"><table><thead><tr><th>Product</th><th>Batch</th><th>Expiry Date</th><th>Quantity</th></tr></thead><tbody>{(inventoryExpiryData.expiry.expiredItems || []).slice(0, 10).map((item, idx) => (<tr key={idx} className="expired-row"><td>{item.productName}</td><td>{item.batchNumber}</td><td>{formatDate(item.expiryDate)}</td><td>{item.quantity}</td></tr>))}</tbody></table></div></>)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab 3: Trending Products */}
                            {activeTab === "trending" && trendingData && (
                                <div className="tab-content">
                                    <div className="tab-header">
                                        <h2>Trending Products Report</h2>
                                        <div className="export-buttons">
                                            <button className="export-btn" onClick={exportTrendingData}><FiDownload /> Export Trending (2 Sheets)</button>
                                        </div>
                                    </div>

                                    {/* Summary Cards */}
                                    <div className="summary-grid">
                                        <div className="summary-card products-card"><FiPackage className="card-icon" /><div><h3>Products Sold</h3><p className="amount">{trendingData.summary?.totalProductsSold || 0}</p><small>units sold</small></div></div>
                                        <div className="summary-card revenue-card"><FiDollarSign className="card-icon" /><div><h3>Total Revenue</h3><p className="amount">{formatCurrency(trendingData.summary?.totalRevenue)}</p><small>from sold products</small></div></div>
                                        <div className="summary-card unique-card"><FiTrendingUp className="card-icon" /><div><h3>Unique Products</h3><p className="amount">{trendingData.summary?.uniqueProducts || 0}</p><small>different products</small></div></div>
                                    </div>

                                    {/* Top Products Table */}
                                    <div className="table-card">
                                        <h3>Top Products by Quantity Sold</h3>
                                        <div className="table-responsive">
                                            <table><thead><tr><th>Rank</th><th>Product Name</th><th>Quantity Sold</th><th>Revenue</th><th>Orders</th></tr></thead>
                                                <tbody>{(trendingData.byQuantity || []).slice(0, 10).map((product, idx) => (<tr key={idx}><td>{idx + 1}</td><td>{product.productName}</td><td>{product.totalSold}</td><td>{formatCurrency(product.totalRevenue)}</td><td>{product.orderCount}</td></tr>))}</tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tab 4: Daily Sales */}
                            {activeTab === "daily-sales" && dailySalesData && (
                                <div className="tab-content">
                                    <div className="tab-header">
                                        <h2>Daily Sales Report - {getDailySalesFilterName()}</h2>
                                        <div className="export-buttons">
                                            <button className="export-btn" onClick={exportDailySalesData}><FiDownload /> Export Daily Sales (3 Sheets)</button>
                                        </div>
                                    </div>

                                    {/* Summary Cards */}
                                    <div className="summary-grid">
                                        <div className="summary-card daily-card"><FiCalendar className="card-icon" /><div><h3>{getDailySalesFilterName()}</h3><p className="amount">{formatCurrency(dailySalesData.summary?.totalSales)}</p><small>total sales</small></div></div>
                                        <div className="summary-card orders-card"><FiShoppingCart className="card-icon" /><div><h3>Orders</h3><p className="amount">{dailySalesData.summary?.orderCount || 0}</p><small>orders placed</small></div></div>
                                        <div className="summary-card avg-card"><FiTrendingUp className="card-icon" /><div><h3>Average Order</h3><p className="amount">{formatCurrency(dailySalesData.summary?.averageOrderValue)}</p><small>per order</small></div></div>
                                    </div>

                                    {/* Orders List */}
                                    <div className="table-card">
                                        <h3>Orders - {getDailySalesFilterName()}</h3>
                                        <div className="table-responsive">
                                            <table><thead><tr><th>Time</th><th>Order #</th><th>Customer</th><th>Type</th><th>Total</th><th>Items</th></tr></thead>
                                                <tbody>{(dailySalesData.orders || []).map((order, idx) => (<tr key={idx}><td>{new Date(order.time).toLocaleTimeString()}</td><td>{order.orderNumber}</td><td>{order.customerName || "Guest"}</td><td><span className={`badge ${order.orderType}`}>{order.orderType}</span></td><td>{formatCurrency(order.total)}</td><td>{order.itemsCount}</td></tr>))}
                                                    {(dailySalesData.orders || []).length === 0 && (<tr><td colSpan="6" className="no-data">No orders found for this day</td></tr>)}</tbody></table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Navbar>
        </div>
    );
};

export default Reports;