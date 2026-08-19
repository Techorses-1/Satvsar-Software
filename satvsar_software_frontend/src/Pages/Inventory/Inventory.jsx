import React, { useState, useEffect, useRef, useMemo } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import html2pdf from "html2pdf.js";
import {
    FaFileExport, FaSearch, FaFilter, FaTag,
    FaBox, FaTimes, FaBoxOpen
} from "react-icons/fa";
import "./Inventory.scss";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtPrice = (n) =>
    n != null ? `₹${parseFloat(n).toFixed(2)}` : "—";

const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    }) : "—";

// Get price range across all batches
const getPriceRange = (batches = []) => {
    const active = batches.filter((b) => b.status === "active");
    if (active.length === 0) {
        // fall back to all batches
        const all = batches.map((b) => b.price).filter(Boolean);
        if (all.length === 0) return "—";
        const min = Math.min(...all);
        const max = Math.max(...all);
        return min === max ? fmtPrice(min) : `${fmtPrice(min)} – ${fmtPrice(max)}`;
    }
    const prices = active.map((b) => b.price).filter(Boolean);
    if (prices.length === 0) return "—";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? fmtPrice(min) : `${fmtPrice(min)} – ${fmtPrice(max)}`;
};

// ─── Component ─────────────────────────────────────────────────────────────────

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal
    const [modalItem, setModalItem] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [showLoader, setShowLoader] = useState(false);
    const loaderTimeoutRef = useRef(null);

    const [inventoryTypeFilter, setInventoryTypeFilter] = useState("all");
    const [stockFilter, setStockFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    // ── Fetch ───────────────────────────────────────────────────────────────────

    useEffect(() => {
        window.scrollTo(0, 0);
        fetchData();
    }, []);

    // Debounced search
    useEffect(() => {
        if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);

        if (searchTerm.trim()) {
            loaderTimeoutRef.current = setTimeout(() => setShowLoader(true), 300);

            const t = setTimeout(() => {
                if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
                setDebouncedSearch(searchTerm.trim().toLowerCase());
                setCurrentPage(1);
                setShowLoader(false);
            }, 300);

            return () => {
                clearTimeout(t);
                if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
                setShowLoader(false);
            };
        } else {
            setDebouncedSearch("");
            setCurrentPage(1);
            setShowLoader(false);
        }
    }, [searchTerm]);

    const fetchData = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/inventory/all`);
            if (!Array.isArray(res.data)) {
                setError("Invalid inventory data format");
                setLoading(false);
                return;
            }

            const processed = res.data.map((item) => {
                let status = "In Stock";
                if (item.stock === 0) status = "Out of Stock";
                else if (item.stock < (item.threshold || 10)) status = "Low Stock";

                if (item.inventoryType === "simple") {
                    return {
                        inventoryId: item.inventoryId,
                        productName: item.productName,
                        category: item.category,
                        hsnCode: item.hsnCode,
                        totalQuantity: item.stock,
                        status,
                        inventoryType: "simple",
                        modelName: item.modelName,
                        colorName: item.colorName,
                        variableModelName: item.variableModelName,
                        threshold: item.threshold,
                        stockHistory: item.stockHistory || [],
                        totalValue: item.totalValue || 0,
                        sellingPrice: item.sellingPrice || 0,
                    };
                } else {
                    return {
                        inventoryId: item.inventoryId,
                        productName: item.productName,
                        category: item.category,
                        hsnCode: item.hsnCode,
                        totalQuantity: item.stock,
                        status,
                        inventoryType: "batch",
                        batches: item.batches || [],
                        stockHistory: item.stockHistory || [],
                        totalValue: item.totalValue || 0,
                        threshold: item.threshold,
                    };
                }
            });

            setInventory(processed);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError("Failed to load inventory data");
            setLoading(false);
        }
    };

    // ── Filtered + paginated ────────────────────────────────────────────────────

    const filteredInventory = useMemo(() => {
        let r = inventory;
        if (inventoryTypeFilter !== "all") r = r.filter((i) => i.inventoryType === inventoryTypeFilter);
        if (stockFilter === "low") r = r.filter((i) => i.status === "Low Stock");
        if (stockFilter === "out") r = r.filter((i) => i.status === "Out of Stock");
        if (debouncedSearch) {
            r = r.filter((i) =>
                [i.productName, i.category, i.hsnCode, i.status, i.modelName, i.colorName]
                    .some((v) => v?.toLowerCase().includes(debouncedSearch))
            );
        }
        return r;
    }, [inventory, inventoryTypeFilter, stockFilter, debouncedSearch]);

    const paginatedInventory = useMemo(() => {
        if (debouncedSearch) return filteredInventory;
        return filteredInventory.slice(0, currentPage * itemsPerPage);
    }, [filteredInventory, currentPage, itemsPerPage, debouncedSearch]);

    const hasMore = !debouncedSearch && currentPage * itemsPerPage < filteredInventory.length;

    // ── Export ──────────────────────────────────────────────────────────────────

    const exportToExcel = () => {
        try {
            const data = filteredInventory.map((item) => ({
                "Product Name": item.productName,
                "Category": item.category,
                "Type": item.inventoryType === "simple" ? "Simple" : "Batch",
                "Variant": item.inventoryType === "simple"
                    ? `${item.modelName || ""}${item.colorName ? ` - ${item.colorName}` : ""}` : "-",
                "HSN Code": item.hsnCode || "-",
                "Total Quantity": item.totalQuantity,
                "Threshold": item.threshold || 10,
                "Status": item.status,
                "Inventory Value": `₹${item.totalValue?.toFixed(2) || "0.00"}`,
            }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Inventory");
            XLSX.writeFile(wb, `inventory_export_${new Date().toISOString().split("T")[0]}.xlsx`);
            toast.success("Inventory exported successfully!");
        } catch {
            toast.error("Failed to export inventory");
        }
    };

    const exportWithBatches = () => {
        try {
            const data = [];
            filteredInventory.forEach((item) => {
                data.push({
                    "Product Name": item.productName,
                    "Category": item.category,
                    "Type": item.inventoryType === "simple" ? "Simple" : "Batch",
                    "HSN Code": item.hsnCode || "-",
                    "Total Quantity": item.totalQuantity,
                    "Threshold": item.threshold || 10,
                    "Status": item.status,
                    "Inventory Value": `₹${item.totalValue?.toFixed(2) || "0.00"}`,
                    "Batch Number": "-", "Current Qty": "-",
                    "Mfg Date": "-", "Expiry Date": "-", "Purchase Price": "-", "Batch Status": "-",
                });
                if (item.inventoryType === "batch") {
                    item.batches?.forEach((b) => {
                        data.push({
                            "Product Name": "", "Category": "", "Type": "", "HSN Code": "",
                            "Total Quantity": "", "Threshold": "", "Status": "", "Inventory Value": "",
                            "Batch Number": b.batchNumber,
                            "Batch Qty": b.quantity,
                            "Current Qty": b.currentQuantity,
                            "Mfg Date": fmtDate(b.manufactureDate),
                            "Expiry Date": fmtDate(b.expiryDate),
                            "Purchase Price": fmtPrice(b.price),
                            "Batch Status": b.status,
                        });
                    });
                }
            });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Inventory with Details");
            XLSX.writeFile(wb, `inventory_details_${new Date().toISOString().split("T")[0]}.xlsx`);
            toast.success("Inventory with details exported successfully!");
        } catch {
            toast.error("Failed to export inventory with details");
        }
    };

    // ── Modal helpers ───────────────────────────────────────────────────────────

    const openModal = (item) => setModalItem(item);
    const closeModal = () => setModalItem(null);

    // ── Batch modal computed values ─────────────────────────────────────────────

    const batchModalStats = useMemo(() => {
        if (!modalItem || modalItem.inventoryType !== "batch") return null;
        const batches = modalItem.batches || [];
        const active = batches.filter((b) => b.status === "active");
        const expired = batches.filter((b) => b.status === "expired");
        const soldOut = batches.filter((b) => b.status === "sold-out");
        const totalStock = active.reduce((s, b) => s + (b.currentQuantity || 0), 0);
        const priceRange = getPriceRange(batches);
        return { total: batches.length, active: active.length, expired: expired.length, soldOut: soldOut.length, totalStock, priceRange };
    }, [modalItem]);

    // ── Render ──────────────────────────────────────────────────────────────────

    if (error) {
        return (
            <Navbar>
                <div className="inventory-page">
                    <div className="no-data">{error}</div>
                </div>
            </Navbar>
        );
    }

    return (
        <Navbar>
            <ToastContainer position="top-center" autoClose={5000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover />

            <div className="inventory-page">

                {/* ── HEADER FILTERS ── */}
                <div className="page-header">
                    <div className="right-section inventory-header-right">

                        <div className="filter-container">
                            <div className="filter-with-icon">
                                <FaFilter className="filter-icon" />
                                <select
                                    value={inventoryTypeFilter}
                                    onChange={(e) => { setInventoryTypeFilter(e.target.value); setCurrentPage(1); }}
                                    className="type-filter"
                                >
                                    <option value="all">All Types</option>
                                    <option value="simple">Simple Products</option>
                                    <option value="batch">Batch Products</option>
                                </select>
                            </div>
                        </div>

                        <div className="filter-container">
                            <div className="filter-with-icon">
                                <FaTag className="filter-icon" />
                                <select
                                    value={stockFilter}
                                    onChange={(e) => { setStockFilter(e.target.value); setCurrentPage(1); }}
                                    className="stock-filter"
                                >
                                    <option value="all">All Stock</option>
                                    <option value="low">Low Stock</option>
                                    <option value="out">Out of Stock</option>
                                </select>
                            </div>
                        </div>

                        <div className="search-container">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search inventory..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* ── EXPORT BUTTONS ── */}
                <div className="export-buttons-row">
                    <div className="export-buttons-container">
                        <button className="export-btn" onClick={exportToExcel}>
                            <FaFileExport /> Export Summary
                        </button>
                        <button className="export-with-batches-btn" onClick={exportWithBatches}>
                            <FaFileExport /> Export with Details
                        </button>
                    </div>
                </div>

                {/* ── TABLE ── */}
                <div className="data-table" id="inventory-table">
                    {loading ? (
                        <div className="loading">Loading inventory...</div>
                    ) : inventory.length === 0 ? (
                        <div className="no-data">No inventory items found</div>
                    ) : (
                        <>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Product Name</th>
                                        <th>Type</th>
                                        <th>Variant</th>
                                        <th>Category</th>
                                        <th>HSN Code</th>
                                        <th>Total Quantity</th>
                                        <th>Threshold</th>
                                        <th>Status</th>
                                        <th>Inventory Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {showLoader ? (
                                        <tr>
                                            <td colSpan="9" style={{ textAlign: "center", padding: "40px" }}>
                                                <div className="table-loader" />
                                            </td>
                                        </tr>
                                    ) : paginatedInventory.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="no-data">No matching records</td>
                                        </tr>
                                    ) : (
                                        paginatedInventory.map((item) => (
                                            <tr
                                                key={item.inventoryId}
                                                className="clickable-row"
                                                onClick={() => openModal(item)}
                                                title="Click to view details"
                                            >
                                                <td>{item.productName}</td>
                                                <td>
                                                    <span className={`type-badge ${item.inventoryType}`}>
                                                        {item.inventoryType === "simple" ? "Simple" : "Batch"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {item.inventoryType === "simple" ? (
                                                        <div className="variant-info">
                                                            {item.modelName && <span className="model-name">{item.modelName}</span>}
                                                            {item.colorName && <span className="color-name">{item.colorName}</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="no-variant">—</span>
                                                    )}
                                                </td>
                                                <td>{item.category}</td>
                                                <td>{item.hsnCode || "—"}</td>
                                                <td>{item.totalQuantity}</td>
                                                <td>{item.threshold || 10}</td>
                                                <td className={
                                                    item.status === "Out of Stock" ? "out-of-stock"
                                                        : item.status === "Low Stock" ? "low-stock"
                                                            : "in-stock"
                                                }>
                                                    {item.status}
                                                </td>
                                                <td className="inventory-value">
                                                    ₹{item.totalValue?.toFixed(2) || "0.00"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {hasMore && (
                                <div className="load-more-container">
                                    <button onClick={() => setCurrentPage((p) => p + 1)} className="load-more-btn">
                                        Load More
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════
          DETAILS MODAL
      ════════════════════════════════════════════════════════ */}
            {modalItem && (
                <div className="inv-modal-overlay" onClick={closeModal}>
                    <div className="inv-modal" onClick={(e) => e.stopPropagation()}>

                        {/* Header */}
                        <div className="inv-modal__header">
                            <div className="inv-modal__header-left">
                                <span className={`type-badge ${modalItem.inventoryType}`} style={{ marginRight: 10 }}>
                                    {modalItem.inventoryType === "simple" ? "Simple" : "Batch"}
                                </span>
                                <div>
                                    <h3 className="inv-modal__title">{modalItem.productName}</h3>
                                    <p className="inv-modal__sub">
                                        {modalItem.category}
                                        {modalItem.hsnCode ? ` · HSN: ${modalItem.hsnCode}` : ""}
                                        {modalItem.inventoryType === "simple" && modalItem.colorName
                                            ? ` · ${modalItem.colorName}` : ""}
                                    </p>
                                </div>
                            </div>
                            <button className="inv-modal__close" onClick={closeModal} title="Close">
                                <FaTimes />
                            </button>
                        </div>

                        <div className="inv-modal__body">

                            {/* ── SIMPLE PRODUCT ── */}
                            {modalItem.inventoryType === "simple" && (
                                <>
                                    {/* Stats */}
                                    <div className="inv-modal__stats">
                                        <div className="inv-modal__stat-item">
                                            <span className="inv-modal__stat-label">Current Stock</span>
                                            <span className={`inv-modal__stat-value ${modalItem.totalQuantity === 0 ? "val--red"
                                                : modalItem.totalQuantity < (modalItem.threshold || 10) ? "val--orange"
                                                    : "val--green"
                                                }`}>
                                                {modalItem.totalQuantity} units
                                            </span>
                                        </div>
                                        <div className="inv-modal__stat-item">
                                            <span className="inv-modal__stat-label">Threshold</span>
                                            <span className="inv-modal__stat-value">{modalItem.threshold || 10}</span>
                                        </div>
                                        <div className="inv-modal__stat-item">
                                            <span className="inv-modal__stat-label">Selling Price</span>
                                            <span className="inv-modal__stat-value">{fmtPrice(modalItem.sellingPrice)}</span>
                                        </div>
                                        <div className="inv-modal__stat-item">
                                            <span className="inv-modal__stat-label">Inventory Value</span>
                                            <span className="inv-modal__stat-value val--green">
                                                ₹{modalItem.totalValue?.toFixed(2) || "0.00"}
                                            </span>
                                        </div>
                                        {modalItem.modelName && (
                                            <div className="inv-modal__stat-item">
                                                <span className="inv-modal__stat-label">Model</span>
                                                <span className="inv-modal__stat-value">{modalItem.modelName}</span>
                                            </div>
                                        )}
                                        {modalItem.variableModelName && (
                                            <div className="inv-modal__stat-item">
                                                <span className="inv-modal__stat-label">Variant Model</span>
                                                <span className="inv-modal__stat-value">{modalItem.variableModelName}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Stock History */}
                                    {modalItem.stockHistory?.length > 0 && (
                                        <div className="inv-modal__section">
                                            <h4 className="inv-modal__section-title">
                                                <FaBox style={{ marginRight: 6 }} /> Stock History (Last 10)
                                            </h4>
                                            <div className="inv-modal__table-wrap">
                                                <table className="history-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>Type</th>
                                                            <th>Qty</th>
                                                            <th>Before</th>
                                                            <th>After</th>
                                                            <th>Reason</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...modalItem.stockHistory].reverse().slice(0, 10).map((h, i) => (
                                                            <tr key={i}>
                                                                <td>{fmtDate(h.date)}</td>
                                                                <td>
                                                                    <span className={`history-type ${h.type}`}>{h.type}</span>
                                                                </td>
                                                                <td className={`history-quantity ${h.type}`}>
                                                                    {h.type === "added" || h.type === "initial" ? "+" : "-"}{h.quantity}
                                                                </td>
                                                                <td>{h.previousStock}</td>
                                                                <td>{h.newStock}</td>
                                                                <td className="history-reason">{h.reason || "—"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── BATCH PRODUCT ── */}
                            {modalItem.inventoryType === "batch" && batchModalStats && (
                                <>
                                    {/* Summary stats */}
                                    <div className="inv-modal__batch-stats">
                                        <div className="inv-modal__bstat">
                                            <span className="inv-modal__bstat-val">{batchModalStats.total}</span>
                                            <span className="inv-modal__bstat-label">Total Batches</span>
                                        </div>
                                        <div className="inv-modal__bstat">
                                            <span className="inv-modal__bstat-val val--green">{batchModalStats.active}</span>
                                            <span className="inv-modal__bstat-label">Active</span>
                                        </div>
                                        <div className="inv-modal__bstat">
                                            <span className="inv-modal__bstat-val val--red">{batchModalStats.expired}</span>
                                            <span className="inv-modal__bstat-label">Expired</span>
                                        </div>
                                        <div className="inv-modal__bstat">
                                            <span className="inv-modal__bstat-val val--orange">{batchModalStats.soldOut}</span>
                                            <span className="inv-modal__bstat-label">Sold Out</span>
                                        </div>
                                        <div className="inv-modal__bstat">
                                            <span className="inv-modal__bstat-val">{batchModalStats.totalStock}</span>
                                            <span className="inv-modal__bstat-label">Total Stock</span>
                                        </div>
                                        <div className="inv-modal__bstat">
                                            <span className="inv-modal__bstat-val" style={{ fontSize: 14 }}>
                                                {batchModalStats.priceRange}
                                            </span>
                                            <span className="inv-modal__bstat-label">Purchase Price Range</span>
                                        </div>
                                        <div className="inv-modal__bstat">
                                            <span className="inv-modal__bstat-val val--green" style={{ fontSize: 14 }}>
                                                ₹{modalItem.totalValue?.toFixed(2) || "0.00"}
                                            </span>
                                            <span className="inv-modal__bstat-label">Total Purchase Value</span>
                                        </div>
                                        <div className="inv-modal__bstat">
                                            <span className="inv-modal__bstat-val">{modalItem.threshold || 10}</span>
                                            <span className="inv-modal__bstat-label">Threshold</span>
                                        </div>
                                    </div>

                                    {/* Batch table */}
                                    {modalItem.batches?.length > 0 ? (
                                        <div className="inv-modal__section">
                                            <h4 className="inv-modal__section-title">
                                                <FaBoxOpen style={{ marginRight: 6 }} /> Batch Details
                                            </h4>
                                            <div className="inv-modal__table-wrap">
                                                <table className="batch-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Batch No.</th>
                                                            <th>Current Qty</th>
                                                            {/* <th>Original Qty</th>  */}
                                                            <th>Manufacture Date</th>
                                                            <th>Expiry Date</th>
                                                            <th>Purchase Price</th>
                                                            <th>Status</th>
                                                            <th>Added On</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {modalItem.batches.map((batch, i) => {
                                                            const today = new Date();
                                                            const expiry = new Date(batch.expiryDate);
                                                            const isExpired = expiry < today;
                                                            const isExpiring = !isExpired && expiry < new Date(Date.now() + 30 * 86400000);

                                                            return (
                                                                <tr
                                                                    key={i}
                                                                    className={`batch-main-row ${batch.status !== "active" ? "inactive-batch" : ""}`}
                                                                >
                                                                    <td className="batch-number-cell">
                                                                        <strong>{batch.batchNumber}</strong>
                                                                    </td>
                                                                    <td>
                                                                        <span className={`quantity-badge ${batch.currentQuantity === 0 ? "zero" : ""}`}>
                                                                            {batch.currentQuantity}
                                                                        </span>
                                                                    </td>
                                                                    {/* <td>{batch.quantity}</td>  */}
                                                                    <td>{fmtDate(batch.manufactureDate)}</td>
                                                                    <td className={`expiry-cell ${isExpired ? "expired" : isExpiring ? "expiring" : ""}`}>
                                                                        {fmtDate(batch.expiryDate)}
                                                                        {isExpiring && !isExpired && (
                                                                            <span className="expiry-warning"> ⚠️ Soon</span>
                                                                        )}
                                                                        {isExpired && (
                                                                            <span className="expiry-danger"> ⏰ Expired</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="batch-price">{fmtPrice(batch.price)}</td>
                                                                    <td>
                                                                        <span className={`batch-status ${batch.status}`}>
                                                                            {batch.status}
                                                                        </span>
                                                                    </td>
                                                                    <td>{fmtDate(batch.addedAt)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="no-batches">No batches available for this product</div>
                                    )}

                                    {/* Stock History for batch */}
                                    {modalItem.stockHistory?.length > 0 && (
                                        <div className="inv-modal__section">
                                            <h4 className="inv-modal__section-title">
                                                <FaBox style={{ marginRight: 6 }} /> Stock History (Last 10)
                                            </h4>
                                            <div className="inv-modal__table-wrap">
                                                <table className="history-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>Type</th>
                                                            <th>Qty</th>
                                                            <th>Batch</th>
                                                            <th>Before</th>
                                                            <th>After</th>
                                                            <th>Reason</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...modalItem.stockHistory].reverse().slice(0, 10).map((h, i) => (
                                                            <tr key={i}>
                                                                <td>{fmtDate(h.date)}</td>
                                                                <td>
                                                                    <span className={`history-type ${h.type}`}>{h.type}</span>
                                                                </td>
                                                                <td className={`history-quantity ${h.type}`}>
                                                                    {["added", "initial"].includes(h.type) ? "+" : "-"}{h.quantity}
                                                                </td>
                                                                <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                                                                    {h.batchNumber || "—"}
                                                                </td>
                                                                <td>{h.previousStock}</td>
                                                                <td>{h.newStock}</td>
                                                                <td className="history-reason">{h.reason || "—"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                        </div>{/* inv-modal__body */}

                        {/* Footer — read only note */}
                        <div className="inv-modal__footer">
                            <span className="inv-modal__readonly-note">
                                🔒 Read-only view — changes can only be made from the Admin Panel
                            </span>
                            <button className="inv-modal__close-btn" onClick={closeModal}>
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </Navbar>
    );
};

export default Inventory;