import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import Navbar from "../../Components/Sidebar/Navbar";
import {
  FaCubes,
  FaSearch,
  FaEye,
  FaFileExport,
  FaFileExcel,
  FaRupeeSign,
  FaCube,
  FaImage
} from "react-icons/fa";
import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";
import "../Form/Form.scss";
import "./Items.scss";
import "react-toastify/dist/ReactToastify.css";

const Items = () => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/admin/categories`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        setCategories(response.data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch products from E-commerce backend
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/products/all`
        );
        
        // Transform e-commerce products to simple format
        const transformedProducts = response.data.map(product => {
          // Get price from first color (White)
          const price = product.colors && product.colors.length > 0 
            ? (product.colors[0].currentPrice || product.colors[0].originalPrice || 0)
            : 0;
            
          return {
            productId: product.productId,
            productName: product.productName,
            category: product.categoryName || "Uncategorized",
            hsnCode: product.hsnCode || "N/A",
            // Only simple products now
            modelName: product.modelName || product.productName, // Auto-filled with product name
            SKU: product.SKU || "N/A",
            thumbnailImage: product.thumbnailImage,
            price: price,
            isActive: product.isActive,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            description: product.description || "",
            // Additional details
            specifications: product.specifications || [],
            productImages: product.colors && product.colors.length > 0 
              ? (product.colors[0].images || []) 
              : []
          };
        });

        const sortedData = transformedProducts.sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        setItems(sortedData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching products:", err);
        toast.error("Failed to load products from inventory.");
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Filter items by productName, category, etc.
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    return items.filter((item) =>
      item.productName?.toLowerCase().includes(debouncedSearch) ||
      item.category?.toLowerCase().includes(debouncedSearch) ||
      item.hsnCode?.toLowerCase().includes(debouncedSearch) ||
      item.productId?.toLowerCase().includes(debouncedSearch) ||
      item.SKU?.toLowerCase().includes(debouncedSearch)
    );
  }, [debouncedSearch, items]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    if (debouncedSearch) return filteredItems;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(0, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage, debouncedSearch]);

  // Check if there are more items to load
  const hasMoreItems = useMemo(() => {
    return debouncedSearch ? false : currentPage * itemsPerPage < filteredItems.length;
  }, [currentPage, itemsPerPage, filteredItems.length, debouncedSearch]);

  // Load more items
  const loadMoreItems = () => {
    setCurrentPage(prev => prev + 1);
  };

  // Handle item selection
  const selectItem = (productId) => {
    setSelectedItem(prev => prev === productId ? null : productId);
  };

  // Export selected product as PDF
  const exportSelectedAsPDF = () => {
    if (!selectedItem) {
      toast.warning("Please select a product to export");
      return;
    }

    const item = items.find(i => i.productId === selectedItem);
    
    // Get category name
    const categoryName = categories.find(cat => 
      cat.name?.toLowerCase() === item.category?.toLowerCase()
    )?.name || item.category;

    const content = `
    <div style="font-family: 'Arial', sans-serif; padding: 30px; background: #fff; max-width: 800px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #3f3f91; margin: 0; font-size: 28px; font-weight: bold;">Product Details</h1>
        <div style="height: 3px; background: linear-gradient(90deg, #3f3f91, #6a6ac5); width: 100px; margin: 10px auto;"></div>
      </div>
      
      <div style="border: 2px solid #3f3f91; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
        <div style="background: #3f3f91; padding: 15px; color: white;">
          <h2 style="margin: 0; font-size: 22px;">${item.productName || 'N/A'}</h2>
        </div>
        
        <div style="padding: 25px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <!-- Basic Information -->
            <div>
              <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Basic Information</h3>
              
              <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Product ID</div>
                <div>${item.productId || 'N/A'}</div>
              </div>
              
              <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Category</div>
                <div>${categoryName || 'N/A'}</div>
              </div>
              
              <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #555; margin-bottom: 4px;">HSN Code</div>
                <div>${item.hsnCode || 'N/A'}</div>
              </div>
              
              <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #555; margin-bottom: 4px;">SKU</div>
                <div>${item.SKU || 'N/A'}</div>
              </div>
            </div>
            
            <!-- Pricing Information -->
            <div>
              <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Pricing Information</h3>
              
              <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Price</div>
                <div>₹${item.price?.toFixed(2) || '0.00'}</div>
              </div>
              
              <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Status</div>
                <div>${item.isActive ? 'Active' : 'Inactive'}</div>
              </div>
              
              <div style="margin-bottom: 12px;">
                <div style="font-weight: bold; color: #555; margin-bottom: 4px;">Model Name</div>
                <div>${item.modelName || item.productName || 'N/A'}</div>
              </div>
            </div>
          </div>
          
          <!-- Product Description -->
          ${item.description ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Description</h3>
            <div style="line-height: 1.6; color: #555;">${item.description}</div>
          </div>
          ` : ''}
          
          <!-- Specifications -->
          ${item.specifications && item.specifications.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #3f3f91; margin: 0 0 15px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Specifications</h3>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
              <table style="width: 100%; border-collapse: collapse;">
                ${item.specifications.map(spec => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; font-weight: bold; color: #555; width: 40%;">${spec.key || ''}</td>
                  <td style="padding: 8px 0; color: #333;">${spec.value || ''}</td>
                </tr>
                `).join('')}
              </table>
            </div>
          </div>
          ` : ''}
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px dashed #ddd;">
            <div style="font-style: italic; color: #777;">
              Generated from Inventory System on ${new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>`;

    const opt = {
      margin: 10,
      filename: `${item.productName}_details.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(content).set(opt).save();
  };

  // Export all products as Excel
  const exportAllAsExcel = () => {
    const dataToExport = filteredItems.length > 0 ? filteredItems : items;

    if (dataToExport.length === 0) {
      toast.warning("No products to export");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      dataToExport.map(item => ({
        "Product Name": item.productName,
        "Category": item.category,
        "HSN Code": item.hsnCode,
        "SKU": item.SKU,
        "Model Name": item.modelName,
        "Price": `₹${item.price?.toFixed(2) || '0.00'}`,
        "Status": item.isActive ? 'Active' : 'Inactive',
        "Created Date": new Date(item.createdAt).toLocaleDateString()
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

    const fileName = debouncedSearch ? "filtered_products.xlsx" : "all_products.xlsx";
    XLSX.writeFile(workbook, fileName);
  };

  // Product Modal Component
  const ProductModal = ({ product, onClose, onExport }) => {
    useEffect(() => {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }, []);

    if (!product) return null;

    const getCategoryName = () => {
      const category = categories.find(cat => 
        cat.name?.toLowerCase() === product.category?.toLowerCase()
      );
      return category?.name || product.category || 'Uncategorized';
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content product-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">
              <FaCube style={{ marginRight: '10px' }} />
              Product Details: {product.productName}
            </div>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            <div className="product-details-grid">
              {/* Thumbnail Image */}
              {product.thumbnailImage && (
                <div className="detail-row full-width">
                  <span className="detail-label">Product Image</span>
                  <div className="thumbnail-container">
                    <img 
                      src={product.thumbnailImage} 
                      alt={product.productName}
                      className="product-thumbnail"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="detail-row">
                <span className="detail-label">Product ID</span>
                <span className="detail-value">{product.productId}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Category</span>
                <span className="detail-value">{getCategoryName()}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">HSN Code</span>
                <span className="detail-value">{product.hsnCode}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">SKU</span>
                <span className="detail-value">{product.SKU}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Model Name</span>
                <span className="detail-value">{product.modelName}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className={`detail-value status-badge ${product.isActive ? 'active' : 'inactive'}`}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Price</span>
                <span className="detail-value price">
                  <FaRupeeSign style={{ fontSize: '14px', marginRight: '4px' }} />
                  {product.price?.toFixed(2) || '0.00'}
                </span>
              </div>

              {/* Product Images */}
              {product.productImages && product.productImages.length > 0 && (
                <div className="detail-row full-width">
                  <span className="detail-label">Product Images ({product.productImages.length})</span>
                  <div className="images-grid">
                    {product.productImages.map((img, index) => (
                      <div key={index} className="image-item">
                        <img 
                          src={img} 
                          alt={`${product.productName} ${index + 1}`}
                          className="product-image-thumb"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/100x100?text=Image';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {product.description && (
                <div className="detail-row full-width">
                  <span className="detail-label">Description</span>
                  <span className="detail-value description">
                    {product.description}
                  </span>
                </div>
              )}

              {/* Specifications */}
              {product.specifications && product.specifications.length > 0 && (
                <div className="detail-row full-width">
                  <span className="detail-label">Specifications</span>
                  <div className="specifications-list">
                    <table className="specs-table">
                      <tbody>
                        {product.specifications.map((spec, index) => (
                          <tr key={index}>
                            <td className="spec-key">{spec.key}</td>
                            <td className="spec-value">{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="detail-row full-width">
                <span className="detail-label">Created Date</span>
                <span className="detail-value">
                  {new Date(product.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button className="export-btn" onClick={onExport}>
              <FaFileExport /> Export as PDF
            </button>
            <button className="close-btn" onClick={onClose}>
              Close
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
          <h2>Products ({items.length})</h2>
          <div className="right-section">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search Products by Name, Category, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="action-buttons-group">
              <button className="export-all-btn" onClick={exportAllAsExcel}>
                <FaFileExcel /> Export All
              </button>
            </div>
          </div>
        </div>

        <div className="data-table">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner large"></div>
              <p>Loading products from inventory...</p>
            </div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>HSN Code</th>
                    <th>SKU</th>
                    <th>Model Name</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>View</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, index) => (
                    <tr
                      key={item.productId || index}
                      className={selectedItem === item.productId ? 'selected' : ''}
                    >
                      <td className="product-image">
                        {item.thumbnailImage ? (
                          <div className="thumbnail-preview">
                            <img 
                              src={item.thumbnailImage} 
                              alt={item.productName}
                              className="table-thumbnail"
                              onError={(e) => {
                                e.target.src = 'https://via.placeholder.com/40x40?text=No+Img';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="no-image">
                            <FaImage size={16} />
                          </div>
                        )}
                      </td>
                      <td className="product-name">{item.productName}</td>
                      <td className="product-category">{item.category}</td>
                      <td className="product-hsn">{item.hsnCode}</td>
                      <td className="product-sku">{item.SKU}</td>
                      <td className="product-model">{item.modelName}</td>
                      <td className="product-price">
                        <FaRupeeSign style={{ fontSize: '12px', marginRight: '4px' }} />
                        {item.price?.toFixed(2) || '0.00'}
                      </td>
                      <td className="product-status">
                        <span className={`status-badge ${item.isActive ? 'active' : 'inactive'}`}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="product-action">
                        <button 
                          className="view-btn"
                          onClick={() => selectItem(item.productId)}
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasMoreItems && (
                <div className="load-more-container">
                  <button className="load-more-btn" onClick={loadMoreItems}>
                    Load More Products
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {selectedItem && (
          <ProductModal
            product={items.find(i => i.productId === selectedItem)}
            onClose={() => setSelectedItem(null)}
            onExport={exportSelectedAsPDF}
          />
        )}
      </div>
    </Navbar>
  );
};

export default Items;