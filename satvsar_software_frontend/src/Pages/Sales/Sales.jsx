import React, { useState, useEffect, useMemo, useRef } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import { FaPlus, FaFileExport, FaFileExcel, FaSearch, FaTrash, FaSave, FaFilePdf, FaSpinner, FaEdit, FaChevronDown } from "react-icons/fa";
import { FaExchangeAlt } from 'react-icons/fa';
import Navbar from "../../Components/Sidebar/Navbar";
import "react-toastify/dist/ReactToastify.css";
import "./Sales.scss";
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import SalesPrint from "./SalesPrint";
import axios from "axios";

const Sales = () => {
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [customerMobileSearch, setCustomerMobileSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    customerNumber: "",
    name: "",
    email: "",
    mobile: "",
    date: new Date().toISOString().split('T')[0],
    gstNumber: "",
    address: "",
    remarks: ""
  });
  const [isExporting, setIsExporting] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBatchDropdown, setShowBatchDropdown] = useState(null);
  const customerSearchRef = useRef(null);
  const batchDropdownRef = useRef(null);

  const [invoiceForPrint, setInvoiceForPrint] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState([]);

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isBulkImportLoading, setIsBulkImportLoading] = useState(false);

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState("");

  const [activePromos, setActivePromos] = useState([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState(false);

  const [useLoyaltyCoins, setUseLoyaltyCoins] = useState(false);
  const [availableLoyaltyCoins, setAvailableLoyaltyCoins] = useState(0);
  const [usableLoyaltyCoins, setUsableLoyaltyCoins] = useState(0);

  const [userPermissions, setUserPermissions] = useState([]);

  const [shippingDetails, setShippingDetails] = useState({
    name: "",
    email: "",
    mobile: "",
    gstNumber: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    country: "India"
  });
  const [businessType, setBusinessType] = useState("b2c");
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [customerAddresses, setCustomerAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // NEW: Tab state
  const [activeTab, setActiveTab] = useState('offline'); // offline, online, both
  const [productDiscounts, setProductDiscounts] = useState({});

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserPermissions(user.permissions || []);
      } catch (error) {
        console.error("Error parsing user data:", error);
        setUserPermissions([]);
      }
    }
  }, []);

  const hasAdminPermission = userPermissions.includes('admin');

  useEffect(() => {
    fetchActivePromos();
    fetchProductsWithOffers();


  }, []);

  const fetchActivePromos = async () => {
    try {
      setIsLoadingPromos(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/promoCodes/get-active-promos`);
      setActivePromos(response.data || []);
    } catch (error) {
      console.error("Error fetching active promo codes:", error);
      toast.error("Failed to load promo codes");
    } finally {
      setIsLoadingPromos(false);
    }
  };

  const validatePromoCode = async (code) => {
    if (!code.trim()) {
      setPromoError("Please select a promo code");
      return false;
    }

    setIsValidatingPromo(true);
    setPromoError("");

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/promoCodes/validate-promo/${code.trim().toUpperCase()}`
      );

      if (response.data.isValid) {
        setAppliedPromo(response.data.promoCode);
        setPromoError("");
        toast.success(`Promo code applied! ${response.data.promoCode.discount}% discount`);
        return true;
      } else {
        setPromoError(response.data.message || "Invalid promo code");
        setAppliedPromo(null);
        return false;
      }
    } catch (error) {
      console.error("Error validating promo code:", error);
      setPromoError("Error validating promo code");
      setAppliedPromo(null);
      return false;
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
    toast.info("Promo code removed");
  };

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchInventory();
    fetchInvoices();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(event.target)) {
        setShowBatchDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!invoiceForPrint) return;

    const generatePDFAndHandleWhatsApp = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await generatePDF(invoiceForPrint.invoice, invoiceForPrint.openWhatsapp);
      } catch (error) {
        console.error("Error in PDF/WhatsApp process:", error);
        toast.error("Failed to generate PDF");
      } finally {
        setInvoiceForPrint(null);
      }
    };

    generatePDFAndHandleWhatsApp();
  }, [invoiceForPrint]);

  // Updated fetchInvoices with proper data mapping
  const fetchInvoices = async () => {
    console.log("🔄 Starting fetchInvoices...");

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/orders/all/get-invoices`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          timeout: 10000,
          validateStatus: function (status) {
            return status >= 200 && status < 500;
          }
        }
      );

      if (response.status === 401) {
        console.error("❌ Received 401 Unauthorized!");
        toast.error("Authentication failed. Please check your login.");
        return;
      }

      if (!response.data.success) {
        console.error("❌ Backend returned error:", response.data);
        toast.error(response.data.message || "Failed to load invoices");
        return;
      }

      const invoicesData = (response.data && response.data.data) ? response.data.data : [];

      // Map backend fields to frontend fields
      const mappedInvoices = invoicesData.map((invoice) => ({
        ...invoice,
        invoiceNumber: invoice.orderNumber, // Use orderNumber as invoiceNumber
        date: invoice.date || (invoice.createdAt ? invoice.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
        businessType: invoice.businessType || 'b2c',
        customer: invoice.customer || { name: 'Unknown', mobile: '' },
        orderType: invoice.orderType || 'offline'
      }));

      // Sort invoices by order number (highest first) for Both tab
      const sortedInvoices = mappedInvoices.sort((a, b) => {
        const numA = parseInt((a.orderNumber || "").replace(/\D/g, "")) || 0;
        const numB = parseInt((b.orderNumber || "").replace(/\D/g, "")) || 0;
        return numB - numA;
      });

      console.log(`✅ Loaded ${sortedInvoices.length} invoices`);
      setInvoices(sortedInvoices);

      // Extract unique categories from all invoices
      const uniqueCategories = new Set();
      sortedInvoices.forEach(invoice => {
        if (invoice.items && Array.isArray(invoice.items)) {
          invoice.items.forEach(item => {
            if (item.category) {
              uniqueCategories.add(item.category);
            }
          });
        }
      });
      setCategories(Array.from(uniqueCategories).sort());

    } catch (error) {
      console.error("❌ ERROR in fetchInvoices:", error);
      if (error.response) {
        if (error.response.status === 401) {
          toast.error("Access denied. Please login again.");
        } else if (error.response.status === 404) {
          toast.error("API endpoint not found. Check your URL.");
        } else if (error.response.status === 500) {
          toast.error("Server error. Please try again later.");
        } else {
          toast.error(`Error ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`);
        }
      } else if (error.request) {
        toast.error("No response from server. Check your connection.");
      } else {
        toast.error("Failed to make request: " + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      setIsLoadingCustomers(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/user/get-customers`);
      const customersData = response.data.map(customer => ({
        customerId: customer.customerId || customer.userId,
        id: customer.customerId || customer.userId,
        customerNumber: customer.customerId || customer.userId,
        name: customer.customerName || customer.name || "",
        email: customer.email || "",
        mobile: customer.contactNumber || customer.mobile || "",
        gstNumber: customer.gstNumber || "",
        address: customer.address || "",
        loyaltyCoins: customer.loyaltyCoins || 0
      }));
      setCustomers(customersData);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/products/all`);
      setProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const fetchInventory = async () => {
    try {
      setIsLoadingInventory(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/inventory/all`);

      if (Array.isArray(response.data)) {
        setInventory(response.data);
      } else if (response.data && Array.isArray(response.data.data)) {
        setInventory(response.data.data);
      } else {
        console.error("Unexpected inventory response structure:", response.data);
        setInventory([]);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      toast.error("Failed to load inventory data");
    } finally {
      setIsLoadingInventory(false);
    }
  };

  // Fetch products with their active offers to get discounts
  const fetchProductsWithOffers = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/productoffers/products-with-color-offers`);

      if (response.data && Array.isArray(response.data)) {
        // Create discount map: key = "productId_colorId", value = discount percentage
        const discountsMap = {};

        response.data.forEach(product => {
          // For simple products only
          if (product.type === "simple" && product.colors) {
            product.colors.forEach(color => {
              if (color.hasOffer && color.offer && color.offer.offerPercentage) {
                const key = `${product.productId}_${color.colorId}`;
                discountsMap[key] = color.offer.offerPercentage;
                console.log(`✅ Loaded discount: ${product.productName} - ${color.colorName} = ${color.offer.offerPercentage}%`);
              }
            });
          }
        });

        setProductDiscounts(discountsMap);
        console.log("📦 Product discounts loaded:", Object.keys(discountsMap).length, "colors have offers");
      }
    } catch (error) {
      console.error("Error fetching products with offers:", error);
      // Don't show toast error - it's not critical for invoice creation
    }
  };

  const getAvailableBatches = (productId) => {
    const inventoryItem = inventory.find(item => item.productId === productId);
    if (!inventoryItem || !inventoryItem.batches) return [];

    const currentDate = new Date();

    return inventoryItem.batches
      .filter(batch => {
        if (!batch || !batch.expiryDate) return false;
        const isExpired = new Date(batch.expiryDate) < currentDate;
        return batch.currentQuantity > 0 && !isExpired;
      })
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
      .map(batch => {
        // Get colorId from inventory item or batch
        let colorId = batch.colorId || inventoryItem.colorId || "";

        // If still no colorId, try to get from product colors
        if (!colorId) {
          const product = products.find(p => p.productId === inventoryItem.productId);
          if (product && product.type === "simple" && product.colors) {
            // Try to match by color name
            const matchingColor = product.colors.find(c =>
              c.colorName === batch.colorName || c.colorName === inventoryItem.colorName
            );
            if (matchingColor) {
              colorId = matchingColor.colorId;
            }
          }
        }

        return {
          ...batch,
          productId: inventoryItem.productId,
          productName: inventoryItem.productName || inventoryItem.name || "Unknown",
          category: inventoryItem.category || "General",
          colorId: colorId, // ✅ Ensure colorId is included for discount lookup
          colorName: batch.colorName || inventoryItem.colorName || ""
        };
      });
  };

  const getAvailableQuantity = (productId, batchNumber) => {
    const inventoryItem = inventory.find(item => item.productId === productId);
    if (!inventoryItem || !inventoryItem.batches) return 0;

    const batch = inventoryItem.batches.find(b =>
      b.batchNumber === batchNumber
    );
    return batch ? (batch.currentQuantity || 0) : 0;
  };


  // Helper function to get discount for a specific product color
  const getDiscountForColor = (productId, colorId) => {
    if (!productId || !colorId) return 0;

    const key = `${productId}_${colorId}`;
    const discount = productDiscounts[key];

    if (discount && discount > 0) {
      console.log(`🎯 Found discount for ${productId} color ${colorId}: ${discount}%`);
      return discount;
    }

    return 0;
  };

  const handleProductSelect = (product) => {
    const availableBatches = getAvailableBatches(product.productId);
    const inventoryItem = inventory.find(item => item.productId === product.productId);

    if (!inventoryItem) {
      toast.error("❌ Product not found in inventory. Cannot add this product.");
      setItemSearchTerm("");
      return;
    }

    if (!inventoryItem.batches || inventoryItem.batches.length === 0) {
      toast.error("❌ This product has no batch numbers. Cannot add to invoice.");
      setItemSearchTerm("");
      return;
    }

    const batchesWithoutExpiry = inventoryItem.batches.filter(batch =>
      !batch.expiryDate || batch.expiryDate === ""
    );

    if (batchesWithoutExpiry.length === inventoryItem.batches.length) {
      toast.error("❌ All batches for this product are missing expiry dates. Cannot add to invoice.");
      setItemSearchTerm("");
      return;
    }

    const currentDate = new Date();
    const expiredBatches = inventoryItem.batches.filter(batch => {
      if (!batch.expiryDate) return true;
      return new Date(batch.expiryDate) < currentDate;
    });

    if (expiredBatches.length === inventoryItem.batches.length) {
      toast.error("❌ All batches for this product are expired. Cannot add to invoice.");
      setItemSearchTerm("");
      return;
    }

    const batchesWithZeroQuantity = inventoryItem.batches.filter(batch =>
      batch.quantity <= 0
    );

    if (batchesWithZeroQuantity.length === inventoryItem.batches.length) {
      toast.error("❌ All batches for this product have zero quantity. Cannot add to invoice.");
      setItemSearchTerm("");
      return;
    }

    if (availableBatches.length === 0) {
      toast.error("❌ No available stock with valid batches for this product");
      setItemSearchTerm("");
      return;
    }

    if (availableBatches.length === 1) {
      handleBatchSelect(availableBatches[0]);
      setItemSearchTerm("");
    } else {
      setShowBatchDropdown(product.productId);
      setItemSearchTerm("");
    }
  };

  const handleBatchSelect = (batch) => {
    const existingItemIndex = selectedItems.findIndex(i =>
      i.productId === batch.productId && i.batchNumber === batch.batchNumber
    );

    if (existingItemIndex >= 0) {
      const updatedItems = [...selectedItems];
      const availableQty = getAvailableQuantity(batch.productId, batch.batchNumber);

      if (updatedItems[existingItemIndex].quantity >= availableQty) {
        toast.error(`Only ${availableQty} items available in this batch`);
        return;
      }

      updatedItems[existingItemIndex].quantity += 1;
      setSelectedItems(updatedItems);
    } else {
      const product = products.find(p => p.productId === batch.productId);
      const inventoryItem = inventory.find(item => item.productId === batch.productId);
      const batchData = inventoryItem?.batches?.find(b => b.batchNumber === batch.batchNumber);

      let itemPrice = 0;
      let itemCategory = "";
      let itemHSN = "";
      let itemTaxSlab = 18;
      let colorId = batch.colorId || "";

      if (product) {
        itemHSN = product.hsnCode || "";
        itemTaxSlab = product.taxSlab || 18;
        itemCategory = product.categoryName || product.category || "General";

        // Get price from product
        if (product.type === "simple") {
          if (product.colors && product.colors.length > 0) {
            // Try to find matching color by colorId or colorName
            let matchedColor = null;

            if (colorId) {
              matchedColor = product.colors.find(c => c.colorId === colorId);
            }

            if (!matchedColor && batch.colorName) {
              matchedColor = product.colors.find(c => c.colorName === batch.colorName);
            }

            if (matchedColor) {
              itemPrice = matchedColor.currentPrice || product.currentPrice || 0;
              colorId = matchedColor.colorId; // Ensure we have the correct colorId
            } else {
              itemPrice = product.colors[0].currentPrice || product.currentPrice || 0;
              colorId = product.colors[0].colorId;
            }
          } else {
            itemPrice = product.currentPrice || 0;
          }
        } else {
          itemPrice = product.currentPrice || 0;
        }
      }

      // Get discount for this color
      const discountPercent = getDiscountForColor(batch.productId, colorId);

      if (discountPercent > 0) {
        console.log(`🎉 Auto-applied ${discountPercent}% discount to ${batch.productName}`);
        toast.success(`${discountPercent}% discount applied automatically!`);
      }

      setSelectedItems([...selectedItems, {
        productId: batch.productId,
        id: batch.productId,
        name: batch.productName || product?.productName || "Unknown",
        productName: batch.productName || product?.productName || "Unknown",
        category: itemCategory,
        hsn: itemHSN,
        barcode: product?.barcode || "",
        originalPrice: itemPrice,
        price: itemPrice,
        quantity: 1,
        discount: discountPercent, // ✅ Auto-applied discount from offers
        taxSlab: itemTaxSlab,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        inventoryId: inventoryItem?._id || inventoryItem?.id || "unknown",
        purchasedFromStock: batchData?.currentQuantity || batchData?.quantity || 0,
        status: 'delivered',
        colorId: colorId // ✅ Store colorId for reference
      }]);
    }

    setShowBatchDropdown(null);
    setItemSearchTerm("");
  };

  const handleItemUpdate = (index, field, value) => {
    const updatedItems = [...selectedItems];

    if (field === 'quantity') {
      const item = updatedItems[index];
      const availableQty = getAvailableQuantity(item.productId, item.batchNumber);

      if (value > availableQty) {
        toast.error(`Only ${availableQty} items available in this batch`);
        return;
      }

      updatedItems[index][field] = value === "" ? "" : parseInt(value) || 0;
    } else if (field === 'discount') {
      updatedItems[index][field] = value === "" ? "" : parseInt(value) || 0;
    } else if (field === 'price') {
      updatedItems[index][field] = value;
    } else {
      updatedItems[index][field] = value;
    }

    setSelectedItems(updatedItems);
  };

  const handleCustomerSelect = async (customer) => {
    setNewCustomer({
      customerNumber: customer.customerNumber,
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile,
      date: newCustomer.date,
      gstNumber: customer.gstNumber || "",
      address: customer.address || "",
      remarks: newCustomer.remarks
    });

    setShippingDetails({
      name: "",
      email: "",
      mobile: "",
      gstNumber: "",
      addressLine1: "",
      addressLine2: "",
      landmark: "",
      city: "",
      state: "",
      pincode: "",
      country: "India"
    });

    setCustomerMobileSearch(customer.mobile);
    setShowCustomerDropdown(false);

    const totalCoins = customer.loyaltyCoins || 0;
    const usableCoins = Math.max(0, totalCoins - 50);

    setAvailableLoyaltyCoins(totalCoins);
    setUsableLoyaltyCoins(usableCoins);
    setUseLoyaltyCoins(false);

    if (customer.customerId || customer.userId) {
      await fetchCustomerAddresses(customer.customerId || customer.userId);
    }
  };

  const fetchCustomerAddresses = async (customerId) => {
    try {
      setIsLoadingAddresses(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/profile/customer-addresses/${customerId}`
      );

      if (response.data.success && response.data.addresses.length > 0) {
        setCustomerAddresses(response.data.addresses);

        const firstAddress = response.data.addresses[0];
        setShippingDetails({
          name: firstAddress.fullName || "",
          email: firstAddress.email || "",
          mobile: firstAddress.mobile || "",
          gstNumber: firstAddress.gstNumber || "",
          addressLine1: firstAddress.addressLine1 || "",
          addressLine2: firstAddress.addressLine2 || "",
          landmark: firstAddress.landmark || "",
          city: firstAddress.city || "",
          state: firstAddress.state || "",
          pincode: firstAddress.pincode || "",
          country: firstAddress.country || "India"
        });
      } else {
        setCustomerAddresses([]);
      }
    } catch (error) {
      console.error("Error fetching customer addresses:", error);
      setCustomerAddresses([]);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const createCustomer = async (customerData, initialCoins = 0) => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/user/create-customer`, {
        name: customerData.name,
        email: customerData.email || `${customerData.mobile}@billing.customer`,
        mobile: customerData.mobile,
        gstNumber: customerData.gstNumber || "",
        address: customerData.address || "",
        userType: "billing",
        isPasswordSet: false
      });

      return {
        id: response.data.customer?.userId || response.data.customerId,
        customerId: response.data.customer?.userId || response.data.customerId,
        customerNumber: response.data.customer?.userId || response.data.customerId,
        name: response.data.customer?.customerName || response.data.customer?.name,
        email: response.data.customer?.email || "",
        mobile: response.data.customer?.contactNumber || response.data.customer?.mobile,
        loyaltyCoins: initialCoins,
        gstNumber: response.data.customer?.gstNumber || "",
        address: response.data.customer?.address || "",
      };
    } catch (error) {
      console.error("Error creating customer:", error);
      throw error;
    }
  };

  const calculateInvoiceTotals = (items, existingInvoice = null) => {
    let subtotal = 0;
    let totalDiscountAmount = 0;
    let totalBaseValue = 0;
    let totalTaxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    const taxPercentages = new Set();

    let amountAfterItemDiscounts = 0;

    const itemsWithCalculations = items.map(item => {
      const quantity = item.quantity || 1;
      const taxRate = item.taxSlab || 18;
      const discountPercentage = item.discount || 0;

      taxPercentages.add(taxRate);

      const itemTotalInclTax = item.price * quantity;
      const itemDiscountAmount = itemTotalInclTax * (discountPercentage / 100);
      const itemTotalAfterDiscount = itemTotalInclTax - itemDiscountAmount;

      subtotal += itemTotalInclTax;
      totalDiscountAmount += itemDiscountAmount;
      amountAfterItemDiscounts += itemTotalAfterDiscount;

      return {
        ...item,
        discountAmount: itemDiscountAmount,
        totalAmount: itemTotalAfterDiscount
      };
    });

    let promoDiscountAmount = 0;

    if (existingInvoice && existingInvoice.appliedPromoCode) {
      promoDiscountAmount = amountAfterItemDiscounts * (existingInvoice.appliedPromoCode.discount / 100);
    } else if (appliedPromo && !existingInvoice) {
      promoDiscountAmount = amountAfterItemDiscounts * (appliedPromo.discount / 100);
    }

    const amountAfterPromo = amountAfterItemDiscounts - promoDiscountAmount;

    let loyaltyDiscountAmount = 0;
    let actualLoyaltyCoinsUsed = 0;

    if (existingInvoice && existingInvoice.loyaltyCoinsUsed && existingInvoice.loyaltyCoinsUsed > 0) {
      loyaltyDiscountAmount = Math.min(existingInvoice.loyaltyCoinsUsed, amountAfterPromo);
      actualLoyaltyCoinsUsed = Math.floor(loyaltyDiscountAmount);
    } else if (useLoyaltyCoins && usableLoyaltyCoins > 0 && !existingInvoice) {
      const maxLoyaltyDiscount = Math.min(usableLoyaltyCoins, amountAfterPromo);
      loyaltyDiscountAmount = maxLoyaltyDiscount;
      actualLoyaltyCoinsUsed = Math.floor(loyaltyDiscountAmount);
    }

    const finalAmountAfterAllDiscounts = amountAfterPromo - loyaltyDiscountAmount;
    const safeAmountAfterItemDiscounts = amountAfterItemDiscounts > 0 ? amountAfterItemDiscounts : 1;

    const itemsWithTaxCalculations = itemsWithCalculations.map(item => {
      const taxRate = item.taxSlab || 18;

      const itemFinalAmount = (item.totalAmount / safeAmountAfterItemDiscounts) * finalAmountAfterAllDiscounts;
      const itemBaseValue = itemFinalAmount / (1 + taxRate / 100);
      const itemTaxAmount = itemFinalAmount - itemBaseValue;
      const itemCgstAmount = taxPercentages.size === 1 ? itemTaxAmount / 2 : 0;
      const itemSgstAmount = taxPercentages.size === 1 ? itemTaxAmount / 2 : 0;

      totalBaseValue += itemBaseValue;
      totalTaxAmount += itemTaxAmount;
      cgstAmount += itemCgstAmount;
      sgstAmount += itemSgstAmount;

      return {
        ...item,
        baseValue: itemBaseValue,
        taxAmount: itemTaxAmount,
        cgstAmount: itemCgstAmount,
        sgstAmount: itemSgstAmount,
        finalAmount: itemFinalAmount
      };
    });

    const hasMixedTaxRates = taxPercentages.size > 1;
    if (hasMixedTaxRates) {
      cgstAmount = 0;
      sgstAmount = 0;
    }

    const grandTotal = finalAmountAfterAllDiscounts;

    return {
      items: itemsWithTaxCalculations,
      subtotal: subtotal,
      baseValue: totalBaseValue,
      discount: totalDiscountAmount,
      promoDiscount: promoDiscountAmount,
      loyaltyDiscount: loyaltyDiscountAmount,
      loyaltyCoinsUsed: actualLoyaltyCoinsUsed,
      tax: totalTaxAmount,
      cgst: cgstAmount,
      sgst: sgstAmount,
      hasMixedTaxRates: hasMixedTaxRates,
      taxPercentages: Array.from(taxPercentages),
      amountAfterAllDiscounts: amountAfterItemDiscounts,
      finalAmountAfterAllDiscounts: finalAmountAfterAllDiscounts,
      grandTotal: grandTotal
    };
  };

  const calculateLoyaltyCoins = (invoiceTotals) => {
    const spendAmount = invoiceTotals.baseValue;
    const coins = Math.floor(spendAmount / 100);
    return coins;
  };

  const updateCustomerLoyaltyCoins = async (customerId, coinsEarned, coinsUsed) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/user/update-loyalty-coins/${customerId}`,
        {
          coinsEarned: coinsEarned || 0,
          coinsUsed: coinsUsed || 0
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error updating customer loyalty coins:", error);
      throw error;
    }
  };

  const handleSubmit = async (values) => {
    if (isSubmitting) {
      console.log('Submission already in progress, please wait...');
      return;
    }

    const hasInvalidQuantity = selectedItems.some(item =>
      !item.quantity || item.quantity === "" || item.quantity < 1
    );

    if (selectedItems.length === 0 || hasInvalidQuantity) {
      toast.error("Please add at least one item and ensure all quantities are valid (minimum 1)");
      return;
    }

    if (!newCustomer.mobile || !newCustomer.name) {
      toast.error("Customer mobile and name are required");
      return;
    }

    const mobileRegex = /^\d{10}$/;
    if (!mobileRegex.test(newCustomer.mobile)) {
      toast.error("Please enter a valid 10-digit mobile number (numbers only)");
      return;
    }

    if (businessType === "b2b") {
      if (!newCustomer.gstNumber || newCustomer.gstNumber.trim() === "") {
        toast.error("GST Number is mandatory for B2B invoices in billing details");
        return;
      }

      if (!sameAsBilling) {
        if (!shippingDetails.gstNumber || shippingDetails.gstNumber.trim() === "") {
          toast.error("GST Number is mandatory for B2B invoices in shipping details");
          return;
        }

        if (!shippingDetails.addressLine1 || shippingDetails.addressLine1.trim() === "") {
          toast.error("Shipping Address Line 1 is mandatory for B2B invoices");
          return;
        }
        if (!shippingDetails.city || shippingDetails.city.trim() === "") {
          toast.error("Shipping City is mandatory for B2B invoices");
          return;
        }
        if (!shippingDetails.state || shippingDetails.state.trim() === "") {
          toast.error("Shipping State is mandatory for B2B invoices");
          return;
        }
        if (!shippingDetails.pincode || shippingDetails.pincode.trim() === "") {
          toast.error("Shipping Pincode is mandatory for B2B invoices");
          return;
        }
      }
    }

    for (const item of selectedItems) {
      const availableQty = getAvailableQuantity(item.productId, item.batchNumber);
      if (item.quantity > availableQty) {
        toast.error(`Only ${availableQty} items available for ${item.name} (Batch: ${item.batchNumber})`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const existingCustomer = customers.find(c => c.mobile === newCustomer.mobile);
      let customerToUse = { ...newCustomer };

      const manualGST = newCustomer.gstNumber || "";
      const manualAddress = newCustomer.address || "";

      if (existingCustomer) {
        const hasManualGST = manualGST.trim() !== "" && manualGST !== existingCustomer.gstNumber;
        const hasManualAddress = manualAddress.trim() !== "" && manualAddress !== existingCustomer.address;

        if (hasManualGST || hasManualAddress) {
          try {
            const updateData = {
              customerName: newCustomer.name,
              contactNumber: newCustomer.mobile,
              email: newCustomer.email || ""
            };

            if (hasManualGST) {
              updateData.gstNumber = manualGST;
            }

            if (hasManualAddress) {
              updateData.address = manualAddress;
            }

            axios.put(
              `${import.meta.env.VITE_API_URL}/customer/update-customer/${existingCustomer.customerId}`,
              updateData
            ).then(() => {
              setCustomers(prev => prev.map(c =>
                c.customerId === existingCustomer.customerId
                  ? {
                    ...c,
                    gstNumber: hasManualGST ? manualGST : c.gstNumber,
                    address: hasManualAddress ? manualAddress : c.address
                  }
                  : c
              ));
            }).catch(err => {
              console.error("⚠️ Customer record update failed:", err.message);
            });
          } catch (updateError) {
            console.error("⚠️ Customer update error:", updateError.message);
          }
        }

        customerToUse = {
          ...existingCustomer,
          gstNumber: manualGST.trim() !== "" ? manualGST : existingCustomer.gstNumber || "",
          address: manualAddress.trim() !== "" ? manualAddress : existingCustomer.address || "",
          name: newCustomer.name,
          email: newCustomer.email || existingCustomer.email
        };
      } else {
        customerToUse = newCustomer;
      }

      const invoiceTotals = calculateInvoiceTotals(selectedItems);
      const loyaltyCoinsEarned = calculateLoyaltyCoins(invoiceTotals);
      const loyaltyCoinsUsed = invoiceTotals.loyaltyCoinsUsed || 0;

      if (useLoyaltyCoins && loyaltyCoinsUsed > 0 && existingCustomer) {
        if (existingCustomer.loyaltyCoins < (50 + loyaltyCoinsUsed)) {
          toast.error(`Customer doesn't have enough loyalty coins. Available: ${existingCustomer.loyaltyCoins}, Required minimum: 150 + ${loyaltyCoinsUsed} for usage`);
          setIsSubmitting(false);
          return;
        }
      }

      if (!existingCustomer) {
        try {
          const initialCoins = loyaltyCoinsEarned;
          const createdCustomer = await createCustomer(newCustomer, initialCoins);
          customerToUse = {
            ...createdCustomer,
            loyaltyCoins: initialCoins
          };
          setCustomers([...customers, customerToUse]);
          toast.success("New customer created successfully!");
        } catch (error) {
          if (error.response?.data?.field === "email") {
            toast.error("Customer with this email already exists. Please use a different email.");
          } else {
            toast.error("Failed to create customer. Please try again.");
          }
          setIsSubmitting(false);
          return;
        }
      } else {
        if (loyaltyCoinsUsed > 0 || loyaltyCoinsEarned > 0) {
          try {
            const updatedCustomer = await updateCustomerLoyaltyCoins(
              customerToUse.customerId,
              loyaltyCoinsEarned,
              loyaltyCoinsUsed
            );

            customerToUse = {
              ...customerToUse,
              loyaltyCoins: updatedCustomer.data.loyaltyCoins
            };

            setCustomers(prev => prev.map(c =>
              c.customerId === customerToUse.customerId
                ? { ...c, loyaltyCoins: updatedCustomer.data.loyaltyCoins }
                : c
            ));
          } catch (error) {
            console.error("Error updating customer loyalty coins:", error);
            toast.error("Failed to update customer loyalty coins");
          }
        }
      }

      const invoice = {
        businessType: businessType,
        date: newCustomer.date || new Date().toISOString().split('T')[0],
        customer: {
          ...customerToUse,
          gstNumber: manualGST.trim() !== "" ? manualGST : customerToUse.gstNumber || "",
          address: manualAddress.trim() !== "" ? manualAddress : customerToUse.address || ""
        },
        deliveryAddress: sameAsBilling ? null : {
          fullName: shippingDetails.name || customerToUse.name,
          email: shippingDetails.email || customerToUse.email || "",
          mobile: shippingDetails.mobile || customerToUse.mobile,
          addressLine1: shippingDetails.addressLine1 || "",
          addressLine2: shippingDetails.addressLine2 || "",
          landmark: shippingDetails.landmark || "",
          city: shippingDetails.city || "",
          state: shippingDetails.state || "",
          pincode: shippingDetails.pincode || "",
          country: shippingDetails.country || "India",
          addressType: "shipping",
          instructions: "",
          isDefault: false,
          gstNumber: shippingDetails.gstNumber || ""
        },
        items: invoiceTotals.items.map(item => ({
          ...item,
          originalPrice: item.originalPrice || item.price,
          price: item.price,
          category: item.category
        })),
        paymentType: values.paymentType,
        subtotal: invoiceTotals.subtotal,
        baseValue: invoiceTotals.baseValue,
        discount: invoiceTotals.discount,
        promoDiscount: invoiceTotals.promoDiscount,
        appliedPromoCode: appliedPromo ? {
          promoId: appliedPromo.promoId,
          code: appliedPromo.code,
          discount: appliedPromo.discount,
          description: appliedPromo.description,
          appliedAt: new Date()
        } : null,
        loyaltyDiscount: invoiceTotals.loyaltyDiscount,
        loyaltyCoinsUsed: invoiceTotals.loyaltyCoinsUsed,
        tax: invoiceTotals.tax,
        cgst: invoiceTotals.cgst,
        sgst: invoiceTotals.sgst,
        hasMixedTaxRates: invoiceTotals.hasMixedTaxRates,
        taxPercentages: invoiceTotals.taxPercentages,
        total: invoiceTotals.grandTotal,
        remarks: newCustomer.remarks || '',
        loyaltyCoinsEarned: loyaltyCoinsEarned
      };

      const savedInvoice = await saveInvoiceToDB(invoice);

      setInvoices(prev => {
        const updated = [savedInvoice.data, ...prev];
        updated.sort((a, b) => {
          const numA = parseInt((a.orderNumber || "").replace(/\D/g, "")) || 0;
          const numB = parseInt((b.orderNumber || "").replace(/\D/g, "")) || 0;
          return numB - numA;
        });
        return updated;
      });

      await fetchInventory();

      setSelectedItems([]);
      setNewCustomer({
        customerNumber: "",
        name: "",
        email: "",
        mobile: "",
        date: new Date().toISOString().split('T')[0],
        gstNumber: "",
        address: "",
        remarks: ""
      });
      setCustomerMobileSearch("");

      setShippingDetails({
        name: "",
        email: "",
        mobile: "",
        gstNumber: "",
        addressLine1: "",
        addressLine2: "",
        landmark: "",
        city: "",
        state: "",
        pincode: "",
        country: "India"
      });
      setSameAsBilling(false);

      setUseLoyaltyCoins(false);
      setAvailableLoyaltyCoins(0);
      setUsableLoyaltyCoins(0);

      setPromoCode("");
      setAppliedPromo(null);
      setPromoError("");

      setSelectedInvoice(savedInvoice.data);

      let successMessage = "Invoice created successfully!";
      if (loyaltyCoinsEarned > 0) {
        successMessage += ` Earned ${loyaltyCoinsEarned} loyalty coins.`;
      }
      if (loyaltyCoinsUsed > 0) {
        successMessage += ` Used ${loyaltyCoinsUsed} loyalty coins.`;
      }
      if (customerToUse.loyaltyCoins !== undefined) {
        successMessage += ` Current balance: ${customerToUse.loyaltyCoins} coins.`;
      }

      toast.success(successMessage);
    } catch (error) {
      console.error("Error creating invoice:", error);

      if (error.response?.data?.message?.includes("Insufficient quantity")) {
        toast.error(`Inventory error: ${error.response.data.message}`);
      } else if (error.response?.data?.message?.includes("not found in inventory")) {
        toast.error(`Product not found: ${error.response.data.message}`);
      } else {
        toast.error("Failed to create invoice. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveInvoiceToDB = async (invoice) => {
    try {
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;

      const response = await axios.post(`${import.meta.env.VITE_API_URL}/orders/create-invoice`, {
        ...invoice,
        userDetails: user ? {
          userId: user.userId,
          name: user.name,
          email: user.email
        } : null
      });
      return response.data;
    } catch (error) {
      console.error("Error saving invoice to database:", error);
      throw error;
    }
  };

  const updateInvoice = async (invoiceData) => {
    try {
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;

      const invoiceNumber = invoiceData.orderNumber || invoiceData.invoiceNumber;


      if (!invoiceNumber) {
        console.error("❌ No invoice number provided!");
        throw new Error("Invoice number is required");
      }

      const updatePayload = {
        customer: {
          customerId: invoiceData.customer?.customerId,
          customerNumber: invoiceData.customer?.customerNumber,
          name: invoiceData.customer?.name,
          email: invoiceData.customer?.email,
          mobile: invoiceData.customer?.mobile,
          gstNumber: invoiceData.customer?.gstNumber || '',
          address: invoiceData.customer?.address || ''
        },
        paymentType: invoiceData.paymentType,
        remarks: invoiceData.remarks || '',
        shippingDetails: invoiceData.shippingDetails,
        userDetails: user ? {
          userId: user.userId,
          name: user.name,
          email: user.email
        } : null
      };

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/orders/update-invoice/${invoiceNumber}`,
        updatePayload
      );

      return response.data;
    } catch (error) {
      console.error("Error updating invoice:", error);
      if (error.response) {
        console.error("Response error:", {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url
        });
      }
      throw error;
    }
  };

  const deleteInvoice = async (invoiceNumber) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/orders/delete-invoice/${invoiceNumber}`
      );
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw error;
    }
  };

  const generatePDF = async (invoice, openWhatsapp = false) => {
    if (!invoice) return;
    if (isExporting) return;
    setIsExporting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      setInvoiceForPrint({
        invoice,
        openWhatsapp
      });

      await new Promise(resolve => setTimeout(resolve, 800));

      const element = document.getElementById("sales-pdf");
      if (!element) {
        console.error("PDF element not found");
        toast.error("PDF generation failed - element not found");
        setIsExporting(false);
        return;
      }

      const opt = {
        filename: `${invoice.invoiceNumber}_${(invoice.customer?.name || "customer").replace(/\s+/g, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: true,
          letterRendering: true,
          allowTaint: true
        }
      };

      await html2pdf()
        .set(opt)
        .from(element)
        .save();

      console.log("PDF generated successfully");

      if (openWhatsapp && invoice.customer?.mobile) {
        const phoneNumber = invoice.customer.mobile.replace(/\D/g, '');
        const message = `Invoice ${invoice.invoiceNumber}\n` +
          `Customer: ${invoice.customer.name}\n` +
          `Amount: ₹${invoice.total.toFixed(2)}\n` +
          `Date: ${invoice.date}`;

        setTimeout(() => {
          window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
        }, 500);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (invoices.length === 0) {
      toast.warn("No invoices to export");
      return;
    }

    const data = invoices.flatMap((invoice) => {
      let filteredItems = invoice.items || [];

      if (categoryFilter) {
        filteredItems = filteredItems.filter(item =>
          item.category === categoryFilter
        );
      }

      if (categoryFilter && filteredItems.length === 0) {
        return [];
      }

      if (filteredItems.length === 0) {
        return [{
          'Invoice Number': invoice.invoiceNumber,
          'Date': invoice.date,
          'Customer Name': invoice.customer?.name || '',
          'Customer Email': invoice.customer?.email || '',
          'Customer Mobile': invoice.customer?.mobile || '',
          'Payment Type': invoice.paymentType,
          'Remarks': invoice.remarks || '',
          'Subtotal': `₹${invoice.subtotal?.toFixed(2) || '0.00'}`,
          'Total Discount': `₹${invoice.discount?.toFixed(2) || '0.00'}`,
          'CGST Amount': `₹${invoice.cgst?.toFixed(2) || '0.00'}`,
          'SGST Amount': `₹${invoice.sgst?.toFixed(2) || '0.00'}`,
          'Total Tax': `₹${invoice.tax?.toFixed(2) || '0.00'}`,
          'Grand Total': `₹${invoice.total?.toFixed(2) || '0.00'}`,
          'Items Count': 0,
          'Item Name': 'No items',
          'HSN Code': 'N/A',
          'Batch Number': 'N/A',
          'Category': 'N/A',
          'Quantity': 0,
          'Price': 0,
          'Item Total': '0.00'
        }];
      }

      return filteredItems.map((item, index) => {
        const itemTotal = (item.price || 0) * (item.quantity || 0);
        const itemDiscountAmount = itemTotal * ((item.discount || 0) / 100);
        const itemTotalAfterDiscount = itemTotal - itemDiscountAmount;

        return {
          'Invoice Number': invoice.invoiceNumber,
          'Date': invoice.date,
          'Customer Name': invoice.customer?.name || '',
          'Customer Email': invoice.customer?.email || '',
          'Customer Mobile': invoice.customer?.mobile || '',
          'Payment Type': invoice.paymentType,
          'Remarks': invoice.remarks || '',
          'Subtotal': `₹${invoice.subtotal?.toFixed(2) || '0.00'}`,
          'Total Discount': `₹${invoice.discount?.toFixed(2) || '0.00'}`,
          'CGST Amount': `₹${invoice.cgst?.toFixed(2) || '0.00'}`,
          'SGST Amount': `₹${invoice.sgst?.toFixed(2) || '0.00'}`,
          'Total Tax': `₹${invoice.tax?.toFixed(2) || '0.00'}`,
          'Grand Total': `₹${invoice.total?.toFixed(2) || '0.00'}`,
          'Items Count': filteredItems.length,
          'Item Name': item.name || item.productName || 'Unknown',
          'HSN Code': item.hsn || item.hsnCode || 'N/A',
          'Batch Number': item.batchNumber || 'N/A',
          'Category': item.category || 'N/A',
          'Quantity': item.quantity || 0,
          'Price': `₹${(item.price || 0).toFixed(2)}`,
          'Discount %': `${item.discount || 0}%`,
          'Item Total': `₹${itemTotalAfterDiscount.toFixed(2)}`
        };
      });
    });

    if (data.length === 0) {
      toast.warn(`No invoices found with category: ${categoryFilter}`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

    const fileName = categoryFilter
      ? `invoices_${categoryFilter.replace(/\s+/g, '_')}.xlsx`
      : "invoices.xlsx";

    XLSX.writeFile(workbook, fileName);

    const invoiceCount = new Set(data.map(item => item['Invoice Number'])).size;
    toast.success(`Exported ${invoiceCount} invoices with ${data.length} item rows${categoryFilter ? ` (Filtered by: ${categoryFilter})` : ''}`);
  };

  const handleUpdateInvoice = async (updatedInvoice) => {
    try {
      const result = await updateInvoice(updatedInvoice);
      setInvoices(prev =>
        prev.map(inv =>
          inv.invoiceNumber === updatedInvoice.invoiceNumber ? { ...inv, ...result.data } : inv
        )
      );
      setSelectedInvoice(prev => prev ? { ...prev, ...result.data } : null);
      toast.success("Invoice updated successfully!");
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error(error.response?.data?.message || "Error updating invoice");
    }
  };

  const handleDeleteInvoice = async (invoiceNumber) => {
    try {
      console.log('🗑️ Frontend: Attempting to delete invoice:', invoiceNumber);

      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;

      const response = await axios.delete(
        `${import.meta.env.VITE_API_URL}/orders/delete-invoice/${invoiceNumber}`,
        {
          data: {
            userDetails: user ? {
              userId: user.userId,
              name: user.name,
              email: user.email
            } : null
          }
        }
      );

      setInvoices(prev => prev.filter(inv => inv.invoiceNumber !== invoiceNumber));
      setSelectedInvoice(null);

      console.log('✅ Frontend: Invoice deleted successfully:', {
        invoiceNumber,
        response: response.data
      });

      toast.success(
        `Invoice deleted successfully! ${response.data.restorationDetails.itemsRestored} items restored to inventory.`
      );

      await fetchInventory();
    } catch (error) {
      console.error('❌ Frontend: Error deleting invoice:', {
        invoiceNumber,
        error: error.response?.data,
        message: error.message
      });

      if (error.response?.data?.success === false &&
        error.response?.data?.message?.includes("inventory batches not found")) {

        const errorData = error.response.data;
        const errorCount = errorData.details?.totalErrors || 0;
        const firstError = errorData.errors?.[0] || {};

        toast.error(
          `Cannot delete invoice! ${errorCount} item(s) not found in inventory. Example: ${firstError.productName} (Batch: ${firstError.batchNumber})`
        );

        console.warn('🛑 Invoice deletion blocked due to missing batches:', errorData.details);
      } else {
        toast.error(error.response?.data?.message || "Error deleting invoice");
      }
    }
  };

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!itemSearchTerm) return [];
    const term = itemSearchTerm.toLowerCase();
    return products.filter(product =>
      (product.productName && product.productName.toLowerCase().includes(term)) ||
      (product.hsnCode && product.hsnCode.toLowerCase().includes(term)) ||
      (product.barcode && product.barcode.includes(term)) ||
      (product.price && product.price.toString().includes(term))
    );
  }, [itemSearchTerm, products]);

  const filteredCustomers = useMemo(() => {
    if (!customerMobileSearch) return [];
    const term = customerMobileSearch.toLowerCase();
    return customers.filter(customer =>
      (customer.mobile && customer.mobile.includes(term)) ||
      (customer.name && customer.name.toLowerCase().includes(term))
    );
  }, [customerMobileSearch, customers]);

  // NEW: Filter invoices based on active tab
  const filteredByType = useMemo(() => {
    if (activeTab === 'offline') {
      return invoices.filter(inv => inv.orderType === 'offline');
    }
    if (activeTab === 'online') {
      return invoices.filter(inv => inv.orderType === 'online');
    }
    return invoices; // both
  }, [invoices, activeTab]);

  // Apply search and category filters on top of type filter
  const filteredInvoices = useMemo(() => {
    let filtered = filteredByType;

    if (categoryFilter) {
      filtered = filtered.filter(invoice => {
        return invoice.items?.some(item => item.category === categoryFilter);
      });
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice =>
        (invoice.orderNumber && invoice.orderNumber.toLowerCase().includes(term)) ||
        (invoice.customer?.name && invoice.customer.name.toLowerCase().includes(term)) ||
        (invoice.customer?.mobile && invoice.customer.mobile.includes(term)) ||
        (invoice.paymentType && invoice.paymentType.toLowerCase().includes(term)) ||
        (invoice.total && invoice.total.toString().includes(term))
      );
    }

    return filtered;
  }, [filteredByType, searchTerm, categoryFilter]);

  // Get empty state message based on active tab
  const getEmptyStateMessage = () => {
    if (activeTab === 'offline') {
      return "No offline invoices found. Create your first offline invoice.";
    }
    if (activeTab === 'online') {
      return "No online orders found. Online orders will appear here when customers place orders.";
    }
    return "No invoices found. Create an invoice or wait for online orders.";
  };

  const handleBulkImport = async (file) => {
    try {
      setIsBulkImportLoading(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            toast.error("No data found in the file");
            setIsBulkImportLoading(false);
            return;
          }

          const invoicesMap = new Map();

          jsonData.forEach((row, index) => {
            const invoiceNumber = row['Invoice Number'];

            if (!invoiceNumber) {
              console.warn(`Skipping row ${index + 1}: No invoice number`);
              return;
            }

            if (!invoicesMap.has(invoiceNumber)) {
              invoicesMap.set(invoiceNumber, {
                invoiceNumber: invoiceNumber,
                date: row['Date'] || new Date().toISOString().split('T')[0],
                customer: {
                  customerId: row['Customer ID'] || `CUST-${invoiceNumber}`,
                  customerNumber: row['Customer ID'] || `CUST-${invoiceNumber}`,
                  name: row['Customer Name'] || '',
                  email: row['Customer Email'] || '',
                  mobile: row['Customer Mobile'] || ''
                },
                items: [],
                paymentType: row['Payment Type'] || 'cash',
                subtotal: parseFloat(row['Subtotal']) || 0,
                baseValue: parseFloat(row['Base Value']) || 0,
                discount: parseFloat(row['Total Discount']) || 0,
                tax: parseFloat(row['Total Tax']) || 0,
                cgst: parseFloat(row['CGST']) || 0,
                sgst: parseFloat(row['SGST']) || 0,
                total: parseFloat(row['Grand Total']) || 0,
                hasMixedTaxRates: row['Has Mixed Tax Rates'] === 'Yes',
                taxPercentages: row['Tax Percentages'] ?
                  row['Tax Percentages'].toString().split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n)) : [],
                remarks: row['Remarks'] || '',
                createdAt: row['Created At'] ? new Date(row['Created At']) : new Date(),
                updatedAt: row['Updated At'] ? new Date(row['Updated At']) : new Date()
              });
            }

            const currentInvoice = invoicesMap.get(invoiceNumber);
            if (row['Item Name'] && row['Item Name'] !== 'No items') {
              const newItem = {
                productId: row['Item Product ID'] || `PROD-${invoiceNumber}-${index}`,
                name: row['Item Name'],
                barcode: row['Item Barcode'] || '',
                hsn: row['Item HSN'] || row['HSN Code'] || '',
                category: row['Item Category'] || row['Category'] || '',
                price: parseFloat(row['Item Price']) || 0,
                taxSlab: parseFloat(row['Item Tax Slab']) || 18,
                quantity: parseInt(row['Item Quantity']) || 1,
                discount: parseFloat(row['Item Discount %']) || 0,
                batchNumber: row['Item Batch Number'] || 'DEFAULT',
                expiryDate: row['Item Expiry Date'] || null,
                baseValue: parseFloat(row['Item Base Value']) || 0,
                discountAmount: parseFloat(row['Item Discount Amount']) || 0,
                taxAmount: parseFloat(row['Item Tax Amount']) || 0,
                cgstAmount: parseFloat(row['Item CGST Amount']) || 0,
                sgstAmount: parseFloat(row['Item SGST Amount']) || 0,
                totalAmount: parseFloat(row['Item Total Amount']) || 0
              };

              currentInvoice.items.push(newItem);
            }
          });

          const invoicesToImport = Array.from(invoicesMap.values());

          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/orders/bulk-import-invoices`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ invoices: invoicesToImport }),
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "Failed to import invoices");
          }

          const totalInvoices = invoicesToImport.length;
          const totalItems = invoicesToImport.reduce((sum, inv) => sum + inv.items.length, 0);

          toast.success(
            `Import completed: ${result.results.successful.length}/${totalInvoices} invoices successful, ${totalItems} total items`
          );

          if (result.results.successful.length > 0) {
            await fetchInvoices();
          }

          if (result.results.failed.length > 0) {
            console.warn("Failed imports:", result.results.failed);
            toast.info(`${result.results.failed.length} invoices failed to import. Check console for details.`);
          }

          setShowBulkImport(false);
        } catch (error) {
          console.error("Error processing file:", error);
          toast.error(error.message || "Error processing the file");
        } finally {
          setIsBulkImportLoading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Error reading file");
        setIsBulkImportLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error in bulk import:", error);
      toast.error("Failed to import invoices");
      setIsBulkImportLoading(false);
    }
  };

  const invoiceTotals = useMemo(() => {
    return calculateInvoiceTotals(selectedItems);
  }, [selectedItems, appliedPromo, useLoyaltyCoins, usableLoyaltyCoins]);

  // InvoiceModal Component - UPDATED VERSION
  const InvoiceModal = ({ invoice, onClose, onUpdate, onDelete, fetchInventory }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingProducts, setIsEditingProducts] = useState(false);
    const [editedInvoice, setEditedInvoice] = useState({});
    const [editedItems, setEditedItems] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [modalItemSearchTerm, setModalItemSearchTerm] = useState("");
    const [modalShowBatchDropdown, setModalShowBatchDropdown] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [modalUserPermissions, setModalUserPermissions] = useState([]);

    const [editedShippingDetails, setEditedShippingDetails] = useState({});
    const [sameAsBilling, setSameAsBilling] = useState(false);

    const modalBatchDropdownRef = useRef(null);

    // Check if order is online
    const isOnlineOrder = invoice.orderType === 'online';
    const isOfflineOrder = invoice.orderType === 'offline';

    useEffect(() => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          setModalUserPermissions(user.permissions || []);
        } catch (error) {
          console.error("Error parsing user data:", error);
          setModalUserPermissions([]);
        }
      }
    }, []);

    const modalHasAdminPermission = modalUserPermissions.includes('admin');

    useEffect(() => {
      if (invoice) {
        setEditedInvoice({ ...invoice });
        setEditedItems(invoice.items.map(item => ({
          ...item,
          originalQuantity: item.quantity
        })));

        // For online orders, delivery address is the shipping details
        if (invoice.deliveryAddress) {
          setEditedShippingDetails({ ...invoice.deliveryAddress });
          setSameAsBilling(false);
        } else {
          setEditedShippingDetails({
            name: invoice.customer?.name || "",
            email: invoice.customer?.email || "",
            mobile: invoice.customer?.mobile || "",
            gstNumber: invoice.customer?.gstNumber || ""
          });
          setSameAsBilling(true);
        }
      }
    }, [invoice]);

    useEffect(() => {
      if (sameAsBilling && invoice) {
        setEditedShippingDetails({
          name: invoice.customer?.name || "",
          email: invoice.customer?.email || "",
          mobile: invoice.customer?.mobile || "",
          gstNumber: invoice.customer?.gstNumber || ""
        });
      }
    }, [sameAsBilling, invoice]);

    useEffect(() => {
      if (isEditingProducts) {
        const currentTotals = calculateInvoiceTotals(editedItems, invoice);
        console.log("🔄 PROMO DISCOUNT UPDATE:", {
          itemsCount: editedItems.length,
          subtotal: currentTotals.subtotal,
          amountAfterItemDiscounts: currentTotals.amountAfterAllDiscounts,
          promoDiscount: currentTotals.promoDiscount,
          appliedPromoCode: invoice.appliedPromoCode,
          recalculated: new Date().toLocaleTimeString()
        });
      }
    }, [editedItems, isEditingProducts, invoice]);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (modalBatchDropdownRef.current && !modalBatchDropdownRef.current.contains(event.target)) {
          setModalShowBatchDropdown(null);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    const modalFilteredProducts = useMemo(() => {
      if (!modalItemSearchTerm) return [];
      const term = modalItemSearchTerm.toLowerCase();
      return products.filter(product =>
        (product.productName && product.productName.toLowerCase().includes(term)) ||
        (product.hsnCode && product.hsnCode.toLowerCase().includes(term)) ||
        (product.barcode && product.barcode.includes(term))
      );
    }, [modalItemSearchTerm, products]);

    const modalGetAvailableBatches = (productId) => {
      const inventoryItem = inventory.find(item => item.productId === productId);
      if (!inventoryItem || !inventoryItem.batches) return [];

      const currentDate = new Date();

      return inventoryItem.batches
        .filter(batch => {
          const isExpired = new Date(batch.expiryDate) < currentDate;
          return batch.currentQuantity > 0 && !isExpired;
        })
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))
        .map(batch => {
          const product = products.find(p => p.productId === productId);
          const productName = product?.productName || inventoryItem.productName || "Unknown Product";

          return {
            ...batch,
            productId: inventoryItem.productId,
            productName: productName,
            category: inventoryItem.category
          };
        });
    };

    const modalGetAvailableQuantity = (productId, batchNumber) => {
      const inventoryItem = inventory.find(item => item.productId === productId);
      if (!inventoryItem || !inventoryItem.batches) return 0;

      const batch = inventoryItem.batches.find(b => b.batchNumber === batchNumber);
      return batch ? (batch.currentQuantity || 0) : 0;
    };

    const handleProductSelect = (product) => {
      const availableBatches = modalGetAvailableBatches(product.productId);

      if (availableBatches.length === 0) {
        toast.error("No available stock for this product");
        return;
      }

      if (availableBatches.length === 1) {
        handleAddNewItem(product, availableBatches[0]);
      } else {
        setModalShowBatchDropdown(product.productId);
      }
    };

    const handleAddNewItem = (product, batch) => {
      const inventoryItem = inventory.find(item => item.productId === product.productId);
      const batchData = inventoryItem?.batches?.find(b => b.batchNumber === batch.batchNumber);
      const productFromProducts = products.find(p => p.productId === product.productId);
      const productName = productFromProducts?.productName || product.productName || "Unknown Product";

      let itemPrice = 0;
      if (productFromProducts) {
        if (productFromProducts.type === "simple") {
          if (productFromProducts.colors && productFromProducts.colors.length > 0) {
            itemPrice = productFromProducts.colors[0].currentPrice || productFromProducts.currentPrice || 0;
          } else {
            itemPrice = productFromProducts.currentPrice || 0;
          }
        } else {
          itemPrice = productFromProducts.currentPrice || 0;
        }
      }

      const newItem = {
        productId: product.productId,
        id: product.productId,
        name: productName,
        productName: productName,
        category: productFromProducts?.category || product.category || "",
        hsn: productFromProducts?.hsnCode || "",
        barcode: productFromProducts?.barcode || "",
        originalPrice: itemPrice,
        price: itemPrice,
        quantity: 1,
        discount: productFromProducts?.discount || 0,
        taxSlab: productFromProducts?.taxSlab || 18,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        inventoryId: inventoryItem?._id || inventoryItem?.id || "unknown",
        purchasedFromStock: batchData?.currentQuantity || batchData?.quantity || 0,
        status: 'delivered'
      };

      setEditedItems(prev => [...prev, newItem]);
      setModalItemSearchTerm("");
      setModalShowBatchDropdown(null);
    };

    const handleItemUpdate = (index, field, value) => {
      const updatedItems = [...editedItems];

      if (field === 'quantity') {
        const newQuantity = Math.max(1, parseInt(value) || 1);

        if (!updatedItems[index].hasOwnProperty('originalQuantity')) {
          updatedItems[index].originalQuantity = updatedItems[index].quantity;
        }

        updatedItems[index][field] = newQuantity;
      } else if (field === 'discount') {
        updatedItems[index][field] = value === "" ? "" : parseInt(value) || 0;
      } else if (field === 'price') {
        updatedItems[index][field] = value;
      } else {
        updatedItems[index][field] = value;
      }

      setEditedItems(updatedItems);
    };

    const handleRemoveItem = (index) => {
      setEditedItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveProducts = async () => {
      if (!invoice) return;

      setIsSaving(true);
      try {
        const userData = localStorage.getItem('user');
        const user = userData ? JSON.parse(userData) : null;

        const itemsWithRequiredFields = editedItems.map((item) => {
          const quantity = item.quantity || 1;
          const price = item.price || 0;
          const discount = item.discount || 0;
          const taxRate = item.taxSlab || 18;

          let inventoryId = "";
          let purchasedFromStock = 0;

          const inventoryItem = inventory.find(inv => inv.productId === item.productId);
          if (inventoryItem) {
            inventoryId = inventoryItem._id || inventoryItem.id || "";

            const batch = inventoryItem.batches?.find(b => b.batchNumber === item.batchNumber);
            if (batch) {
              purchasedFromStock = batch.currentQuantity || batch.quantity || 0;
            }
          }

          const itemTotalBeforeDiscount = price * quantity;
          const discountAmount = itemTotalBeforeDiscount * (discount / 100);
          const itemTotalAfterDiscount = itemTotalBeforeDiscount - discountAmount;
          const baseValue = itemTotalAfterDiscount / (1 + taxRate / 100);
          const taxAmount = itemTotalAfterDiscount - baseValue;
          const cgstAmount = taxAmount / 2;
          const sgstAmount = taxAmount / 2;
          const finalAmount = itemTotalAfterDiscount;

          return {
            ...item,
            productName: item.name || item.productName || "Unknown",
            inventoryId: inventoryId || "unknown",
            purchasedFromStock: purchasedFromStock,
            baseValue: parseFloat(baseValue.toFixed(2)),
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            taxAmount: parseFloat(taxAmount.toFixed(2)),
            cgstAmount: parseFloat(cgstAmount.toFixed(2)),
            sgstAmount: parseFloat(sgstAmount.toFixed(2)),
            totalAmount: parseFloat(itemTotalAfterDiscount.toFixed(2)),
            finalAmount: parseFloat(finalAmount.toFixed(2))
          };
        });

        const response = await axios.put(
          `${import.meta.env.VITE_API_URL}/orders/update-order-products/${invoice.orderNumber}`,
          {
            updatedItems: itemsWithRequiredFields,
            originalItems: invoice.items,
            userDetails: user ? {
              userId: user.userId,
              name: user.name,
              email: user.email
            } : null
          }
        );

        if (response.data.success) {
          const updatedOrder = response.data.data.order;
          setEditedInvoice(updatedOrder);
          setIsEditingProducts(false);
          toast.success("Invoice products updated successfully!");

          if (onUpdate) {
            onUpdate(updatedOrder);
          }
          fetchInventory();
        }
      } catch (error) {
        console.error("❌ Error updating invoice products:", error);
        if (error.response?.data?.errors) {
          const errors = error.response.data.errors;
          if (Array.isArray(errors)) {
            errors.forEach(err => {
              toast.error(`Inventory error: ${err.productName} - ${err.error} (Available: ${err.available})`);
            });
          }
        } else {
          toast.error(error.response?.data?.message || "Failed to update products");
        }
      } finally {
        setIsSaving(false);
      }
    };

    const calculateInvoiceBreakdown = (invoiceData) => {
      const subtotal = invoiceData.subtotal || 0;
      const itemDiscount = invoiceData.discount || 0;
      const promoDiscount = invoiceData.promoDiscount || 0;
      const loyaltyDiscount = invoiceData.loyaltyDiscount || 0;
      const tax = invoiceData.tax || 0;
      const cgst = invoiceData.cgst || 0;
      const sgst = invoiceData.sgst || 0;
      const total = invoiceData.total || 0;

      // Amount that includes tax after discounts
      const amountWithTax = subtotal - itemDiscount;

      // Get tax rate from first item or from tax percentages
      let taxRate = 5; // default
      if (invoiceData.items && invoiceData.items.length > 0) {
        taxRate = invoiceData.items[0].taxSlab || 5;
      }

      // Calculate amount BEFORE tax (excluding tax)
      const amountBeforeTax = amountWithTax / (1 + taxRate / 100);

      const amountAfterPromo = amountBeforeTax - promoDiscount;
      const amountAfterLoyalty = amountAfterPromo - loyaltyDiscount;

      let taxPercentages = invoiceData.taxPercentages || [];
      if (taxPercentages.length === 0 && invoiceData.items && invoiceData.items.length > 0) {
        taxPercentages = [...new Set(invoiceData.items.map(item => item.taxSlab).filter(slab => slab > 0))];
      }

      return {
        subtotal,
        itemDiscount,
        promoDiscount,
        loyaltyDiscount,
        amountBeforeTax: amountBeforeTax,  // Now this is EXCLUDING tax!
        amountAfterPromo: amountAfterPromo,
        amountAfterLoyalty: amountAfterLoyalty,
        tax,
        cgst,
        sgst,
        grandTotal: total,
        hasMixedTaxRates: invoiceData.hasMixedTaxRates || taxPercentages.length > 1,
        taxPercentages: taxPercentages,
        loyaltyCoinsUsed: invoiceData.loyaltyCoinsUsed || 0
      };
    };

    const calculateCurrentTotals = () => {
      if (isEditingProducts) {
        const totals = calculateInvoiceTotals(editedItems, invoice);
        return totals;
      } else {
        return calculateInvoiceBreakdown(invoice);
      }
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      if (name === "remarks") {
        setEditedInvoice(prev => ({
          ...prev,
          remarks: value
        }));
      } else {
        setEditedInvoice(prev => ({
          ...prev,
          customer: {
            ...prev.customer,
            [name]: value
          }
        }));
      }
    };

    const handlePaymentTypeChange = (e) => {
      setEditedInvoice(prev => ({
        ...prev,
        paymentType: e.target.value
      }));
    };

    const handleSave = async () => {
      try {
        const invoiceNumber = editedInvoice.orderNumber || invoice.orderNumber;

        if (!invoiceNumber) {
          toast.error("Invoice number is missing!");
          return;
        }

        const updateData = {
          ...editedInvoice,
          orderNumber: invoiceNumber,
          shippingDetails: sameAsBilling ? null : editedShippingDetails
        };

        await onUpdate(updateData);
        setIsEditing(false);
      } catch (error) {
        console.error("Error updating invoice:", error);
      }
    };

    const handleShippingInputChange = (e) => {
      const { name, value } = e.target;
      setEditedShippingDetails(prev => ({
        ...prev,
        [name]: value
      }));
    };

    const calculateItemTotal = (item) => {
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const discount = item.discount || 0;

      const totalBeforeDiscount = price * quantity;
      const discountAmount = totalBeforeDiscount * (discount / 100);
      return totalBeforeDiscount - discountAmount;
    };

    const handleSharePDF = async () => {
      setIsExporting(true);

      try {
        await generatePDF(invoice, true);

        setTimeout(() => {
          const customerMobile = invoice.deliveryAddress?.mobile || invoice.customer?.mobile;
          const customerName = invoice.deliveryAddress?.fullName || invoice.customer?.name;

          if (customerMobile) {
            const phoneNumber = customerMobile.replace(/\D/g, '');
            const message = `Invoice ${invoice.orderNumber}\n` +
              `Customer: ${customerName}\n` +
              `Amount: ₹${invoice.total.toFixed(2)}\n` +
              `Date: ${invoice.date}`;

            window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
          }

          setIsExporting(false);
        }, 1000);
      } catch (error) {
        console.error("Error sharing PDF:", error);
        toast.error("Failed to share invoice");
        setIsExporting(false);
      }
    };

    if (!invoice) return null;

    const currentTotals = calculateCurrentTotals();

    // Get payment type - handle both formats
    const paymentType = invoice.paymentType || invoice.payment?.method || 'cash';

    // Get customer name - handle both formats
    const customerName = isOnlineOrder
      ? (invoice.deliveryAddress?.fullName || invoice.customer?.name || 'Unknown')
      : (invoice.customer?.name || 'Unknown');

    const customerMobile = isOnlineOrder
      ? (invoice.deliveryAddress?.mobile || invoice.customer?.mobile || '')
      : (invoice.customer?.mobile || '');

    const customerEmail = isOnlineOrder
      ? (invoice.deliveryAddress?.email || invoice.customer?.email || '')
      : (invoice.customer?.email || '');

    const customerGST = invoice.customer?.gstNumber || '';
    const customerAddress = isOnlineOrder
      ? `${invoice.deliveryAddress?.addressLine1 || ''} ${invoice.deliveryAddress?.addressLine2 || ''} ${invoice.deliveryAddress?.city || ''} ${invoice.deliveryAddress?.state || ''} - ${invoice.deliveryAddress?.pincode || ''}`
      : (invoice.customer?.address || '');

    const safeToFixed = (value, decimals = 2) => {
      if (value === undefined || value === null || isNaN(value)) {
        return '0.00';
      }
      return Number(value).toFixed(decimals);
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content invoice-modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isEditingProducts ? "Edit Invoice Products" :
                isEditing ? "Edit Invoice" :
                  `Invoice Details: ${invoice.orderNumber}`}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            {/* ==================== SECTION 1: BASIC INFORMATION ==================== */}
            <div className="invoice-section">
              <h3 className="section-title">Basic Information</h3>
              <div className="wo-details-grid">
                <div className="detail-row">
                  <span className="detail-label">Invoice Number:</span>
                  <span className="detail-value invoice-number">
                    {invoice.orderNumber}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">
                    {new Date(invoice.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Business Type:</span>
                  <span className={`business-type-badge ${invoice.businessType}`}>
                    {invoice.businessType?.toUpperCase() || 'B2C'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Order Type:</span>
                  <span className={`order-type-badge ${invoice.orderType}`}>
                    {invoice.orderType === 'online' ? 'Online Order' : 'Offline Invoice'}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Payment Type:</span>
                  {isEditing && isOfflineOrder ? (
                    <select
                      value={editedInvoice.paymentType || paymentType}
                      onChange={handlePaymentTypeChange}
                      className="edit-input"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="cod">COD</option>
                    </select>
                  ) : (
                    <span className="detail-value">{paymentType.toUpperCase()}</span>
                  )}
                </div>

                {invoice.loyaltyCoinsEarned > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Loyalty Coins Earned:</span>
                    <span className="detail-value coins-earned">
                      +{invoice.loyaltyCoinsEarned} coins
                      <small> (From this invoice)</small>
                    </span>
                  </div>
                )}

                <div className="detail-row">
                  <span className="detail-label">Remarks:</span>
                  {isEditing && isOfflineOrder ? (
                    <textarea
                      name="remarks"
                      value={editedInvoice.remarks || ''}
                      onChange={(e) => setEditedInvoice(prev => ({
                        ...prev,
                        remarks: e.target.value
                      }))}
                      className="edit-input"
                      rows={3}
                      style={{ width: '100%', resize: 'vertical' }}
                      placeholder="Optional remarks..."
                    />
                  ) : (
                    <span className="detail-value">{invoice.remarks || 'No remarks'}</span>
                  )}
                </div>

                {invoice.appliedPromoCode && (
                  <div className="detail-row">
                    <span className="detail-label">Promo Code Applied:</span>
                    <span className="detail-value promo-code-value">
                      {invoice.appliedPromoCode.code} - {invoice.appliedPromoCode.discount}% off
                      {invoice.appliedPromoCode.description && (
                        <div className="promo-description">{invoice.appliedPromoCode.description}</div>
                      )}
                    </span>
                  </div>
                )}

                {invoice.loyaltyCoinsUsed > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Loyalty Coins Used:</span>
                    <span className="detail-value">
                      {invoice.loyaltyCoinsUsed} coins (₹{safeToFixed(currentTotals.loyaltyDiscount)})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ==================== SECTION 2: CUSTOMER ACCOUNT DETAILS (ONLINE ORDERS ONLY) ==================== */}
            {isOnlineOrder && (
              <div className="invoice-section">
                <h3 className="section-title">Customer Account Details</h3>
                <div className="wo-details-grid">
                  <div className="detail-row">
                    <span className="detail-label">Account Name:</span>
                    <span className="detail-value">{invoice.customer?.name || 'N/A'}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Account Mobile:</span>
                    <span className="detail-value">{invoice.customer?.mobile || 'N/A'}</span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Account Email:</span>
                    <span className="detail-value">{invoice.customer?.email || 'N/A'}</span>
                  </div>

                  {invoice.customer?.gstNumber && (
                    <div className="detail-row">
                      <span className="detail-label">GST Number:</span>
                      <span className="detail-value">{invoice.customer.gstNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== SECTION 3: DELIVERY ADDRESS (ONLINE ORDERS ONLY) ==================== */}
            {isOnlineOrder && invoice.deliveryAddress && (
              <div className="invoice-section">
                <h3 className="section-title">Delivery Address</h3>
                <div className="address-info-box">
                  <div className="address-info-header">
                    <span className="address-type-badge">
                      {invoice.deliveryAddress.addressType || 'Shipping'} Address
                    </span>
                  </div>
                  <div className="address-preview">
                    <div><strong>{invoice.deliveryAddress.fullName}</strong></div>
                    <div>{invoice.deliveryAddress.mobile}</div>
                    {invoice.deliveryAddress.email && <div>{invoice.deliveryAddress.email}</div>}
                    <div>{invoice.deliveryAddress.addressLine1}</div>
                    {invoice.deliveryAddress.addressLine2 && <div>{invoice.deliveryAddress.addressLine2}</div>}
                    {invoice.deliveryAddress.landmark && <div>Landmark: {invoice.deliveryAddress.landmark}</div>}
                    <div>{invoice.deliveryAddress.city}, {invoice.deliveryAddress.state} - {invoice.deliveryAddress.pincode}</div>
                    <div>{invoice.deliveryAddress.country}</div>
                    {invoice.deliveryAddress.instructions && (
                      <div className="instructions">Instructions: {invoice.deliveryAddress.instructions}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== SECTION 4: CUSTOMER DETAILS (OFFLINE ORDERS ONLY) ==================== */}
            {isOfflineOrder && (
              <div className="invoice-section">
                <h3 className="section-title">Customer Details</h3>
                <div className="wo-details-grid">
                  <div className="detail-row">
                    <span className="detail-label">Customer Name:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={editedInvoice.customer?.name || invoice.customer?.name || ''}
                        onChange={handleInputChange}
                        className="edit-input"
                      />
                    ) : (
                      <span className="detail-value">{invoice.customer?.name || 'N/A'}</span>
                    )}
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Mobile Number:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="mobile"
                        value={editedInvoice.customer?.mobile || invoice.customer?.mobile || ''}
                        onChange={handleInputChange}
                        className="edit-input"
                      />
                    ) : (
                      <span className="detail-value">{invoice.customer?.mobile || 'N/A'}</span>
                    )}
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Email:</span>
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={editedInvoice.customer?.email || invoice.customer?.email || ''}
                        onChange={handleInputChange}
                        className="edit-input"
                      />
                    ) : (
                      <span className="detail-value">{invoice.customer?.email || 'N/A'}</span>
                    )}
                  </div>

                  {invoice.customer?.gstNumber && (
                    <div className="detail-row">
                      <span className="detail-label">GST Number:</span>
                      <span className="detail-value gst-display">
                        {invoice.customer.gstNumber}
                        {invoice.businessType === 'b2b' && (
                          <span className="gst-type-label"> (B2B GST)</span>
                        )}
                      </span>
                    </div>
                  )}

                  {invoice.customer?.address && (
                    <div className="detail-row">
                      <span className="detail-label">Customer Address:</span>
                      {isEditing ? (
                        <textarea
                          name="address"
                          value={editedInvoice.customer?.address || invoice.customer.address}
                          onChange={(e) => setEditedInvoice(prev => ({
                            ...prev,
                            customer: {
                              ...prev.customer,
                              address: e.target.value
                            }
                          }))}
                          className="edit-input"
                          rows="2"
                          placeholder="Customer address"
                        />
                      ) : (
                        <span className="detail-value">{invoice.customer.address}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== SECTION 5: SHIPPING DETAILS (OFFLINE ORDERS ONLY) ==================== */}
            {isOfflineOrder && (
              <div className="invoice-section">
                <h3 className="section-title">Shipping Details</h3>
                {invoice.deliveryAddress ? (
                  <div className="address-info-box">
                    <div className="address-info-header">
                      <span className="address-type-badge">Shipping Address</span>
                    </div>
                    <div className="address-preview">
                      <div><strong>{invoice.deliveryAddress.fullName}</strong></div>
                      <div>{invoice.deliveryAddress.mobile}</div>
                      {invoice.deliveryAddress.email && <div>{invoice.deliveryAddress.email}</div>}
                      {invoice.deliveryAddress.gstNumber && (
                        <div><strong>GST:</strong> {invoice.deliveryAddress.gstNumber}</div>
                      )}
                      <div>{invoice.deliveryAddress.addressLine1}</div>
                      {invoice.deliveryAddress.addressLine2 && <div>{invoice.deliveryAddress.addressLine2}</div>}
                      {invoice.deliveryAddress.landmark && <div>Landmark: {invoice.deliveryAddress.landmark}</div>}
                      <div>{invoice.deliveryAddress.city}, {invoice.deliveryAddress.state} - {invoice.deliveryAddress.pincode}</div>
                      <div>{invoice.deliveryAddress.country}</div>
                      {invoice.deliveryAddress.instructions && (
                        <div className="instructions">Instructions: {invoice.deliveryAddress.instructions}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="address-info-box same-as-billing">
                    <div className="address-preview">
                      <p><strong>Same as Billing Address</strong></p>
                      <div>{invoice.customer?.name}</div>
                      <div>{invoice.customer?.mobile}</div>
                      {invoice.customer?.email && <div>{invoice.customer.email}</div>}
                      {invoice.customer?.address && <div>{invoice.customer.address}</div>}
                      {invoice.customer?.gstNumber && <div>GST: {invoice.customer.gstNumber}</div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== SECTION 6: ITEMS DETAILS ==================== */}
            <div className="invoice-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 className="section-title">
                  Items Details ({invoice.items?.length || 0} items)
                </h3>

                {/* ONLY SHOW EDIT BUTTONS FOR OFFLINE ORDERS */}
                {isOfflineOrder && !isEditing && !isEditingProducts && modalHasAdminPermission && (
                  <button
                    className="update-btn"
                    onClick={() => setIsEditingProducts(true)}
                    style={{ margin: 0 }}
                  >
                    <FaEdit /> Update Products
                  </button>
                )}
              </div>

              {/* View Mode - Items Table with Tax Column */}
              <div className="items-table-container">
                <table className="items-details-table">
                  <thead>
                    <tr>
                      <th width="5%">Sr No</th>
                      <th width="18%">Product Name</th>
                      <th width="10%">HSN Code</th>
                      <th width="8%">Category</th>
                      <th width="10%">Batch No</th>
                      <th width="6%">Qty</th>
                      <th width="10%">Price</th>
                      <th width="8%">Disc %</th>
                      <th width="8%">GST %</th>
                      <th width="12%">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((item, index) => (
                        <tr key={`${item.productId}-${item.batchNumber}-${index}`}>
                          <td>{index + 1}</td>
                          <td>
                            <div className="product-name">{item.productName || item.name || "Unknown"}</div>
                            {item.barcode && (
                              <div className="product-barcode">Barcode: {item.barcode}</div>
                            )}
                          </td>
                          <td>{item.hsn || item.hsnCode || "N/A"}</td>
                          <td>
                            <span className="category-tag">{item.category || "N/A"}</span>
                          </td>
                          <td>
                            <div className="batch-info">
                              <span className="batch-tag">{item.batchNumber || "N/A"}</span>
                              {item.expiryDate && (
                                <div className="expiry-date">
                                  Exp: {new Date(item.expiryDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>{item.quantity || 0}</td>
                          <td>₹{safeToFixed(item.price || 0)}</td>
                          <td>{item.discount || 0}%</td>
                          <td>{item.taxSlab || 0}%</td>
                          <td className="amount-cell">₹{safeToFixed(calculateItemTotal(item))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="10" className="no-items-message">No items found in this invoice</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ==================== SECTION 7: INVOICE SUMMARY ==================== */}
            <div className="invoice-section">
              <h3 className="section-title">Invoice Calculation Breakdown</h3>
              <div className="invoice-summary-grid detailed-calculation">
                <div className="calculation-step">
                  <span className="step-label">Subtotal (Incl. Tax):</span>
                  <span className="step-value">₹{safeToFixed(currentTotals.subtotal)}</span>
                </div>

                <div className="calculation-step discount-step">
                  <span className="step-label">Total Item Discount:</span>
                  <span className="step-value">
                    -₹{safeToFixed(currentTotals.itemDiscount)}
                  </span>
                </div>

                <div className="calculation-step amount-before-tax">
                  <span className="step-label">Amount Before Tax:</span>
                  <span className="step-value">
                    ₹{safeToFixed(currentTotals.amountBeforeTax)}
                  </span>
                </div>

                {currentTotals.promoDiscount > 0 && (
                  <>
                    <div className="calculation-step promo-step">
                      <span className="step-label">
                        Promo Discount ({invoice.appliedPromoCode?.discount || 0}%):
                      </span>
                      <span className="step-value">-₹{safeToFixed(currentTotals.promoDiscount)}</span>
                    </div>

                    <div className="calculation-step taxable-amount">
                      <span className="step-label">Amount After Promo:</span>
                      <span className="step-value">
                        ₹{safeToFixed(currentTotals.amountAfterPromo)}
                      </span>
                    </div>
                  </>
                )}

                {currentTotals.loyaltyDiscount > 0 && (
                  <>
                    <div className="calculation-step loyalty-step">
                      <span className="step-label">
                        Loyalty Coins Used ({currentTotals.loyaltyCoinsUsed} coins):
                      </span>
                      <span className="step-value">-₹{safeToFixed(currentTotals.loyaltyDiscount)}</span>
                    </div>

                    <div className="calculation-step amount-after-loyalty">
                      <span className="step-label">Amount After Loyalty:</span>
                      <span className="step-value">
                        ₹{safeToFixed(currentTotals.amountAfterLoyalty)}
                      </span>
                    </div>
                  </>
                )}

                {!currentTotals.hasMixedTaxRates && currentTotals.taxPercentages && currentTotals.taxPercentages.length > 0 && (
                  <>
                    <div className="calculation-step tax-step">
                      <span className="step-label">CGST ({currentTotals.taxPercentages[0] / 2}%):</span>
                      <span className="step-value">+₹{safeToFixed(currentTotals.cgst)}</span>
                    </div>
                    <div className="calculation-step tax-step">
                      <span className="step-label">SGST ({currentTotals.taxPercentages[0] / 2}%):</span>
                      <span className="step-value">+₹{safeToFixed(currentTotals.sgst)}</span>
                    </div>
                  </>
                )}

                {currentTotals.hasMixedTaxRates && (
                  <div className="calculation-step tax-step">
                    <span className="step-label">Total GST:</span>
                    <span className="step-value">+₹{safeToFixed(currentTotals.tax)}</span>
                  </div>
                )}

                <div className="calculation-step total-row">
                  <span className="step-label">Grand Total:</span>
                  <span className="step-value total-amount">
                    ₹{safeToFixed(currentTotals.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              className="share-pdf-btn"
              onClick={handleSharePDF}
              disabled={isExporting}
            >
              {isExporting ? <FaSpinner className="spinner" /> : <FaFilePdf />}
              {isExporting ? "Generating PDF..." : "Share PDF"}
            </button>

            {/* ONLY SHOW EDIT/DELETE BUTTONS FOR OFFLINE ORDERS */}
            {isOfflineOrder && (
              <>
                <button
                  className={`update-btn ${isEditing ? 'save-btn' : ''}`}
                  onClick={isEditing ? handleSave : () => setIsEditing(true)}
                >
                  {isEditing ? <FaSave /> : <FaEdit />}
                  {isEditing ? "Save Changes" : "Update"}
                </button>
                <button
                  className="delete-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <FaTrash /> Delete
                </button>
              </>
            )}
          </div>
        </div>

        {showDeleteConfirm && isOfflineOrder && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Are you sure you want to delete invoice {invoice.orderNumber}? This action cannot be undone.</p>
              <div className="confirm-buttons">
                <button
                  className="confirm-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="confirm-delete"
                  onClick={() => {
                    onDelete(invoice.orderNumber);
                    setShowDeleteConfirm(false);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const BulkImportModal = ({ onClose, onImport, isLoading }) => {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = (selectedFile) => {
      if (selectedFile && !isLoading) {
        const validTypes = [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv'
        ];

        if (!validTypes.includes(selectedFile.type)) {
          toast.error("Please select a valid Excel file (.xlsx, .xls, .csv)");
          return;
        }
        setFile(selectedFile);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (!isLoading) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      setIsDragging(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      if (!isLoading) {
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        handleFileSelect(droppedFile);
      }
    };

    const handleImport = () => {
      if (!file || isLoading) return;
      onImport(file);
    };

    return (
      <div className="modal-overlay" onClick={!isLoading ? onClose : undefined}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isLoading ? "Importing Invoices..." : "Bulk Import Invoices"}
            </div>
            {!isLoading && (
              <button className="modal-close" onClick={onClose}>&times;</button>
            )}
          </div>

          <div className="modal-body">
            {isLoading ? (
              <div className="import-loading">
                <div className="loading-spinner large"></div>
                <p>Importing invoices, please wait...</p>
                <div className="loading-progress">
                  <div className="progress-bar">
                    <div className="progress-fill"></div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="import-instructions">
                  <h4>File Requirements:</h4>
                  <ul>
                    <li>File format: Excel (.xlsx, .xls) or CSV</li>
                    <li>Must contain the exported invoice data with original structure</li>
                    <li>Multiple items in same invoice will be grouped automatically</li>
                    <li>Invoice numbers will be preserved as in the file</li>
                    <li>All data will be imported as-is without validation</li>
                  </ul>
                </div>

                <div
                  className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''} ${isLoading ? 'disabled' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    disabled={isLoading}
                  />

                  {file ? (
                    <div className="file-selected">
                      <FaFileExcel className="file-icon" />
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                      {!isLoading && (
                        <button
                          className="remove-file"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <FaFileExcel className="upload-icon" />
                      <p>Drop Excel file here or click to browse</p>
                      <small>Supports .xlsx, .xls, .csv files</small>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            {!isLoading && (
              <button className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              className={`import-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleImport}
              disabled={!file || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner small"></div>
                  Importing...
                </>
              ) : (
                <>
                  <FaFileExcel /> Import Invoices
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Navbar>
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <div className="main">
        <div className="page-header">
          <div className="right-section">
            <div className="category-filter">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="action-buttons-group">
              <button className="export-all-btn" onClick={handleExportExcel}>
                <FaFileExcel /> Export All
              </button>
              <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                <FaPlus /> {showForm ? "Close" : "Create"}
              </button>
            </div>
          </div>
        </div>

        {/* TABS SECTION */}
        <div className="tabs-container">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'offline' ? 'active' : ''}`}
              onClick={() => setActiveTab('offline')}
            >
              Offline Invoices
            </button>
            <button
              className={`tab ${activeTab === 'online' ? 'active' : ''}`}
              onClick={() => setActiveTab('online')}
            >
              Online Orders
            </button>
            <button
              className={`tab ${activeTab === 'both' ? 'active' : ''}`}
              onClick={() => setActiveTab('both')}
            >
              Both
            </button>
          </div>
        </div>

        {showForm && (
          <div className="form-container premium">
            <h2>Create Tax Invoice.</h2>
            <Formik
              initialValues={{ paymentType: "cash" }}
              validationSchema={Yup.object().shape({
                paymentType: Yup.string().required("Payment type is required")
              })}
              onSubmit={handleSubmit}
            >
              {({ values, setFieldValue }) => (
                <Form>
                  <h3 className="section-heading">Business Type *</h3>
                  <div className="business-type-toggle">
                    <div className="business-type-options">
                      <label className={`business-type-option ${businessType === "b2c" ? "active" : ""}`} data-type="b2c">
                        <input
                          type="radio"
                          name="businessType"
                          value="b2c"
                          checked={businessType === "b2c"}
                          onChange={(e) => setBusinessType(e.target.value)}
                        />
                        <span className="option-label">
                          <span className="option-title">B2C</span>
                          <span className="option-subtitle">Business to Customer</span>
                        </span>
                      </label>

                      <label className={`business-type-option ${businessType === "b2b" ? "active" : ""}`} data-type="b2b">
                        <input
                          type="radio"
                          name="businessType"
                          value="b2b"
                          checked={businessType === "b2b"}
                          onChange={(e) => setBusinessType(e.target.value)}
                        />
                        <span className="option-label">
                          <span className="option-title">B2B</span>
                          <span className="option-subtitle">Business to Business</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <h3 className="section-heading">Invoice Date</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper" style={{ flex: '0 0 33%', maxWidth: '300px' }}>
                      <label>Date *</label>
                      <input
                        type="date"
                        value={newCustomer.date}
                        onChange={(e) => setNewCustomer({ ...newCustomer, date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <h3 className="section-heading">Item Details</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper">
                      <label>Search Products</label>
                      <input
                        type="text"
                        placeholder="Search by name, HSN Code, barcode or price..."
                        value={itemSearchTerm}
                        onChange={(e) => setItemSearchTerm(e.target.value)}
                      />
                      {isLoadingProducts && (
                        <div className="search-dropdown">
                          <div className="dropdown-item">Loading products...</div>
                        </div>
                      )}
                      {itemSearchTerm && !isLoadingProducts && filteredProducts.length > 0 && (
                        <div className="search-dropdown">
                          {filteredProducts.map(product => {
                            const availableBatches = getAvailableBatches(product.productId);
                            const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.quantity, 0);
                            const inventoryItem = inventory.find(item => item.productId === product.productId);
                            const hasBatches = inventoryItem && inventoryItem.batches && inventoryItem.batches.length > 0;
                            const hasValidBatches = hasBatches && inventoryItem.batches.some(batch =>
                              batch.expiryDate && new Date(batch.expiryDate) >= new Date() && batch.quantity > 0
                            );

                            return (
                              <div
                                key={product.productId}
                                className={`dropdown-item ${!hasValidBatches ? 'invalid-product' : totalAvailable === 0 ? 'out-of-stock' : ''}`}
                                onClick={() => {
                                  if (hasValidBatches && totalAvailable > 0) {
                                    handleProductSelect(product);
                                  } else {
                                    if (!hasBatches) {
                                      toast.error("❌ This product has no batch numbers. Cannot add to invoice.");
                                    } else if (!hasValidBatches) {
                                      toast.error("❌ This product has no valid batches. Cannot add to invoice.");
                                    }
                                  }
                                }}
                              >
                                <div>
                                  {product.productName}
                                  {totalAvailable === 0 && hasValidBatches && (
                                    <span className="stock-badge">Out of Stock</span>
                                  )}
                                  {totalAvailable > 0 && hasValidBatches && (
                                    <span className="stock-badge">In Stock: {totalAvailable}</span>
                                  )}
                                </div>
                                <div>
                                  HSN Code: {product.hsnCode || "N/A"} |
                                  Price: ₹{product.price || 0} |
                                  Tax: {product.taxSlab || 18}% |
                                  Category: {product.category}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {showBatchDropdown && (
                    <div className="batch-dropdown-overlay">
                      <div className="batch-dropdown" ref={batchDropdownRef}>
                        <h4>Select Batch</h4>
                        {getAvailableBatches(showBatchDropdown).map(batch => (
                          <div
                            key={batch.batchNumber}
                            className="batch-option"
                            onClick={() => handleBatchSelect(batch)}
                          >
                            <div className="batch-info">
                              <strong>Batch: {batch.batchNumber}</strong>
                              <span>Qty: {batch.quantity}</span>
                            </div>
                            <div className="batch-details">
                              Expiry: {new Date(batch.expiryDate).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                        <button
                          className="cancel-batch-select"
                          onClick={() => setShowBatchDropdown(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedItems.length > 0 && (
                    <div>
                      <div className="items-table-container">
                        <table className="items-table">
                          <thead>
                            <tr>
                              <th width="5%">Sr No</th>
                              <th width="15%">Batch No</th>
                              <th width="20%">Product Name</th>
                              <th width="10%">Item Code</th>
                              <th width="8%">Qty</th>
                              <th width="12%">Price</th>
                              <th width="10%">Discount %</th>
                              <th width="15%">Total</th>
                              <th width="5%"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedItems.slice().reverse().map((item, index) => {
                              const availableQty = getAvailableQuantity(item.productId, item.batchNumber);
                              const actualIndex = selectedItems.length - index - 1;

                              return (
                                <tr key={`${item.productId}-${item.batchNumber}`}>
                                  <td>{selectedItems.length - index}</td>
                                  <td>
                                    <span className="batch-tag">{item.batchNumber}</span>
                                    <br />
                                    <small>Exp: {new Date(item.expiryDate).toLocaleDateString()}</small>
                                  </td>
                                  <td>
                                    {item.name}
                                    <br />
                                    <small className="category-tag">{item.category}</small>
                                  </td>
                                  <td>{item.hsn || "N/A"}</td>
                                  <td>
                                    <input
                                      type="number"
                                      min="1"
                                      max={availableQty}
                                      required
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const newQty = parseInt(e.target.value) || 0;
                                        if (newQty > availableQty) {
                                          toast.error(`Only ${availableQty} items available`);
                                          return;
                                        }
                                        handleItemUpdate(actualIndex, 'quantity', newQty);
                                      }}
                                    />
                                    <div className="available-qty">Available: {availableQty}</div>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={item.price || 0}
                                      onChange={(e) => handleItemUpdate(actualIndex, 'price', parseFloat(e.target.value) || 0)}
                                      style={{ width: "80px" }}
                                    />
                                  </td>
                                  <td>{item.discount || 0}%</td>
                                  <td>
                                    ₹{(
                                      (item.price || 0) * item.quantity -
                                      ((item.price || 0) * item.quantity * (item.discount || 0) / 100)
                                    ).toFixed(2)}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="invoice-remove-btn"
                                      onClick={() => {
                                        setSelectedItems(selectedItems.filter((_, i) => i !== actualIndex));
                                      }}
                                    >
                                      <FaTrash />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <div style={{ width: '350px', background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                          <h4 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Invoice Calculation</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Subtotal (Incl. Tax):</span>
                            <span>₹{invoiceTotals.subtotal.toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>Product Discount:</span>
                            <span>₹{invoiceTotals.discount.toFixed(2)}</span>
                          </div>

                          {appliedPromo && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#28a745' }}>
                              <span>Promo Discount ({appliedPromo.discount}%):</span>
                              <span>-₹{invoiceTotals.promoDiscount.toFixed(2)}</span>
                            </div>
                          )}

                          {useLoyaltyCoins && invoiceTotals.loyaltyCoinsUsed > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#ff6b35' }}>
                              <span>Loyalty Coins Used ({invoiceTotals.loyaltyCoinsUsed} coins):</span>
                              <span>-₹{invoiceTotals.loyaltyDiscount.toFixed(2)}</span>
                            </div>
                          )}

                          {!invoiceTotals.hasMixedTaxRates && invoiceTotals.taxPercentages.length > 0 && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>CGST ({invoiceTotals.taxPercentages[0] / 2}%):</span>
                                <span>₹{invoiceTotals.cgst.toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>SGST ({invoiceTotals.taxPercentages[0] / 2}%):</span>
                                <span>₹{invoiceTotals.sgst.toFixed(2)}</span>
                              </div>
                            </>
                          )}

                          {invoiceTotals.hasMixedTaxRates && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span>GST:</span>
                              <span>₹{invoiceTotals.tax.toFixed(2)}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                            <span>Total Tax:</span>
                            <span>₹{invoiceTotals.tax.toFixed(2)}</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '10px', fontWeight: 'bold' }}>
                            <span>Grand Total:</span>
                            <span>₹{invoiceTotals.grandTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <h3 className="section-heading">Customer Details</h3>
                  <div className="form-group-row" ref={customerSearchRef}>
                    <div className="field-wrapper">
                      <label>Mobile Number *</label>
                      <input
                        type="text"
                        placeholder="Search by mobile number"
                        value={customerMobileSearch}
                        onChange={(e) => {
                          setCustomerMobileSearch(e.target.value);
                          setNewCustomer({ ...newCustomer, mobile: e.target.value });
                          setShowCustomerDropdown(e.target.value.length > 0);
                        }}
                        onFocus={() => setShowCustomerDropdown(customerMobileSearch.length > 0)}
                      />
                      {isLoadingCustomers && (
                        <div className="search-dropdown">
                          <div className="dropdown-item">Loading customers...</div>
                        </div>
                      )}
                      {showCustomerDropdown && !isLoadingCustomers && filteredCustomers.length > 0 && (
                        <div className="search-dropdown">
                          {filteredCustomers.map(customer => (
                            <div
                              key={customer.id}
                              className="dropdown-item"
                              onClick={() => handleCustomerSelect(customer)}
                            >
                              <div>{customer.mobile} - {customer.name}</div>
                              <div>{customer.email}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group-row">
                    <div className="field-wrapper">
                      <label>Customer Name *</label>
                      <input
                        type="text"
                        placeholder="Enter customer name"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field-wrapper">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="Enter customer email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group-row">
                    <div className="field-wrapper">
                      <label>GST Number</label>
                      <input
                        type="text"
                        placeholder="Enter GST number (optional)"
                        value={newCustomer.gstNumber || ""}
                        onChange={(e) => setNewCustomer({
                          ...newCustomer,
                          gstNumber: e.target.value
                        })}
                      />
                    </div>
                  </div>

                  <div className="form-group-row">
                    <div className="field-wrapper">
                      <label>Address</label>
                      <textarea
                        placeholder="Enter customer address"
                        value={newCustomer.address || ""}
                        onChange={(e) => setNewCustomer({
                          ...newCustomer,
                          address: e.target.value
                        })}
                        rows="2"
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>
                  </div>

                  <h3 className="section-heading">Shipping Details</h3>

                  <div className="form-group-row">
                    <div className="field-wrapper" style={{ width: '100%' }}>
                      <label className="same-as-billing-checkbox">
                        <input
                          type="checkbox"
                          checked={sameAsBilling}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setSameAsBilling(isChecked);

                            if (isChecked) {
                              setShippingDetails({
                                name: newCustomer.name,
                                email: newCustomer.email || "",
                                mobile: newCustomer.mobile,
                                gstNumber: newCustomer.gstNumber || "",
                                addressLine1: newCustomer.address ? newCustomer.address.split('\n')[0] || "" : "",
                                addressLine2: newCustomer.address ? newCustomer.address.split('\n')[1] || "" : "",
                                landmark: "",
                                city: "",
                                state: "",
                                pincode: "",
                                country: "India"
                              });
                            } else {
                              if (customerAddresses.length > 0) {
                                const firstAddress = customerAddresses[0];
                                setShippingDetails({
                                  name: firstAddress.fullName || "",
                                  email: firstAddress.email || "",
                                  mobile: firstAddress.mobile || "",
                                  gstNumber: firstAddress.gstNumber || "",
                                  addressLine1: firstAddress.addressLine1 || "",
                                  addressLine2: firstAddress.addressLine2 || "",
                                  landmark: firstAddress.landmark || "",
                                  city: firstAddress.city || "",
                                  state: firstAddress.state || "",
                                  pincode: firstAddress.pincode || "",
                                  country: firstAddress.country || "India"
                                });
                              } else {
                                setShippingDetails({
                                  name: "",
                                  email: "",
                                  mobile: "",
                                  gstNumber: "",
                                  addressLine1: "",
                                  addressLine2: "",
                                  landmark: "",
                                  city: "",
                                  state: "",
                                  pincode: "",
                                  country: "India"
                                });
                              }
                            }
                          }}
                        />
                        <span>Same as Billing Details</span>
                      </label>
                    </div>
                  </div>

                  <div className="shipping-details-form">
                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Shipping Name {businessType === "b2b" ? "*" : ""}</label>
                        <input
                          type="text"
                          placeholder="Enter full name"
                          value={shippingDetails.name}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            name: e.target.value
                          })}
                          required={businessType === "b2b"}
                        />
                      </div>
                      <div className="field-wrapper">
                        <label>Shipping Mobile {businessType === "b2b" ? "*" : ""}</label>
                        <input
                          type="text"
                          placeholder="Enter 10-digit mobile"
                          value={shippingDetails.mobile}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            mobile: e.target.value
                          })}
                          required={businessType === "b2b"}
                        />
                      </div>
                    </div>

                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Shipping Email</label>
                        <input
                          type="email"
                          placeholder="Enter email"
                          value={shippingDetails.email}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            email: e.target.value
                          })}
                        />
                      </div>
                      <div className="field-wrapper">
                        <label>Shipping GST Number {businessType === "b2b" ? "*" : ""}</label>
                        <input
                          type="text"
                          placeholder={businessType === "b2b" ? "Enter GST (required for B2B)" : "Enter GST (optional)"}
                          value={shippingDetails.gstNumber}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            gstNumber: e.target.value
                          })}
                          required={businessType === "b2b"}
                        />
                      </div>
                    </div>

                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Address Line 1 *</label>
                        <input
                          type="text"
                          placeholder="House no, Building, Street"
                          value={shippingDetails.addressLine1}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            addressLine1: e.target.value
                          })}
                          required={businessType === "b2b"}
                        />
                      </div>
                      <div className="field-wrapper">
                        <label>Address Line 2</label>
                        <input
                          type="text"
                          placeholder="Area, Colony"
                          value={shippingDetails.addressLine2}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            addressLine2: e.target.value
                          })}
                        />
                      </div>
                    </div>

                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Landmark</label>
                        <input
                          type="text"
                          placeholder="Nearby landmark"
                          value={shippingDetails.landmark}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            landmark: e.target.value
                          })}
                        />
                      </div>
                      <div className="field-wrapper">
                        <label>City *</label>
                        <input
                          type="text"
                          placeholder="City"
                          value={shippingDetails.city}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            city: e.target.value
                          })}
                          required={businessType === "b2b"}
                        />
                      </div>
                    </div>

                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>State *</label>
                        <input
                          type="text"
                          placeholder="State"
                          value={shippingDetails.state}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            state: e.target.value
                          })}
                          required={businessType === "b2b"}
                        />
                      </div>
                      <div className="field-wrapper">
                        <label>Pincode *</label>
                        <input
                          type="text"
                          placeholder="6-digit pincode"
                          value={shippingDetails.pincode}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            pincode: e.target.value
                          })}
                          required={businessType === "b2b"}
                        />
                      </div>
                    </div>

                    <div className="form-group-row">
                      <div className="field-wrapper">
                        <label>Country *</label>
                        <input
                          type="text"
                          value={shippingDetails.country}
                          onChange={(e) => setShippingDetails({
                            ...shippingDetails,
                            country: e.target.value
                          })}
                          required={businessType === "b2b"}
                        />
                      </div>
                    </div>
                  </div>

                  {availableLoyaltyCoins > 0 && (
                    <>
                      <h3 className="section-heading">Loyalty Coins</h3>
                      <div className="form-group-row">
                        <div className="field-wrapper" style={{ width: '100%' }}>
                          <div className="loyalty-coins-container">
                            <div className="loyalty-info">
                              <span>Available Coins: {availableLoyaltyCoins}</span>
                              {usableLoyaltyCoins > 0 && (
                                <span className="usable-coins">Usable Coins: {usableLoyaltyCoins} (1 Coin = ₹1)</span>
                              )}
                            </div>

                            {usableLoyaltyCoins > 0 ? (
                              <label className="loyalty-checkbox">
                                <input
                                  type="checkbox"
                                  checked={useLoyaltyCoins}
                                  onChange={(e) => setUseLoyaltyCoins(e.target.checked)}
                                />
                                <span>Use Loyalty Coins (Maximum: {usableLoyaltyCoins} coins)</span>
                              </label>
                            ) : (
                              <div className="loyalty-message">
                                Minimum 50 coins required to use loyalty rewards. Need {50 - availableLoyaltyCoins} more coins.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <h3 className="section-heading">Promo Code (Optional)</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper" style={{ width: '100%' }}>
                      <div className="promo-code-container">
                        <div className="promo-dropdown-group">
                          <div className="dropdown-wrapper">
                            <select
                              value={promoCode}
                              onChange={(e) => {
                                const selectedCode = e.target.value;
                                setPromoCode(selectedCode);
                                if (selectedCode) {
                                  validatePromoCode(selectedCode);
                                } else {
                                  removePromoCode();
                                }
                              }}
                              disabled={isValidatingPromo || isLoadingPromos}
                              className={`${promoError ? 'error' : ''} ${isLoadingPromos ? 'dropdown-loading' : ''}`}
                            >
                              <option value="">Select a promo code</option>
                              {isLoadingPromos ? (
                                <option disabled>Loading promo codes...</option>
                              ) : (
                                activePromos.map(promo => (
                                  <option key={promo.promoId} value={promo.code}>
                                    {promo.code} - {promo.discount}% off
                                    {promo.description && ` - ${promo.description}`}
                                  </option>
                                ))
                              )}
                            </select>
                            <FaChevronDown className="dropdown-arrow" />
                          </div>
                          {appliedPromo && (
                            <button
                              type="button"
                              className="remove-promo-btn"
                              onClick={removePromoCode}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {isValidatingPromo && (
                          <div className="promo-loading">
                            <FaSpinner className="spinner" /> Validating...
                          </div>
                        )}
                        {promoError && <div className="promo-error">{promoError}</div>}
                        {appliedPromo && (
                          <div className="promo-success">
                            ✅ {appliedPromo.code} applied - {appliedPromo.discount}% discount
                            {appliedPromo.description && `: ${appliedPromo.description}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <h3 className="section-heading">Payment Type</h3>
                  <div className="payment-options-container">
                    <div className="payment-options">
                      <label className="payment-option">
                        <Field type="radio" name="paymentType" value="cash" />
                        <span className="payment-label">Cash</span>
                      </label>
                      <label className="payment-option">
                        <Field type="radio" name="paymentType" value="card" />
                        <span className="payment-label">Card</span>
                      </label>
                      <label className="payment-option">
                        <Field type="radio" name="paymentType" value="upi" />
                        <span className="payment-label">UPI</span>
                      </label>
                    </div>
                  </div>

                  <h3 className="section-heading">Remarks (Optional)</h3>
                  <div className="form-group-row">
                    <div className="field-wrapper" style={{ width: '100%' }}>
                      <textarea
                        placeholder="Enter any additional remarks or notes..."
                        value={newCustomer.remarks || ''}
                        onChange={(e) => setNewCustomer({ ...newCustomer, remarks: e.target.value })}
                        rows={3}
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>
                  </div>

                  <div className="submit-btn-container">
                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={isSubmitting || isExporting}
                    >
                      {isSubmitting ? (
                        <>
                          <FaSpinner className="spinner" /> Creating Invoice..
                        </>
                      ) : isExporting ? (
                        "Generating PDF..."
                      ) : (
                        "Create Invoice"
                      )}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        )}

        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th width="12%">Invoice No</th>
                <th width="10%">Date</th>
                <th width="20%">Customer</th>
                <th width="10%">Business Type</th>
                <th width="10%">Items</th>
                <th width="12%">Order Type</th>  {/* ← NEW COLUMN */}
                <th width="12%">Total</th>
                <th width="14%">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                    <div className="loading-spinner"></div>
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                    {searchTerm ? 'No invoices match your search' : getEmptyStateMessage()}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(invoice => {
                  const invoiceNumber = invoice.orderNumber;
                  const invoiceDate = invoice.date;
                  const businessType = invoice.businessType || 'b2c';

                  return (
                    <tr
                      key={invoiceNumber}
                      onClick={(e) => {
                        if (e.target.closest('.export-pdf-btn')) {
                          return;
                        }
                        setSelectedInvoice(invoice);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <strong>{invoiceNumber}</strong>
                      </td>
                      <td>
                        {invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }) : 'N/A'}
                      </td>
                      <td>
                        <div className="customer-cell">
                          <div className="customer-name">
                            {invoice.orderType === 'online'
                              ? (invoice.deliveryAddress?.fullName || invoice.customer?.name || 'Unknown')
                              : (invoice.customer?.name || 'Unknown')}
                          </div>
                          {(() => {
                            const mobile = invoice.orderType === 'online'
                              ? (invoice.deliveryAddress?.mobile || invoice.customer?.mobile)
                              : invoice.customer?.mobile;
                            return mobile && <div className="customer-mobile">{mobile}</div>;
                          })()}
                        </div>
                      </td>
                      <td>
                        <span className={`business-type-badge ${businessType}`}>
                          {businessType.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="items-count">
                          {invoice.items?.length || 0} items
                        </span>
                      </td>
                      <td>
                        <span className={`order-type-badge ${invoice.orderType}`}>
                          {invoice.orderType === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td>
                        <strong className="total-amount">
                          ₹{(invoice.total || 0).toFixed(2)}
                        </strong>
                      </td>
                      <td>
                        <button
                          className="export-pdf-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            generatePDF(invoice, false);
                          }}
                          disabled={isExporting}
                        >
                          {isExporting ? <FaSpinner className="spinner" /> : <FaFilePdf />}
                          {isExporting ? "Generating..." : "PDF"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedInvoice && (
          <InvoiceModal
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            onUpdate={handleUpdateInvoice}
            onDelete={handleDeleteInvoice}
            fetchInventory={fetchInventory}
          />
        )}

        {showBulkImport && (
          <BulkImportModal
            onClose={() => setShowBulkImport(false)}
            onImport={handleBulkImport}
            isLoading={isBulkImportLoading}
          />
        )}

        <div style={{ position: "absolute", left: "-9999px", top: 0, visibility: "hidden" }}>
          <div id="sales-pdf">
            {invoiceForPrint && <SalesPrint invoice={invoiceForPrint.invoice} />}
          </div>
        </div>
      </div>
    </Navbar>
  );
};

export default Sales;