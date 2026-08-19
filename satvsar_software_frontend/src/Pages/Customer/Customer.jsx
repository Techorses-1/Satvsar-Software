import React, { useState, useEffect, useMemo, useRef } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { toast, ToastContainer } from "react-toastify";
import {
  FaUser, FaEnvelope, FaPhone, FaPlus,
  FaFileExport, FaFileExcel, FaSearch,
  FaEdit, FaSave, FaTrash, FaMapMarkerAlt,
  FaUsers, FaShoppingCart, FaSyncAlt
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import Navbar from "../../Components/Sidebar/Navbar";
import "../Form/Form.scss";
import "./Customer.scss";
import "react-toastify/dist/ReactToastify.css";

const Customer = () => {
  const [showForm, setShowForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const [isLoading, setIsLoading] = useState(true);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isBulkImportLoading, setIsBulkImportLoading] = useState(false);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("offline"); // "offline" or "online"

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/user/get-customers`
        );
        const data = await response.json();

        // Sort by creation date (newest first)
        const sortedData = data.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date();
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date();
          return dateB - dateA;
        });

        setCustomers(sortedData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching customers:", err);
        toast.error("Failed to fetch customers");
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // Filter customers based on active tab
  const filteredByTab = useMemo(() => {
    if (activeTab === "offline") {
      // OFFLINE: Show billing customers (userType is "billing" or "both")
      return customers.filter(cust =>
        cust.userType === "billing" || cust.userType === "both" || !cust.userType
      );
    } else {
      // ONLINE: Show e-commerce customers (userType is "ecommerce" or "both")
      return customers.filter(cust =>
        cust.userType === "ecommerce" || cust.userType === "both"
      );
    }
  }, [customers, activeTab]);

  // Search filter
  const filteredCustomers = useMemo(() => {
    if (!debouncedSearch) return filteredByTab;

    return filteredByTab.filter((cust) => {
      return (
        cust.customerName?.toLowerCase().includes(debouncedSearch) ||
        cust.name?.toLowerCase().includes(debouncedSearch) ||
        cust.email?.toLowerCase().includes(debouncedSearch) ||
        cust.mobile?.toLowerCase().includes(debouncedSearch)
      );
    });
  }, [debouncedSearch, filteredByTab]);

  const paginatedCustomers = useMemo(() => {
    if (debouncedSearch) return filteredCustomers;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(0, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage, debouncedSearch]);

  const hasMoreCustomers = useMemo(() => {
    return debouncedSearch ? false : currentPage * itemsPerPage < filteredCustomers.length;
  }, [currentPage, itemsPerPage, filteredCustomers.length, debouncedSearch]);

  const loadMoreCustomers = () => {
    setCurrentPage(prev => prev + 1);
  };

  // Select customer
  const selectCustomer = (customerId) => {
    setSelectedCustomer((prev) => (prev === customerId ? null : customerId));
  };

  // Export PDF
  const exportAsPdf = () => {
    if (!selectedCustomer) {
      toast.warning("Please select a customer first");
      return;
    }

    const customer = customers.find((c) => c.customerId === selectedCustomer);

    const content = `
<div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #3f3f91; margin: 0; font-size: 28px; font-weight: bold;">Customer Details</h1>
    <div style="height: 3px; background: linear-gradient(90deg, #3f3f91, #6a6ac5); width: 100px; margin: 10px auto;"></div>
  </div>
  
  <div style="border: 2px solid #3f3f91; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
    <div style="background: #3f3f91; padding: 15px; color: white;">
      <h2 style="margin: 0; font-size: 22px;">${customer.customerName || customer.name || 'N/A'}</h2>
    </div>
    
    <div style="padding: 25px;">
      <div style="display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Contact Information</h3>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Email</div>
            <div>${customer.email || 'N/A'}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Mobile Number</div>
            <div>${customer.mobile || customer.contactNumber || 'N/A'}</div>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">GST Number</div>
            <div>${customer.gstNumber || 'N/A'}</div>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Address</div>
            <div style="white-space: pre-wrap;">${customer.address || 'N/A'}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Loyalty Coins</div>
            <div>${customer.loyaltyCoins || 0}</div>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">User Type</div>
            <div>${customer.userType === 'ecommerce' ? 'Online Customer' : customer.userType === 'billing' ? 'Offline Customer' : 'Both'}</div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Created Date</div>
            <div>${new Date(customer.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; margin-top: 20px; border: 1px dashed #ddd;">
        <div style="font-style: italic; color: #777;">Generated on ${new Date().toLocaleDateString()}</div>
      </div>
    </div>
  </div>
</div>`;

    const opt = {
      margin: 10,
      filename: `${customer.customerName || customer.name}_details.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(content).set(opt).save();
  };

  // Export Excel
  const exportAllAsExcel = () => {
    const dataToExport = filteredCustomers.length > 0 ? filteredCustomers : filteredByTab;

    if (dataToExport.length === 0) {
      toast.warning("No customers to export");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      dataToExport.map((customer) => ({
        Name: customer.customerName || customer.name,
        Email: customer.email,
        "Mobile Number": customer.mobile || customer.contactNumber,
        "GST Number": customer.gstNumber || 'N/A',
        "Address": customer.address || 'N/A',
        "Loyalty Coins": customer.loyaltyCoins || 0,
        "User Type": customer.userType === 'ecommerce' ? 'Online Customer' : customer.userType === 'billing' ? 'Offline Customer' : 'Both'
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

    const fileName = `${activeTab}_${debouncedSearch ? "filtered" : "all"}_customers.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Bulk Import
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

          const customersToImport = jsonData.map((row, index) => {
            const customerName = row['Customer Name'] || row['customerName'] || row['Name'] || row['name'] || '';
            const email = row['Email'] || row['email'] || '';
            const mobile = row['Mobile Number'] || row['contactNumber'] || row['Mobile'] || row['mobile'] || '';
            const address = row['Address'] || row['address'] || '';

            return {
              name: customerName.toString().trim(),
              email: email ? email.toString().trim() : '',
              mobile: mobile.toString().trim(),
              address: address ? address.toString().trim() : ''
            };
          }).filter(customer => customer.name && customer.mobile);

          if (customersToImport.length === 0) {
            toast.error("No valid customer data found in the file");
            setIsBulkImportLoading(false);
            return;
          }

          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/user/bulk-create-customers`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ customers: customersToImport }),
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "Failed to import customers");
          }

          toast.success(
            `Import completed: ${result.results.successful.length} successful, ${result.results.failed.length} failed`
          );

          if (result.results.successful.length > 0) {
            setCustomers(prev => [...result.results.successful, ...prev]);
          }

          setShowBulkImport(false);

        } catch (error) {
          console.error("Error processing file:", error);
          toast.error(error.message || "Error processing the file");
        }
        finally {
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
      toast.error("Failed to import customers");
      setIsBulkImportLoading(false);
    }
  };

  // Form initial values
  const initialValues = {
    name: "",
    email: "",
    mobile: "",
    gstNumber: "",
    address: "",
  };

  // Validation schema
  const validationSchema = Yup.object({
    name: Yup.string()
      .required("Customer Name is required")
      .matches(/^[a-zA-Z\s]*$/, "Customer Name cannot contain numbers"),
    email: Yup.string()
      .email("Invalid email"),
    mobile: Yup.string()
      .required("Mobile Number is required")
      .matches(/^[6-9]\d{9}$/, "Must be valid 10-digit Indian mobile number")
      .length(10, "Must be exactly 10 digits"),
    gstNumber: Yup.string()
      .matches(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GST number format"
      )
      .nullable()
      .transform((value) => (value === '' ? null : value)),
    address: Yup.string()
      .max(500, "Address is too long")
      .nullable()
      .transform((value) => (value === '' ? null : value)),
  });

  // Create Customer
  const handleSubmit = async (values, { resetForm, setFieldError }) => {
    try {
      setIsFormSubmitting(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/user/create-customer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.field === "email") {
          setFieldError("email", "Customer with this email already exists");
          toast.error("Customer with this email already exists");
        } else if (data.field === "mobile") {
          setFieldError("mobile", "Customer with this mobile number already exists");
          toast.error("Customer with this mobile number already exists");
        } else {
          throw new Error(data.message || "Failed to add customer");
        }
        return;
      }

      const savedCustomer = {
        customerId: data.customer.userId || data.customer.customerId,
        customerName: data.customer.name,
        name: data.customer.name,
        email: data.customer.email,
        mobile: data.customer.mobile,
        contactNumber: data.customer.mobile,
        gstNumber: data.customer.gstNumber,
        address: data.customer.address,
        loyaltyCoins: data.customer.loyaltyCoins || 0,
        userType: data.customer.userType || "billing",
        createdAt: data.customer.createdAt
      };

      setCustomers((prev) => [savedCustomer, ...prev]);
      toast.success("Customer added successfully!");
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error(error.message || "Error creating customer");
    }
    finally {
      setIsFormSubmitting(false);
    }
  };

  // Update Customer (OFFLINE only)
  const handleUpdateCustomer = async (updatedCustomer) => {
    try {
      const customerId = updatedCustomer.customerId;

      const dataToSend = {
        name: updatedCustomer.name || updatedCustomer.customerName,
        email: updatedCustomer.email || '',
        mobile: updatedCustomer.mobile || updatedCustomer.contactNumber || '',
        gstNumber: updatedCustomer.gstNumber || '',
        address: updatedCustomer.address || ''
      };

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/user/update-customer/${customerId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataToSend),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update customer");
      }

      const data = await response.json();

      const updatedCust = {
        ...updatedCustomer,
        customerId: data.customer?.customerId || data.customer?.userId || customerId,
        customerName: data.customer?.name || data.customer?.customerName,
        name: data.customer?.name || data.customer?.customerName,
        mobile: data.customer?.mobile || data.customer?.contactNumber,
        contactNumber: data.customer?.mobile || data.customer?.contactNumber,
        gstNumber: data.customer?.gstNumber,
        address: data.customer?.address,
        loyaltyCoins: data.customer?.loyaltyCoins || 0
      };

      setCustomers(prev =>
        prev.map(cust =>
          cust.customerId === customerId ? updatedCust : cust
        )
      );
      toast.success("Customer updated successfully!");

    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error(error.message || "Error updating customer");
    }
  };

  // Delete Customer (OFFLINE only)
  const handleDeleteCustomer = async (customerId) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/user/delete-customer/${customerId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete customer");
      }

      setCustomers(prev =>
        prev.filter(cust => cust.customerId !== customerId)
      );
      setSelectedCustomer(null);
      toast.success("Customer removed from billing system successfully!");
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error(error.message || "Error deleting customer");
    }
  };

  // Customer Modal Component
  const CustomerModal = ({ customer, onClose, onExport, onUpdate, onDelete, isReadOnly }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedCustomer, setEditedCustomer] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    useEffect(() => {
      if (customer) {
        setEditedCustomer({
          ...customer,
          name: customer.name || customer.customerName,
          mobile: customer.mobile || customer.contactNumber
        });
        setErrors({});
      }
    }, [customer]);

    const validateForm = (values) => {
      const newErrors = {};

      if (!values.name && !values.customerName) newErrors.name = "Customer Name is required";
      else if (values.name && !/^[a-zA-Z\s]*$/.test(values.name)) newErrors.name = "Customer Name cannot contain numbers";

      if (values.email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email))
        newErrors.email = "Invalid email address";

      if (!values.mobile && !values.contactNumber) newErrors.mobile = "Mobile Number is required";
      else if (values.mobile && !/^[6-9]\d{9}$/.test(values.mobile)) newErrors.mobile = "Must be valid 10-digit Indian number";

      if (values.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(values.gstNumber))
        newErrors.gstNumber = "Invalid GST number format";

      if (values.address && values.address.length > 500)
        newErrors.address = "Address is too long (max 500 characters)";

      return newErrors;
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setEditedCustomer(prev => ({ ...prev, [name]: value }));
      const fieldErrors = validateForm({ ...editedCustomer, [name]: value });
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }));
    };

    const handleSave = async () => {
      const formErrors = validateForm(editedCustomer);
      if (Object.keys(formErrors).length > 0) {
        setErrors(formErrors);
        toast.error("Please fix the errors before saving");
        return;
      }

      try {
        await onUpdate(editedCustomer);
        setIsEditing(false);
        setErrors({});
      } catch (error) {
        console.error("Error updating customer:", error);
      }
    };

    if (!customer) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              {isReadOnly ? "Customer Details (Read Only)" : (isEditing ? "Edit Customer" : `Customer Details: ${customer.customerName || customer.name}`)}
            </div>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>

          <div className="modal-body">
            <div className="wo-details-grid">
              <div className="detail-row">
                <span className="detail-label">Customer Name *</span>
                {!isReadOnly && isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="name"
                      value={editedCustomer.name || editedCustomer.customerName || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.name ? 'error' : ''}`}
                    />
                    {errors.name && <div className="error-message">{errors.name}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.customerName || customer.name}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Email</span>
                {!isReadOnly && isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="email"
                      name="email"
                      value={editedCustomer.email || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.email ? 'error' : ''}`}
                    />
                    {errors.email && <div className="error-message">{errors.email}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.email || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Mobile Number *</span>
                {!isReadOnly && isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="mobile"
                      value={editedCustomer.mobile || editedCustomer.contactNumber || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.mobile ? 'error' : ''}`}
                    />
                    {errors.mobile && <div className="error-message">{errors.mobile}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.mobile || customer.contactNumber || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">GST Number</span>
                {!isReadOnly && isEditing ? (
                  <div className="edit-field-container">
                    <input
                      type="text"
                      name="gstNumber"
                      value={editedCustomer.gstNumber || ''}
                      onChange={handleInputChange}
                      className={`edit-input ${errors.gstNumber ? 'error' : ''}`}
                      placeholder="Optional"
                    />
                    {errors.gstNumber && <div className="error-message">{errors.gstNumber}</div>}
                  </div>
                ) : (
                  <span className="detail-value">{customer.gstNumber || 'N/A'}</span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Address</span>
                {!isReadOnly && isEditing ? (
                  <div className="edit-field-container">
                    <textarea
                      name="address"
                      value={editedCustomer.address || ''}
                      onChange={handleInputChange}
                      className={`edit-textarea ${errors.address ? 'error' : ''}`}
                      rows="3"
                      placeholder="Optional"
                    />
                    {errors.address && <div className="error-message">{errors.address}</div>}
                  </div>
                ) : (
                  <span className="detail-value">
                    {customer.address ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{customer.address}</div>
                    ) : 'N/A'}
                  </span>
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Loyalty Coins</span>
                <span className="detail-value loyalty-coins">
                  {customer.loyaltyCoins || 0}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">User Type</span>
                <span className="detail-value">
                  {customer.userType === 'ecommerce' ? 'Online Customer' : customer.userType === 'billing' ? 'Offline Customer' : 'Both'}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Created At:</span>
                <span className="detail-value">
                  {new Date(customer.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="export-btn" onClick={onExport}>
              <FaFileExport /> Export as PDF
            </button>
            {!isReadOnly && (
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

        {showDeleteConfirm && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>Confirm Deletion</h3>
              <p>Are you sure you want to delete {customer.customerName || customer.name}? This action cannot be undone.</p>
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
                    onDelete(customer.customerId);
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

  // Bulk Import Modal
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
              {isLoading ? "Importing Customers..." : "Bulk Import Customers"}
            </div>
            {!isLoading && (
              <button className="modal-close" onClick={onClose}>&times;</button>
            )}
          </div>

          <div className="modal-body">
            {isLoading ? (
              <div className="import-loading">
                <div className="loading-spinner large"></div>
                <p>Importing customers, please wait...</p>
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
                    <li>Required columns: <strong>Customer Name</strong>, <strong>Mobile Number</strong></li>
                    <li>Optional columns: Email, Address</li>
                    <li>Maximum 1000 records per file</li>
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
                  <FaFileExcel /> Import Customers
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
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="main">
        <div className="page-header">
          {/* <h2>Customer Management</h2>  */}
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder={`Search ${activeTab === "offline" ? "Offline" : "Online"} Customers...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="action-buttons-group">
              {activeTab === "offline" && (
                <>
                  <button className="bulk-import-btn" onClick={() => setShowBulkImport(true)}>
                    <FaFileExcel /> Bulk Import
                  </button>
                  <button className="add-btn" onClick={() => setShowForm(!showForm)}>
                    <FaPlus /> {showForm ? "Close" : "Add Customer"}
                  </button>
                </>
              )}
              <button className="export-all-btn" onClick={exportAllAsExcel}>
                <FaFileExcel /> Export All
              </button>
            </div>
          </div>
        </div>

        {/* TABS - Underline Style, Left Aligned */}
        <div className="tabs-container">
          <div className="tabs">
            <button
              className={`tab ${activeTab === "offline" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("offline");
                setSearchTerm("");
                setSelectedCustomer(null);
                setShowForm(false);
              }}
            >
              <FaUsers /> Offline Customers
              <span className="tab-count">
                {customers.filter(c => c.userType === "billing" || c.userType === "both" || !c.userType).length}
              </span>
            </button>
            <button
              className={`tab ${activeTab === "online" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("online");
                setSearchTerm("");
                setSelectedCustomer(null);
                setShowForm(false);
              }}
            >
              <FaShoppingCart /> Online Customers
              <span className="tab-count">
                {customers.filter(c => c.userType === "ecommerce" || c.userType === "both").length}
              </span>
            </button>
          </div>
        </div>

        {/* Add Customer Form - Only for OFFLINE tab */}
        {activeTab === "offline" && showForm && (
          <div className="form-container premium">
            <h2>Add Offline Customer</h2>
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              <Form>
                <div className="form-row">
                  <div className="form-field">
                    <label><FaUser /> Customer Name *</label>
                    <Field name="name" type="text" />
                    <ErrorMessage name="name" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaPhone /> Mobile Number *</label>
                    <Field name="mobile" type="text" />
                    <ErrorMessage name="mobile" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>GST Number</label>
                    <Field name="gstNumber" type="text" placeholder="Optional" />
                    <ErrorMessage name="gstNumber" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaEnvelope /> Email</label>
                    <Field name="email" type="email" />
                    <ErrorMessage name="email" component="div" className="error" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label><FaMapMarkerAlt /> Address</label>
                    <Field
                      name="address"
                      as="textarea"
                      rows="3"
                      placeholder="Optional"
                    />
                    <ErrorMessage name="address" component="div" className="error" />
                  </div>
                </div>

                <button type="submit" disabled={isFormSubmitting}>
                  {isFormSubmitting ? (
                    <>
                      <div className="loading-spinner small"></div>
                      Adding...
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              </Form>
            </Formik>
          </div>
        )}

        {/* Customer Table */}
        <div className="data-table">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner large"></div>
              <p>Loading customers...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <p>No {activeTab === "offline" ? "offline" : "online"} customers found</p>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Mobile Number</th>
                    <th>GST Number</th>
                    <th>Address</th>
                    <th>Loyalty Coins</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((cust, index) => (
                    <tr
                      key={cust.customerId || index}
                      className={selectedCustomer === cust.customerId ? "selected" : ""}
                      onClick={() => selectCustomer(cust.customerId)}
                    >
                      <td>{cust.customerName || cust.name}</td>
                      <td>{cust.email || 'N/A'}</td>
                      <td>{cust.mobile || cust.contactNumber || 'N/A'}</td>
                      <td>{cust.gstNumber || 'N/A'}</td>
                      <td>{cust.address ? (cust.address.length > 30 ? cust.address.substring(0, 30) + '...' : cust.address) : 'N/A'}</td>
                      <td className="loyalty-coins-cell">{cust.loyaltyCoins || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMoreCustomers && (
                <div className="load-more-container">
                  <button className="load-more-btn" onClick={loadMoreCustomers}>
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Customer Modal - Read-only for ONLINE tab */}
        {selectedCustomer && (
          <CustomerModal
            customer={customers.find(c => c.customerId === selectedCustomer)}
            onClose={() => setSelectedCustomer(null)}
            onExport={exportAsPdf}
            onUpdate={handleUpdateCustomer}
            onDelete={handleDeleteCustomer}
            isReadOnly={activeTab === "online"}
          />
        )}

        {/* Bulk Import Modal */}
        {showBulkImport && (
          <BulkImportModal
            onClose={() => setShowBulkImport(false)}
            onImport={handleBulkImport}
            isLoading={isBulkImportLoading}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Customer;