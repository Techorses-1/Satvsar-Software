import React, { useEffect, useState } from "react";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FiShoppingCart,
  FiPackage,
  FiDollarSign,
  FiAlertTriangle,
  FiCalendar,
  FiTrendingUp,
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
  ReferenceLine,
} from "recharts";
import "./Home.css";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab state: 'offline', 'online', 'both'
  const [activeTab, setActiveTab] = useState("offline");
  // Time period state: 'thismonth', 'lastmonth', 'last6months', 'thisyear', 'lastyear'
  const [activePeriod, setActivePeriod] = useState("thismonth");

  // Modal states
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [itemsToShow, setItemsToShow] = useState(6);

  const navigate = useNavigate();

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/dashboard/stats?period=${activePeriod}`
      );
      const result = await response.json();

      if (result.success) {
        setDashboardData(result);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activePeriod]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Modal body scroll lock
  useEffect(() => {
    if (showLowStockModal || showOutOfStockModal || showExpiryModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showLowStockModal, showOutOfStockModal, showExpiryModal]);

  const handleOrderItem = (item) => {
    localStorage.setItem('preSelectedItem', JSON.stringify({
      itemName: item.productName,
      description: item.description || "",
      hsnCode: item.hsnCode || "",
      unit: item.unit || "",
      itemId: item.inventoryId || "",
      rate: item.rate || 0,
      minimumQty: item.minimumQty || 0
    }));
    navigate('/purchase-order');
  };

  // Get chart data based on active tab
  const getChartData = () => {
    if (!dashboardData?.salesTrend?.data) return [];

    if (activeTab === "both") {
      return dashboardData.salesTrend.data;
    } else if (activeTab === "online") {
      return dashboardData.salesTrend.data.map(item => ({
        month: item.month,
        value: item.online,
        total: item.total
      }));
    } else if (activeTab === "offline") {
      return dashboardData.salesTrend.data.map(item => ({
        month: item.month,
        value: item.offline,
        total: item.total
      }));
    }
    return [];
  };

  // Get total sales based on active tab
  const getTotalSales = () => {
    if (!dashboardData?.sales) return 0;

    if (activeTab === "both") {
      return dashboardData.sales.combinedTotal;
    } else if (activeTab === "online") {
      return dashboardData.sales.onlineTotal;
    } else if (activeTab === "offline") {
      return dashboardData.sales.offlineTotal;
    }
    return 0;
  };

  // Get sales count based on active tab
  const getSalesCount = () => {
    if (!dashboardData?.sales) return 0;

    if (activeTab === "both") {
      return dashboardData.sales.totalOrders;
    } else if (activeTab === "online") {
      return dashboardData.sales.onlineCount;
    } else if (activeTab === "offline") {
      return dashboardData.sales.offlineCount;
    }
    return 0;
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  const inventoryData = dashboardData?.inventory || {
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    inStockCount: 0,
    totalValue: 0
  };

  const purchaseData = dashboardData?.purchases || {
    totalPurchases: 0,
    purchaseCount: 0,
    trend: []
  };

  const alerts = dashboardData?.alerts || {
    expiringItems: [],
    lowStockItems: [],
    outOfStockItems: []
  };

  const chartData = getChartData();
  const totalSales = getTotalSales();
  const salesCount = getSalesCount();

  // Get period display name
  const getPeriodDisplayName = () => {
    switch (activePeriod) {
      case "thismonth": return "This Month";
      case "lastmonth": return "Last Month";
      case "last6months": return "Last 6 Months";
      case "thisyear": return "This Year";
      case "lastyear": return "Last Year";
      default: return "This Month";
    }
  };

  return (
    <div>
      <Navbar>
        <div className="dashboard-container">
          {/* Time Period Filters */}
          <div className="period-filters">
            <button
              className={`period-btn ${activePeriod === "thismonth" ? "active" : ""}`}
              onClick={() => setActivePeriod("thismonth")}
            >
              This Month
            </button>
            <button
              className={`period-btn ${activePeriod === "lastmonth" ? "active" : ""}`}
              onClick={() => setActivePeriod("lastmonth")}
            >
              Last Month
            </button>
            <button
              className={`period-btn ${activePeriod === "last6months" ? "active" : ""}`}
              onClick={() => setActivePeriod("last6months")}
            >
              Last 6 Months
            </button>
            <button
              className={`period-btn ${activePeriod === "thisyear" ? "active" : ""}`}
              onClick={() => setActivePeriod("thisyear")}
            >
              This Year
            </button>
            <button
              className={`period-btn ${activePeriod === "lastyear" ? "active" : ""}`}
              onClick={() => setActivePeriod("lastyear")}
            >
              Last Year
            </button>
          </div>

          {/* Tabs */}
          <div className="dashboard-tabs">
            <button
              className={`tab-btn ${activeTab === "offline" ? "active" : ""}`}
              onClick={() => setActiveTab("offline")}
            >
              Offline
            </button>
            <button
              className={`tab-btn ${activeTab === "online" ? "active" : ""}`}
              onClick={() => setActiveTab("online")}
            >
              Online
            </button>
            <button
              className={`tab-btn ${activeTab === "both" ? "active" : ""}`}
              onClick={() => setActiveTab("both")}
            >
              Both
            </button>
          </div>

          {/* Inventory Alerts */}
          <div className="inventory-alerts">
            <h3>Inventory Alerts</h3>
            <div className="alert-grid">
              <div
                className="alert-section expiry-alert clickable-alert"
                onClick={() => setShowExpiryModal(true)}
              >
                <h4>
                  <FiCalendar className="icon-expiry" /> Expiring Soon
                </h4>
                <div className="alert-count">
                  {alerts.expiringCount || 0} items expiring in 3 Months
                </div>
              </div>

              <div
                className="alert-section low-stock-alert clickable-alert"
                onClick={() => setShowLowStockModal(true)}
              >
                <h4>
                  <FiAlertTriangle className="icon-warning" /> Low Stock
                </h4>
                <div className="alert-count">
                  {alerts.lowStockCount || 0} items need attention
                </div>
              </div>

              <div
                className="alert-section out-of-stock-alert clickable-alert"
                onClick={() => setShowOutOfStockModal(true)}
              >
                <h4>
                  <FiAlertTriangle className="icon-danger" /> Out of Stock
                </h4>
                <div className="alert-count">
                  {alerts.outOfStockCount || 0} items unavailable
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card sales-metric">
              <FiDollarSign className="metric-icon" />
              <div>
                <h3>Total Sales ({getPeriodDisplayName()})</h3>
                <p>₹{totalSales.toLocaleString()}</p>
                <small>{salesCount} invoices</small>
              </div>
            </div>

            {/* Sales Breakdown Card - Only in BOTH tab */}
            {activeTab === "both" && dashboardData?.sales && (
              <div className="metric-card breakdown-metric">
                <FiTrendingUp className="metric-icon" />
                <div>
                  <h3>Sales Breakdown</h3>
                  <div className="breakdown-info">
                    <div className="breakdown-item online">
                      <span>Online:</span>
                      <strong>₹{dashboardData.sales.onlineTotal.toLocaleString()}</strong>
                      <small>({dashboardData.sales.onlineCount} orders)</small>
                    </div>
                    <div className="breakdown-item offline">
                      <span>Offline:</span>
                      <strong>₹{dashboardData.sales.offlineTotal.toLocaleString()}</strong>
                      <small>({dashboardData.sales.offlineCount} orders)</small>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="metric-card inventory-metric">
              <FiPackage className="metric-icon" />
              <div>
                <h3>Inventory Status</h3>
                <p>{inventoryData.totalItems} items</p>
                <small>
                  {inventoryData.lowStockCount} low stock, {inventoryData.outOfStockCount} out of stock
                </small>
              </div>
            </div>

            <div className="metric-card purchases-metric">
              <FiShoppingCart className="metric-icon" />
              <div>
                <h3>Total Purchases ({getPeriodDisplayName()})</h3>
                <p>₹{purchaseData.totalPurchases.toLocaleString()}</p>
                <small>{purchaseData.purchaseCount} batches added</small>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-section">
            <div className="chart-container">
              <div className="chart-header">
                <h3>
                  Sales Trend ({activeTab === "both" ? "Online vs Offline" : activeTab === "online" ? "Online Sales" : "Offline Sales"}) - {getPeriodDisplayName()}
                </h3>
                <div className="chart-legend">
                  {activeTab === "both" ? (
                    <>
                      <div className="legend-item">
                        <div className="legend-color online"></div>
                        <span>Online Sales (₹)</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-color offline"></div>
                        <span>Offline Sales (₹)</span>
                      </div>
                    </>
                  ) : (
                    <div className="legend-item">
                      <div className="legend-color sales"></div>
                      <span>Sales (₹)</span>
                    </div>
                  )}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return `${month}/${year.slice(2)}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (value >= 100000) return `₹${(value / 100000).toFixed(0)}L`;
                      if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
                      return `₹${value}`;
                    }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "online") return [`₹${Number(value).toLocaleString()}`, "Online Sales"];
                      if (name === "offline") return [`₹${Number(value).toLocaleString()}`, "Offline Sales"];
                      return [`₹${Number(value).toLocaleString()}`, "Sales"];
                    }}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-');
                      return `Month: ${month}/${year}`;
                    }}
                  />
                  {activeTab === "both" ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="online"
                        stroke="#8884d8"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="online"
                      />
                      <Line
                        type="monotone"
                        dataKey="offline"
                        stroke="#82ca9d"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="offline"
                      />
                    </>
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8884d8"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="sales"
                    />
                  )}
                  <ReferenceLine y={0} stroke="#ccc" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-container">
              <div className="chart-header">
                <h3>Purchase Trend - {getPeriodDisplayName()}</h3>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-color purchases"></div>
                    <span>Purchases (₹)</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={purchaseData.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return `${month}/${year.slice(2)}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (value >= 100000) return `₹${(value / 100000).toFixed(0)}L`;
                      if (value >= 1000) return `₹${(value / 1000).toFixed(0)}k`;
                      return `₹${value}`;
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Purchases"]}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-');
                      return `Month: ${month}/${year}`;
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#82ca9d"
                    radius={[4, 4, 0, 0]}
                    name="Purchases"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Navbar>

      {/* Modals - Same as before */}
      {showExpiryModal && (
        <div className="modal-overlay" onClick={() => {
          setShowExpiryModal(false);
          setItemsToShow(6);
          document.body.classList.remove('modal-open');
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <FiCalendar className="icon-expiry" /> Products Expiring Soon (Within 3 Months)
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowExpiryModal(false);
                  setItemsToShow(6);
                  document.body.classList.remove('modal-open');
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="inventory-list">
                {(alerts.expiringItems || []).slice(0, itemsToShow).map((item, index) => (
                  <div key={`${item.inventoryId}-${item.batchNumber}-${index}`} className="inventory-item">
                    <div className="item-info">
                      <span className="item-name">{item.productName}</span>
                      <span className="item-batch">Batch: {item.batchNumber}</span>
                    </div>
                    <div className="item-details">
                      <span className="item-stock">Qty: {item.quantity}</span>
                      <span className="item-expiry">
                        Expires: {new Date(item.expiryDate).toLocaleDateString()}
                        ({item.daysUntilExpiry} days)
                      </span>
                    </div>
                  </div>
                ))}
                {(alerts.expiringItems || []).length === 0 && (
                  <div className="no-items">No products expiring within 3 months</div>
                )}
              </div>
              {itemsToShow < (alerts.expiringItems || []).length && (
                <button
                  className="load-more-btn"
                  onClick={() => setItemsToShow(prev => prev + 6)}
                >
                  Load More
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Modal */}
      {showLowStockModal && (
        <div className="modal-overlay" onClick={() => {
          setShowLowStockModal(false);
          setItemsToShow(6);
          document.body.classList.remove('modal-open');
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <FiAlertTriangle className="icon-warning" /> Low Stock Items
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowLowStockModal(false);
                  setItemsToShow(6);
                  document.body.classList.remove('modal-open');
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="inventory-list">
                {(alerts.lowStockItems || []).slice(0, itemsToShow).map(item => (
                  <div key={item.inventoryId} className="inventory-item">
                    <span className="item-name">{item.productName}</span>
                    <span className="item-stock">
                      {item.totalQuantity} left (min: {item.minimumQty || 0})
                    </span>
                    {/* <FiShoppingCart
                      className="order-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOrderItem(item);
                      }}
                      title="Create Purchase Order for this item"
                    /> */}
                  </div>
                ))}
              </div>
              {itemsToShow < (alerts.lowStockItems || []).length && (
                <button
                  className="load-more-btn"
                  onClick={() => setItemsToShow(prev => prev + 6)}
                >
                  Load More
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Out of Stock Modal */}
      {showOutOfStockModal && (
        <div className="modal-overlay" onClick={() => {
          setShowOutOfStockModal(false);
          setItemsToShow(6);
          document.body.classList.remove('modal-open');
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <FiAlertTriangle className="icon-danger" /> Out of Stock Items
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowOutOfStockModal(false);
                  setItemsToShow(6);
                  document.body.classList.remove('modal-open');
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="inventory-list">
                {(alerts.outOfStockItems || []).slice(0, itemsToShow).map(item => (
                  <div key={item.inventoryId} className="inventory-item">
                    <span className="item-name">{item.productName}</span>
                    <span className="item-status">Out of stock</span>
                  </div>
                ))}
              </div>
              {itemsToShow < (alerts.outOfStockItems || []).length && (
                <button
                  className="load-more-btn"
                  onClick={() => setItemsToShow(prev => prev + 6)}
                >
                  Load More
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;