import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../utils/currency';
import { generateBarcode, printBarcode, saveBarcodeToProduct } from '../utils/barcode';
import { apiOperations } from '../utils/api';
import Lottie from "lottie-react";
import { gamingLoaderAnimation } from "../assets/animations";
import {
  Search, Edit3, Trash2, Package, DollarSign, AlertTriangle,
  X, Filter, Grid, List, Eye, Tag, Box, Barcode, Image, Gamepad2, Printer,
  Sparkles, Car, Info, Settings
} from "lucide-react";
import apiConfig from '../utils/apiConfig';

// Helper function to construct proper image URLs
// Now handles both local paths and external URLs
const getImageUrl = (product) => {
  // Check if product is valid
  if (!product || typeof product !== 'object') {
    return null;
  }
  
  // Priority: local path > image URL > null
  if (product.image_local_path && typeof product.image_local_path === 'string') {
    // Local image - construct full URL
    const baseUrl = apiConfig.getBaseUrl();
    if (typeof baseUrl !== 'string' || !baseUrl) {
      console.error('Invalid base URL configured:', baseUrl);
      // Fallback to external URL if base URL is invalid
      return product.image_url && typeof product.image_url === 'string' ? product.image_url : null;
    }
    // Ensure path starts with / for proper URL construction
    const pathWithSlash = product.image_local_path.startsWith('/') ? product.image_local_path : `/${product.image_local_path}`;
    // Simply concatenate baseUrl with path - don't use URL constructor which can mangle the path
    const fullUrl = `${baseUrl}${pathWithSlash}`;
    console.log(`Constructed image URL: ${fullUrl} from base: ${baseUrl} and path: ${pathWithSlash}`);
    return fullUrl;
  } else if (product.image_url && typeof product.image_url === 'string') {
    // External URL - use directly (including Facebook, Instagram, etc.)
    return product.image_url;
  }
  return null;
};

// Algorithm to select the best image from search results
const selectBestImage = (images, productName = '') => {
  if (!images || images.length === 0) return null;
  
  // Score each image based on quality indicators
  const scoredImages = images.map(image => {
    let score = 0;
    const url = image.url || '';
    const title = (image.title || '').toLowerCase();
    const source = (image.source || '').toLowerCase();
    
    // Prefer high-quality image hosts
    if (url.includes('amazon')) score += 50;
    if (url.includes('ebay')) score += 40;
    if (url.includes('bestbuy')) score += 40;
    if (url.includes('walmart')) score += 35;
    if (url.includes('target')) score += 35;
    if (url.includes('gamestop')) score += 45;
    if (url.includes('playstation') || url.includes('xbox') || url.includes('nintendo')) score += 40;
    
    // Avoid low-quality sources
    if (url.includes('aliexpress') || url.includes('wish')) score -= 20;
    if (url.includes('pinterest')) score -= 15;
    if (url.includes('facebook') || url.includes('instagram')) score -= 10;
    
    // Prefer images with relevant keywords in title
    const productWords = productName.toLowerCase().split(' ');
    productWords.forEach(word => {
      if (word.length > 2 && title.includes(word)) {
        score += 15;
      }
    });
    
    // Prefer gaming-related keywords
    const gamingKeywords = ['gaming', 'game', 'controller', 'console', 'playstation', 'xbox', 'nintendo', 'pc'];
    gamingKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 10;
    });
    
    // Prefer product images over lifestyle/scene images
    if (title.includes('product') || title.includes('official')) score += 20;
    if (title.includes('lifestyle') || title.includes('scene') || title.includes('setup')) score -= 10;
    
    // Prefer HTTPS and common image formats
    if (url.startsWith('https://')) score += 10;
    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) score += 15;
    
    // Penalize very long URLs (often complex/generated)
    if (url.length > 200) score -= 10;
    
    // Prefer images with dimensions info (usually higher quality)
    if (image.width && image.height) {
      const area = image.width * image.height;
      if (area > 400000) score += 20; // > 800x500
      else if (area > 250000) score += 15; // > 500x500
      else if (area > 100000) score += 10; // > 316x316
      else if (area < 10000) score -= 20; // < 100x100 (too small)
    }
    
    // Prefer square or landscape orientations for products
    if (image.width && image.height) {
      const ratio = image.width / image.height;
      if (ratio >= 0.8 && ratio <= 1.5) score += 10; // Good product ratios
    }
    
    return { ...image, score };
  });
  
  // Sort by score (highest first) and return the best one
  const bestImages = scoredImages.sort((a, b) => b.score - a.score);
  
  console.log('Image scoring results:');
  bestImages.slice(0, 5).forEach((img, idx) => {
    console.log(`${idx + 1}. Score: ${img.score}, Source: ${img.source}, URL: ${img.url.substring(0, 80)}...`);
  });
  
  return bestImages[0];
};

// Enhanced fetch with timeout and error handling
const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw error;
  }
};

// DetailModalImage component - JUST DISPLAY THE IMAGE URL!
function DetailModalImage({ product }) {
  const { t } = useTranslation();
  const imageUrl = getImageUrl(product);
  
  if (!imageUrl) {
    return (
      <div className="rounded-lg bg-gaming-black/50 h-64 flex items-center justify-center">
        <div className="text-center">
          <Image className="text-gaming-purple mx-auto mb-2" size={48} />
          <p className="text-gaming-purple">{t('imageViewer.noImageAvailable')}</p>
        </div>
      </div>
    );
  }

  // Just display the image - no fancy error handling
  return (
    <div className="rounded-lg overflow-hidden bg-gaming-black/50">
      <img
        src={imageUrl}
        alt={product.name}
        className="w-full h-64 object-cover"
        onLoad={() => console.log(`✅ Detail image displayed: ${imageUrl}`)}
        onError={() => console.log(`⚠️ Detail image error (may still be visible): ${imageUrl}`)}
      />
    </div>
  );
}

// SearchResultImage component - BEAUTIFUL HOVER PREVIEW WITH BLOCKED INDICATORS!
function SearchResultImage({ image }) {
  const { t } = useTranslation();
  const imageUrl = image.thumbnail || image.url;
  const [useMainUrl, setUseMainUrl] = useState(false);
  const [showHoverPreview, setShowHoverPreview] = useState(false);
  const isBlocked = image.blocked;

  // Simple: try thumbnail first, then main URL if different
  const displayUrl = useMainUrl && image.url !== image.thumbnail ? image.url : imageUrl;
  const hoverUrl = image.url; // Always show full resolution on hover

  return (
    <div className="w-full h-32 relative group">
      {/* Main Image */}
      <img
        src={displayUrl}
        alt={image.title || "Product image"}
        className={`w-full h-32 object-cover transition-all duration-300 ${
          isBlocked 
            ? 'opacity-70 grayscale-50' 
            : 'group-hover:opacity-90 group-hover:scale-105'
        }`}
        onLoad={() => {
          console.log(`✅ Search image displayed: ${displayUrl} ${isBlocked ? '(blocked)' : '(downloadable)'}`);
        }}
        onError={() => {
          console.log(`⚠️ Search image error: ${displayUrl}`);
          // If thumbnail failed and we have a different main URL, try it
          if (!useMainUrl && image.thumbnail && image.url !== image.thumbnail) {
            console.log(`🔄 Trying main URL: ${image.url}`);
            setUseMainUrl(true);
          }
        }}
        onMouseEnter={() => setShowHoverPreview(true)}
        onMouseLeave={() => setShowHoverPreview(false)}
      />
      
      {/* Beautiful Hover Preview - Full Size Image */}
      {showHoverPreview && !isBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
             style={{ pointerEvents: 'none' }}>
          <div className="relative max-w-2xl max-h-[80vh] bg-white rounded-lg shadow-2xl overflow-hidden">
            <img
              src={hoverUrl}
              alt={image.title || t('imageViewer.productImagePreview')}
              className="w-full h-full object-contain"
              style={{ maxHeight: '70vh' }}
            />
            {/* Image details overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
              <p className="text-white font-semibold truncate">{image.title || 'Product Image'}</p>
              <p className="text-white/80 text-sm">
                {image.width && image.height ? `${image.width} × ${image.height}px` : t('imageViewer.fullResolution')}
              </p>
              <p className="text-white/60 text-xs truncate">
                {t('imageViewer.source')} {image.source || new URL(image.url).hostname}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Red X overlay for blocked sources */}
      {isBlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <div className="bg-red-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl shadow-lg">
            ✕
          </div>
        </div>
      )}
      
      {/* Blocked indicator at bottom */}
      {isBlocked && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-600/90 text-white text-xs px-2 py-1 text-center">
          {t('imageViewer.cannotDownload')}
        </div>
      )}
      
      {/* Quality indicator for downloadable images */}
      {!isBlocked && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-green-600/90 text-white text-xs px-2 py-1 rounded-full">
            ✓ {t('imageViewer.downloadable')}
          </div>
        </div>
      )}
      
      {/* Hover hint */}
      {!isBlocked && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
          <div className="text-white text-sm font-medium bg-black/60 px-3 py-1 rounded-full">
            {t('imageViewer.hoverToPreview')}
          </div>
        </div>
      )}
    </div>
  );
}

// ProductImage component - JUST DISPLAY THE URL LIKE A WEBSITE!
function ProductImage({ product }) {
  const imageUrl = getImageUrl(product);

  if (!imageUrl) {
    return null;
  }

  // Just display the image URL directly - NO PROXY, NO DOWNLOAD, JUST SHOW IT!
  // Exactly like the image selection modal does
  return (
    <div className="mb-3 rounded-lg overflow-hidden bg-gaming-black/50 h-32 flex items-center justify-center">
      <img 
        src={imageUrl}
        alt={product.name}
        className="h-full w-full object-cover cursor-pointer rounded"
        onClick={() => window.open(imageUrl, '_blank')}
        onLoad={() => {
          console.log(`✅ Image displayed: ${imageUrl}`);
        }}
        onError={() => {
          // Don't do anything fancy - just log it
          // The browser will still try to display it
          console.log(`⚠️ Image error (may still be visible): ${imageUrl}`);
        }}
      />
    </div>
  );
}

export default function ViewProductPage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [viewMode, setViewMode] = useState("grid");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, productId: null, productName: "", isDeleting: false });
  const [editModal, setEditModal] = useState({ isOpen: false, product: null, isUpdating: false });
  const [detailModal, setDetailModal] = useState({ isOpen: false, product: null });
  const [imageModal, setImageModal] = useState({ isOpen: false, images: [], selectedImage: null, productId: null, isSearching: false });
  const [barcodeGenerating, setBarcodeGenerating] = useState(new Set());
  const [partAnalysisModal, setPartAnalysisModal] = useState({ isOpen: false, product: null, analyzing: false, analysis: null, error: null });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithTimeout(`${apiConfig.getBaseUrl()}/products`);
      const data = await res.json();
      console.log('Products data:', data);
      setProducts(data.products || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError(t('errors.loadFailed', { error: err.message }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    
    // REMOVED: Auto-refresh polling for images
    // Products will update when navigating between pages instead
    
    // Also do a full refresh every 90 seconds as fallback (optimized for performance)
    const refreshInterval = setInterval(() => {
      fetchProducts();
    }, 90000); // Refresh every 90 seconds (reduced from 30s - saves 66% database queries)
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  const formatPriceLocal = (p) => (p == null ? t('common.dash') : formatPrice(Number(p)));
  
  const getStockClass = (q, min) => {
    if (q === 0) return { txt: t('viewProducts.outOfStock'), cls: "text-red-400 bg-red-900/30 border-red-500/50" };
    if (q <= (min || 5)) return { txt: t('viewProducts.lowStock'), cls: "text-yellow-400 bg-yellow-900/30 border-yellow-500/50" };
    return { txt: t('viewProducts.inStock'), cls: "text-green-400 bg-green-900/30 border-green-500/50" };
  };

  const categories = [...new Set(products.map(p => p.category_name).filter(Boolean))];

  const filtered = products
    .filter((p) => {
      const matchesSearch = ["name", "barcode", "vendor_name", "category_name"].some((k) =>
        String(p[k] || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesCategory = selectedCategory === "all" || p.category_name === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      const res = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortOrder === "asc" ? res : -res;
    });

  const handleSort = (key) => {
    if (sortBy === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else setSortBy(key);
  };

  const openDelete = (p) => {
    console.log('Opening delete modal for product:', p);
    setDeleteModal({ isOpen: true, productId: p.id, productName: p.name, isDeleting: false });
  };
  
  const closeDelete = () => setDeleteModal({ ...deleteModal, isOpen: false });
  
  const confirmDelete = async () => {
    console.log('Confirming delete for product ID:', deleteModal.productId);
    
    if (!deleteModal.productId) {
      console.error('No product ID provided for deletion');
      alert(t('errors.noProductSelected'));
      return;
    }
    
    setDeleteModal(prev => ({ ...prev, isDeleting: true }));
    try {
      const deleteUrl = `${apiConfig.getBaseUrl()}/products/${deleteModal.productId}`;
      console.log('DELETE URL:', deleteUrl);
      
      const res = await fetchWithTimeout(deleteUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hardDelete: true, reason: "User deletion from inventory" }),
      }, 15000); // 15 second timeout for delete operations
      
      const result = await res.json();
      console.log('Delete response:', result);
      
      if (result.success) {
        // Remove product from state
        setProducts((prev) => prev.filter((p) => p.id !== deleteModal.productId));
        // Close modal and clear error
        closeDelete();
        setError(null);
        console.log('Product deleted successfully');
      } else {
        throw new Error(result.error || 'Delete operation failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      const errorMessage = error.message || 'Failed to delete product';
      alert(t('errors.deleteFailed', { error: errorMessage }));
      setError(errorMessage);
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const openEditModal = (product) => {
    console.log('Opening edit modal for product:', product);
    setEditModal({ isOpen: true, product: { ...product }, isUpdating: false });
  };

  const closeEditModal = () => {
    setEditModal({ isOpen: false, product: null, isUpdating: false });
  };

  const handleEditSubmit = async () => {
    console.log('Submitting edit for product:', editModal.product);
    setEditModal(prev => ({ ...prev, isUpdating: true }));
    try {
      const editUrl = `${apiConfig.getBaseUrl()}/products/${editModal.product.id}`;
      console.log('PUT URL:', editUrl);
      
      // Map frontend fields to backend expected fields
      const payload = {
        name: editModal.product.name,
        barcode: editModal.product.barcode,
        price: editModal.product.price,
        quantity: editModal.product.quantity,
        vendor: editModal.product.vendor_name, // Map vendor_name to vendor
        category: editModal.product.category_name, // Map category_name to category
        description: editModal.product.description,
        costPrice: editModal.product.cost_price, // Map cost_price to costPrice
        minStockLevel: editModal.product.min_stock_level, // Map min_stock_level to minStockLevel
        maxStockLevel: editModal.product.max_stock_level,
        markupPercentage: editModal.product.markup_percentage
      };
      
      console.log('Edit payload:', payload);
      
      const res = await fetchWithTimeout(editUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const updated = await res.json();
      console.log('Edit response:', updated);
      
      if (updated.success) {
        setProducts(prev => prev.map(p => p.id === updated.product.id ? updated.product : p));
        closeEditModal();
        setError(null); // Clear any previous errors
      } else {
        throw new Error(updated.error || 'Update failed');
      }
    } catch (error) {
      console.error('Update error:', error);
      alert(t('errors.updateFailed', { error: error.message }));
      setError(t('errors.updateFailed', { error: error.message }));
      setEditModal(prev => ({ ...prev, isUpdating: false }));
    }
  };

  const openDetailModal = (product) => {
    setDetailModal({ isOpen: true, product });
  };

  const closeDetailModal = () => {
    setDetailModal({ isOpen: false, product: null });
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('common.dash');
    // Keep dates in English format, not localized
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const searchProductImages = async (productName, productId) => {
    setImageModal(prev => ({ ...prev, isSearching: true }));
    
    try {
      // Check if we already have cached images for this product
      const cacheKey = `product-images-${productId}`;
      const cachedImages = localStorage.getItem(cacheKey);
      
      if (cachedImages) {
        const images = JSON.parse(cachedImages);
        console.log('Using cached images for product:', productId);
        setImageModal(prev => ({ 
          ...prev, 
          images, 
          productId, 
          isSearching: false,
          isOpen: true,
          currentImageIndex: 0 
        }));
        return;
      }
      
      // Make ONE SERP API search for this product - get maximum images
      console.log('Searching images for:', productName);
      const res = await fetchWithTimeout(`${apiConfig.getBaseUrl()}/products/search-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, numResults: 50 }), // Get maximum images
      });
      const data = await res.json();
      
      if (data.success && data.images && data.images.length > 0) {
        console.log(`Found ${data.images.length} images for ${productName}`);
        
        // Store all image URLs in cache for future use
        localStorage.setItem(cacheKey, JSON.stringify(data.images));
        
        // Select the best image automatically
        const bestImage = selectBestImage(data.images, productName);
        console.log(`Best image selected:`, bestImage);
        
        // Show first 20 images in the modal for user choice
        const displayImages = data.images.slice(0, 20);
        setImageModal(prev => ({ 
          ...prev, 
          images: displayImages, 
          productId, 
          isSearching: false,
          isOpen: true,
          currentImageIndex: 0,
          bestImageUrl: bestImage?.url
        }));
        
        // Show the best image as recommended, but don't auto-select it
        // User must manually click to choose their preferred image
      } else {
        throw new Error(data.error || 'No images found');
      }
    } catch (error) {
      console.error("Error searching images:", error);
      setError(t('errors.imageSearchFailed', { error: error.message }));
      setImageModal(prev => ({ ...prev, isSearching: false }));
    }
  };

  // Simple function to select and use an image URL
  const selectProductImage = async (imageUrl, productId) => {
    try {
      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Invalid image URL');
      }
      
      console.log('Selecting image for product:', productId, 'URL:', imageUrl);
      
      // Try to download the image to local storage (optional)
      let localPath = null;
      try {
        const baseUrl = apiConfig.getBaseUrl();
        if (baseUrl && typeof baseUrl === 'string') {
          const res = await fetchWithTimeout(`${baseUrl}/products/download-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl, productId }),
          }, 3000); // 3 second timeout for download attempt
          
          const data = await res.json();
          if (data.success && data.localPath) {
            localPath = data.localPath;
            console.log('Image downloaded locally:', localPath);
          }
        }
      } catch (downloadError) {
        // If download fails, we'll just use the URL directly - this is OK
        console.log('Using image URL directly (download optional):', downloadError.message);
      }
      
      // Update product with the image URL (and local path if download succeeded)
      updateProductImage(productId, imageUrl, localPath);
      
      // Update in database
      try {
        await apiOperations.updateProduct(productId, { 
          image_url: imageUrl, 
          image_local_path: localPath 
        });
        console.log('Product image updated in database');
      } catch (dbError) {
        console.error('Failed to update database (will retry later):', dbError);
      }
      
      // Close modal after selection
      setImageModal({ isOpen: false, images: [], productId: null, isSearching: false });
      
    } catch (error) {
      console.error("Error selecting image:", error);
      setError(t('errors.imageSetFailed', { error: error.message }));
    }
  };

  // Helper function to update product image in state
  const updateProductImage = (productId, imageUrl, localPath) => {
    setProducts(prev => prev.map(p => 
      p.id === productId 
        ? { ...p, image_url: imageUrl, image_local_path: localPath }
        : p
    ));
    
    // Update detail modal if open
    if (detailModal.isOpen && detailModal.product.id === productId) {
      setDetailModal(prev => ({
        ...prev,
        product: { ...prev.product, image_url: imageUrl, image_local_path: localPath }
      }));
    }
  };

  const closeImageModal = () => {
    setImageModal({ isOpen: false, images: [], selectedImage: null, productId: null, isSearching: false });
  };

  // Part Analysis
  const analyzePart = async (product) => {
    setPartAnalysisModal(prev => ({ ...prev, analyzing: true, error: null, product, isOpen: true }));
    
    try {
      // Prepare the optimal prompt for auto parts analysis in Arabic
      const prompt = `أنت خبير متخصص في قطع غيار السيارات. قم بتحليل قطعة الغيار هذه وتقديم معلومات مهنية للبيع.

اسم القطعة: ${product.name}
${product.description ? `الوصف الحالي: ${product.description}` : ''}
${product.barcode ? `الباركود: ${product.barcode}` : ''}
${product.category_name ? `الفئة: ${product.category_name}` : ''}
${product.vendor_name ? `المورد/العلامة التجارية: ${product.vendor_name}` : ''}

يرجى تقديم تحليل منظم باللغة العربية في التنسيق التالي:

1. تحديد القطعة:
   - الاسم التقني والأسماء الشائعة
   - نوع القطعة والفئة
   - تصنيف أصلي/بديل

2. توافق المركبات:
   - قائمة الماركات والموديلات المتوافقة (كن محددًا مع السنوات عندما يكون ممكنًا)
   - الاستخدامات الشائعة (مثل "تناسب معظم السيدان اليابانية 2010-2020")
   - أي ملاحظات خاصة للتركيب

3. نقاط البيع الرئيسية:
   - المزايا والخصائص الرئيسية
   - مؤشرات الجودة
   - تحسينات الأداء (إن وجدت)

4. المشاكل الشائعة التي تحلها:
   - الأعراض التي تشير إلى الحاجة لاستبدال هذه القطعة
   - المشاكل التي تحلها
   - العمر المتوقع

5. معلومات التركيب:
   - مستوى الصعوبة (صديق للهواة أم يتطلب محترف)
   - الأدوات الخاصة المطلوبة
   - الوقت المقدر للتركيب

6. الموقع في السوق:
   - اقتراحات نقاط السعر (اقتصادي/متوسط/مميز)
   - ملف العميل المستهدف
   - فرص البيع المتقاطع

يرجى أن تكون الإجابة موجزة ولكن مفيدة، مع التركيز على المعلومات التي تساعد في بيع القطعة. تأكد من أن جميع الإجابات باللغة العربية.`;

      // Call OpenRouter API with Gemini 2.5 Flash
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Auto Parts Inventory System'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',  // Gemini 2.5 Flash
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content;

      if (!analysis) {
        throw new Error('No analysis received');
      }

      // Parse and structure the analysis
      const structuredAnalysis = parseAnalysis(analysis);
      
      console.log('Raw Analysis:', analysis);
      console.log('Structured Analysis:', structuredAnalysis);
      
      setPartAnalysisModal(prev => ({ 
        ...prev, 
        analyzing: false, 
        analysis: structuredAnalysis,
        rawAnalysis: analysis 
      }));

    } catch (error) {
      console.error('Analysis Error:', error);
      setPartAnalysisModal(prev => ({ 
        ...prev, 
        analyzing: false, 
        error: error.message || 'Failed to analyze part'
      }));
    }
  };

  // Parse analysis response into structured format - now supports Arabic
  const parseAnalysis = (rawAnalysis) => {
    const sections = {
      identification: '',
      compatibility: '',
      sellingPoints: '',
      commonIssues: '',
      installation: '',
      marketPosition: ''
    };

    // Split by numbered sections - support both English and Arabic patterns
    const sectionMatches = rawAnalysis.match(/\d+\.\s+[\u0600-\u06FFa-zA-Z\s]+:[\s\S]*?(?=\d+\.\s+[\u0600-\u06FFa-zA-Z]|$)/g) || [];
    
    sectionMatches.forEach(section => {
      // Check for Arabic section headers
      if (section.includes('تحديد القطعة') || section.includes('IDENTIFICATION')) {
        sections.identification = section.replace(/\d+\.\s+[\u0600-\u06FFa-zA-Z\s]+:/, '').trim();
      } else if (section.includes('توافق المركبات') || section.includes('COMPATIBILITY')) {
        sections.compatibility = section.replace(/\d+\.\s+[\u0600-\u06FFa-zA-Z\s]+:/, '').trim();
      } else if (section.includes('نقاط البيع الرئيسية') || section.includes('SELLING POINTS')) {
        sections.sellingPoints = section.replace(/\d+\.\s+[\u0600-\u06FFa-zA-Z\s]+:/, '').trim();
      } else if (section.includes('المشاكل الشائعة') || section.includes('ISSUES')) {
        sections.commonIssues = section.replace(/\d+\.\s+[\u0600-\u06FFa-zA-Z\s]+:/, '').trim();
      } else if (section.includes('معلومات التركيب') || section.includes('INSTALLATION')) {
        sections.installation = section.replace(/\d+\.\s+[\u0600-\u06FFa-zA-Z\s]+:/, '').trim();
      } else if (section.includes('الموقع في السوق') || section.includes('MARKET')) {
        sections.marketPosition = section.replace(/\d+\.\s+[\u0600-\u06FFa-zA-Z\s]+:/, '').trim();
      }
    });

    // If structured parsing fails, return the raw analysis as one section
    if (Object.values(sections).every(section => section === '')) {
      sections.identification = rawAnalysis;
    }

    return sections;
  };

  // Save analysis to product
  const saveAnalysisToProduct = async () => {
    if (!partAnalysisModal.product || !partAnalysisModal.rawAnalysis) return;

    try {
      const updateData = {
        description: partAnalysisModal.rawAnalysis.slice(0, 500), // Save first 500 chars as description
        part_analysis: partAnalysisModal.rawAnalysis // Save full analysis in a new field
      };

      await apiOperations.updateProduct(partAnalysisModal.product.id, updateData);
      
      // Update local state
      setProducts(prev => prev.map(p => 
        p.id === partAnalysisModal.product.id 
          ? { ...p, ...updateData }
          : p
      ));

      // Close modal
      setPartAnalysisModal({ isOpen: false, product: null, analyzing: false, analysis: null, error: null });
      
    } catch (error) {
      console.error('Failed to save analysis:', error);
      setPartAnalysisModal(prev => ({ ...prev, error: 'Failed to save analysis' }));
    }
  };

  const handleGenerateBarcode = async (product) => {
    try {
      setBarcodeGenerating(prev => new Set([...prev, product.id]));
      
      // Generate new barcode
      const newBarcode = generateBarcode(product);
      console.log(`🏷️ Generated barcode for ${product.name}: ${newBarcode}`);
      
      // Save to database
      const response = await saveBarcodeToProduct(product.id, newBarcode);
      
      if (response.success) {
        // Update local products list
        setProducts(prev => prev.map(p => 
          p.id === product.id 
            ? { ...p, barcode: newBarcode }
            : p
        ));
        
        // Print barcode
        const barcodeData = printBarcode({ ...product, barcode: newBarcode });
        
        console.log(`✅ Barcode generated and printed for ${product.name}`);
        // Could add a success notification here
      } else {
        throw new Error(response.error || 'Failed to save barcode');
      }
      
    } catch (error) {
      console.error('❌ Error generating barcode:', error);
      setError(t('errors.barcodeFailed', { error: error.message }));
    } finally {
      setBarcodeGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gaming-black">
        <div className="w-32 h-32">
          <Lottie animationData={gamingLoaderAnimation} loop={true} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gaming-black">
        <div className="text-red-400 flex items-center space-x-2">
          <AlertTriangle size={24} />
          <span>{t('common.error')}: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-black p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Package className="text-gaming-yellow" size={36} />
            <div>
              <h1 className="text-3xl font-bold text-gaming-yellow">{t('viewProducts.title')}</h1>
              <p className="text-gaming-purple">{t('viewProducts.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-gaming-gray border border-gaming-purple/30 rounded-lg px-4 py-2">
              <span className="text-gaming-purple text-sm">{t('viewProducts.totalItems')}</span>
              <p className="text-2xl font-bold text-gaming-yellow">{products.length}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-3 text-gaming-purple" size={20} />
            <input
              type="text"
              placeholder={t('viewProducts.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gaming-gray border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gray-500 focus:border-gaming-yellow focus:outline-none rtl:pl-4 rtl:pr-10"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 bg-gaming-gray border border-gaming-purple/30 rounded-lg text-gaming-yellow focus:border-gaming-yellow focus:outline-none"
          >
            <option value="all">{t('viewProducts.allCategories')}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* View Mode */}
          <div className="flex bg-gaming-gray border border-gaming-purple/30 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-4 py-3 ${viewMode === "grid" ? "bg-gaming-yellow text-gaming-black" : "text-gaming-purple hover:text-gaming-yellow"}`}
            >
              <Grid size={20} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-3 ${viewMode === "list" ? "bg-gaming-yellow text-gaming-black" : "text-gaming-purple hover:text-gaming-yellow"}`}
            >
              <List size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Products Display */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((product) => {
            const stock = getStockClass(product.quantity, product.min_stock_level);
            return (
              <div 
                key={product.id} 
                className="gaming-card group cursor-pointer"
                onClick={() => openDetailModal(product)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <Gamepad2 className="text-gaming-purple flex-shrink-0" size={20} />
                    <h3 className="text-gaming-yellow font-bold truncate" title={product.name}>{product.name}</h3>
                  </div>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateBarcode(product);
                      }}
                      className="p-1 text-gaming-yellow hover:text-gaming-purple transition-colors"
                      disabled={barcodeGenerating.has(product.id)}
                      title={t('imageViewer.generatePrintBarcode')}
                    >
                      {barcodeGenerating.has(product.id) ? (
                        <div className="w-4 h-4 border-2 border-gaming-purple border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Printer size={16} />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(product);
                      }}
                      className="p-1 text-gaming-purple hover:text-gaming-yellow transition-colors"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDelete(product);
                      }}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <ProductImage product={product} />

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gaming-purple text-sm">{t('common.price')}</span>
                    <span className="text-gaming-yellow font-bold">{formatPriceLocal(product.price)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gaming-purple text-sm">{t('common.stock')}</span>
                    <span className={`px-2 py-1 rounded text-xs ${stock.cls}`}>{stock.txt}</span>
                  </div>
                  {product.barcode && (
                    <div className="flex items-center space-x-1 text-gaming-purple/70 text-xs">
                      <Barcode size={14} />
                      <span>{product.barcode}</span>
                    </div>
                  )}
                  {product.product_code && product.product_code !== product.barcode && (
                    <div className="flex items-center space-x-1 text-gaming-cyan/70 text-xs mt-1">
                      <span className="text-[10px]">CODE:</span>
                      <span>{product.product_code}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gaming-gray border border-gaming-purple/30 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gaming-black/50 border-b border-gaming-purple/30">
              <tr>
                <th className="px-4 py-3 text-left rtl:text-right text-gaming-yellow cursor-pointer" onClick={() => handleSort("name")}>
                  {t('common.product')} {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-left rtl:text-right text-gaming-purple">{t('common.category')}</th>
                <th className="px-4 py-3 text-left rtl:text-right text-gaming-purple cursor-pointer" onClick={() => handleSort("price")}>
                  {t('common.price')} {sortBy === "price" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-left rtl:text-right text-gaming-purple cursor-pointer" onClick={() => handleSort("quantity")}>
                  {t('common.stock')} {sortBy === "quantity" && (sortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-3 text-left rtl:text-right text-gaming-purple">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gaming-purple/20">
              {filtered.map((product) => {
                const stock = getStockClass(product.quantity, product.min_stock_level);
                return (
                  <tr key={product.id} className="hover:bg-gaming-black/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <Gamepad2 className="text-gaming-purple" size={16} />
                        <span className="text-gaming-yellow font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gaming-purple">{product.category_name || t('common.dash')}</td>
                    <td className="px-4 py-3 text-gaming-yellow">{formatPriceLocal(product.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${stock.cls}`}>{stock.txt}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleGenerateBarcode(product)}
                          className="p-1 text-gaming-yellow hover:text-gaming-purple transition-colors"
                          disabled={barcodeGenerating.has(product.id)}
                          title={t('imageViewer.generatePrintBarcode')}
                        >
                          {barcodeGenerating.has(product.id) ? (
                            <div className="w-4 h-4 border-2 border-gaming-purple border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Printer size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1 text-gaming-purple hover:text-gaming-yellow transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => openDelete(product)}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gaming-gray border border-gaming-yellow/50 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gaming-yellow mb-4">{t('common.confirmDelete')}</h3>
            <p className="text-gaming-purple mb-6">
              {t('viewProducts.deleteConfirmation', { product: deleteModal.productName })}
            </p>
            <div className="flex justify-end space-x-4 rtl:space-x-reverse rtl:justify-start">
              <button
                onClick={closeDelete}
                className="px-4 py-2 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-purple hover:border-gaming-purple transition-colors"
                disabled={deleteModal.isDeleting}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                disabled={deleteModal.isDeleting}
              >
                {deleteModal.isDeleting ? t('viewProducts.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gaming-gray border border-gaming-yellow/50 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gaming-yellow">{t('viewProducts.editProduct')}</h3>
              <button onClick={closeEditModal} className="text-gaming-purple hover:text-gaming-yellow">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gaming-purple text-sm mb-1">{t('addProduct.productName')}</label>
                <input
                  type="text"
                  value={editModal.product.name || ""}
                  onChange={(e) => setEditModal(prev => ({
                    ...prev,
                    product: { ...prev.product, name: e.target.value }
                  }))}
                  className="w-full px-3 py-2 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-yellow focus:border-gaming-yellow focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gaming-purple text-sm mb-1">{t('addProduct.sellingPrice')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editModal.product.price || ""}
                    onChange={(e) => setEditModal(prev => ({
                      ...prev,
                      product: { ...prev.product, price: parseFloat(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-yellow focus:border-gaming-yellow focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-gaming-purple text-sm mb-1">{t('common.quantity')}</label>
                  <input
                    type="number"
                    value={editModal.product.quantity || ""}
                    onChange={(e) => setEditModal(prev => ({
                      ...prev,
                      product: { ...prev.product, quantity: parseInt(e.target.value) }
                    }))}
                    className="w-full px-3 py-2 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-yellow focus:border-gaming-yellow focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 rtl:space-x-reverse rtl:justify-start mt-6">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-purple hover:border-gaming-purple transition-colors"
                  disabled={editModal.isUpdating}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleEditSubmit}
                  className="px-4 py-2 bg-gaming-yellow text-gaming-black font-bold rounded-lg hover:bg-gaming-yellow-dark transition-colors"
                  disabled={editModal.isUpdating}
                >
                  {editModal.isUpdating ? t('viewProducts.updating') : t('common.update')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {detailModal.isOpen && detailModal.product && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gaming-gray border border-gaming-yellow/50 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gaming-yellow">
                  {detailModal.product?.name || t('imageViewer.noName')}
                </h3>
                <button onClick={closeDetailModal} className="text-gaming-purple hover:text-gaming-yellow">
                  <X size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Image */}
                <div className="space-y-4">
                  <DetailModalImage product={detailModal.product} />
                  
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => searchProductImages(detailModal.product.name, detailModal.product.id)}
                      className="w-full px-4 py-2 bg-gaming-yellow text-gaming-black font-bold rounded-lg hover:bg-gaming-yellow-dark transition-colors flex items-center justify-center gap-2"
                      disabled={imageModal.isSearching}
                    >
                      <Image size={16} />
                      {imageModal.isSearching ? t('common.searching') : t('viewProducts.changeImage')}
                    </button>
                    <button
                      onClick={() => analyzePart(detailModal.product)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
                      disabled={partAnalysisModal.analyzing}
                    >
                      <Sparkles size={16} className="animate-pulse" />
                      {partAnalysisModal.analyzing ? t('imageViewer.analyzing') : t('imageViewer.knowMore')}
                    </button>
                  </div>
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.productId') || 'Product ID'}</span>
                      <p className="text-gaming-yellow font-bold">{detailModal.product.id}</p>
                    </div>
                    <div>
                      <span className="text-gaming-purple text-sm">{t('common.status') || 'Status'}</span>
                      <p className="text-gaming-yellow font-bold">{detailModal.product.is_active ? (t('common.active') || 'Active') : (t('common.inactive') || 'Inactive')}</p>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.sellingPrice') || 'Selling Price'}</span>
                      <p className="text-gaming-yellow font-bold text-lg">{formatPriceLocal(detailModal.product.price)}</p>
                    </div>
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.costPrice') || 'Cost Price'}</span>
                      <p className="text-gaming-yellow font-bold text-lg">{formatPriceLocal(detailModal.product.cost_price)}</p>
                    </div>
                  </div>

                  {/* Stock Info */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.currentStock') || 'Current Stock'}</span>
                      <p className="text-gaming-yellow font-bold text-lg">{detailModal.product.quantity}</p>
                    </div>
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.minStock') || 'Min Stock'}</span>
                      <p className="text-gaming-yellow">{detailModal.product.min_stock_level}</p>
                    </div>
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.maxStock') || 'Max Stock'}</span>
                      <p className="text-gaming-yellow">{detailModal.product.max_stock_level}</p>
                    </div>
                  </div>

                  {/* Identification */}
                  <div>
                    <span className="text-gaming-purple text-sm">{t('products.barcode')}</span>
                    <p className="text-gaming-yellow">{detailModal.product.barcode || t('common.dash')}</p>
                  </div>

                  {/* Product Code (from Azure Document AI) */}
                  {detailModal.product.product_code && (
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.productCode') || 'Product Code'}</span>
                      <p className="text-gaming-cyan">{detailModal.product.product_code}</p>
                    </div>
                  )}

                  {/* Reference (if different from product code) */}
                  {detailModal.product.reference && detailModal.product.reference !== detailModal.product.product_code && (
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.reference') || 'Reference'}</span>
                      <p className="text-gaming-cyan">{detailModal.product.reference}</p>
                    </div>
                  )}

                  {/* Business Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.vendor')}</span>
                      <p className="text-gaming-yellow">{detailModal.product.vendor_name || t('common.dash')}</p>
                    </div>
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.category')}</span>
                      <p className="text-gaming-yellow">{detailModal.product.category_name || t('common.dash')}</p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {detailModal.product.markup_percentage && (
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.markup')}</span>
                      <p className="text-gaming-yellow">{detailModal.product.markup_percentage}%</p>
                    </div>
                  )}

                  {detailModal.product.description && (
                    <div>
                      <span className="text-gaming-purple text-sm">{t('products.description')}</span>
                      <p className="text-gaming-yellow">{detailModal.product.description}</p>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="border-t border-gaming-purple/30 pt-4 space-y-2">
                    <h4 className="text-gaming-yellow font-semibold">{t('products.timeline')}</h4>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div>
                        <span className="text-gaming-purple">{t('common.created')}: </span>
                        <span className="text-gaming-yellow">{formatDate(detailModal.product.created_at)}</span>
                      </div>
                      {detailModal.product.updated_at && (
                        <div>
                          <span className="text-gaming-purple">{t('common.updated')}: </span>
                          <span className="text-gaming-yellow">{formatDate(detailModal.product.updated_at)}</span>
                        </div>
                      )}
                      {detailModal.product.last_sold && (
                        <div>
                          <span className="text-gaming-purple">{t('products.lastSold')}: </span>
                          <span className="text-gaming-yellow">{formatDate(detailModal.product.last_sold)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Technical Info */}
                  <div className="border-t border-gaming-purple/30 pt-4 space-y-2">
                    <h4 className="text-gaming-yellow font-semibold">{t('products.technicalDetails')}</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gaming-purple">{t('products.vendorId')}: </span>
                        <span className="text-gaming-yellow">{detailModal.product.vendor_id}</span>
                      </div>
                      <div>
                        <span className="text-gaming-purple">{t('products.categoryId')}: </span>
                        <span className="text-gaming-yellow">{detailModal.product.category_id || t('common.none')}</span>
                      </div>
                    </div>
                    {detailModal.product.image_url && (
                      <div>
                        <span className="text-gaming-purple text-xs">{t('products.originalImageUrl')}: </span>
                        <p className="text-gaming-yellow text-xs break-all">{detailModal.product.image_url}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Part Analysis Modal */}
      {partAnalysisModal.isOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gaming-gray border border-purple-500/50 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl shadow-purple-500/20">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
                    <Sparkles className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gaming-yellow">{t('partAnalysis.title')}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setPartAnalysisModal({ isOpen: false, product: null, analyzing: false, analysis: null, error: null })}
                  className="text-gaming-purple hover:text-gaming-yellow"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Product Info */}
              {partAnalysisModal.product && (
                <div className="mb-4 p-3 bg-gaming-black/50 rounded-lg border border-gaming-purple/30">
                  <div className="flex items-center gap-2">
                    <Package className="text-gaming-purple" size={16} />
                    <span className="text-gaming-yellow font-medium">{partAnalysisModal.product.name}</span>
                    {partAnalysisModal.product.vendor_name && (
                      <span className="text-gaming-purple text-sm">• {partAnalysisModal.product.vendor_name}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {partAnalysisModal.analyzing && (
                <div className="py-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                    <div className="w-full h-full border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gaming-purple text-lg mb-2">{t('partAnalysis.analyzing')}</p>
                  <p className="text-gaming-purple/70 text-sm">{t('partAnalysis.waitMessage')}</p>
                </div>
              )}

              {/* Error State */}
              {partAnalysisModal.error && (
                <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle size={20} />
                    <span>{t('partAnalysis.error', {message: partAnalysisModal.error})}</span>
                  </div>
                </div>
              )}

              {/* Analysis Results */}
              {partAnalysisModal.analysis && (
                <div className="space-y-4">
                  
                  {/* Raw Analysis Fallback - if structured sections are empty, show raw */}
                  {Object.values(partAnalysisModal.analysis).every(section => section === '') && partAnalysisModal.rawAnalysis && (
                    <div className="p-5 bg-gradient-to-br from-gaming-black/60 to-gaming-black/40 rounded-xl border border-gaming-purple/20 shadow-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-gaming-yellow/10 rounded-lg">
                          <Sparkles className="text-gaming-yellow" size={20} />
                        </div>
                        <h4 className="text-gaming-yellow font-bold text-lg">تحليل القطعة</h4>
                      </div>
                      <p className="text-gaming-purple whitespace-pre-wrap text-right" dir="rtl">{partAnalysisModal.rawAnalysis}</p>
                    </div>
                  )}
                  {/* Part Identification */}
                  {partAnalysisModal.analysis.identification && (
                    <div className="p-5 bg-gradient-to-br from-gaming-black/60 to-gaming-black/40 rounded-xl border border-gaming-purple/20 shadow-lg hover:shadow-gaming-purple/20 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-gaming-yellow/10 rounded-lg">
                          <Info className="text-gaming-yellow" size={20} />
                        </div>
                        <h4 className="text-gaming-yellow font-bold text-lg">تحديد القطعة</h4>
                      </div>
                      <p className="text-gaming-purple whitespace-pre-wrap text-right" dir="rtl">{partAnalysisModal.analysis.identification}</p>
                    </div>
                  )}

                  {/* Vehicle Compatibility */}
                  {partAnalysisModal.analysis.compatibility && (
                    <div className="p-5 bg-gradient-to-br from-gaming-black/60 to-gaming-black/40 rounded-xl border border-gaming-purple/20 shadow-lg hover:shadow-gaming-purple/20 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-gaming-yellow/10 rounded-lg">
                          <Car className="text-gaming-yellow" size={20} />
                        </div>
                        <h4 className="text-gaming-yellow font-bold text-lg">توافق المركبات</h4>
                      </div>
                      <p className="text-gaming-purple whitespace-pre-wrap text-right" dir="rtl">{partAnalysisModal.analysis.compatibility}</p>
                    </div>
                  )}

                  {/* Key Selling Points */}
                  {partAnalysisModal.analysis.sellingPoints && (
                    <div className="p-5 bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-xl border border-green-500/20 shadow-lg hover:shadow-green-500/20 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <Sparkles className="text-green-400" size={20} />
                        </div>
                        <h4 className="text-green-400 font-bold text-lg">نقاط البيع الرئيسية</h4>
                      </div>
                      <p className="text-green-300 whitespace-pre-wrap text-right" dir="rtl">{partAnalysisModal.analysis.sellingPoints}</p>
                    </div>
                  )}

                  {/* Common Issues It Fixes */}
                  {partAnalysisModal.analysis.commonIssues && (
                    <div className="p-5 bg-gradient-to-br from-gaming-black/60 to-gaming-black/40 rounded-xl border border-gaming-purple/20 shadow-lg hover:shadow-gaming-purple/20 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-gaming-yellow/10 rounded-lg">
                          <AlertTriangle className="text-gaming-yellow" size={20} />
                        </div>
                        <h4 className="text-gaming-yellow font-bold text-lg">المشاكل الشائعة التي تحلها</h4>
                      </div>
                      <p className="text-gaming-purple whitespace-pre-wrap text-right" dir="rtl">{partAnalysisModal.analysis.commonIssues}</p>
                    </div>
                  )}

                  {/* Installation Info */}
                  {partAnalysisModal.analysis.installation && (
                    <div className="p-5 bg-gradient-to-br from-gaming-black/60 to-gaming-black/40 rounded-xl border border-gaming-purple/20 shadow-lg hover:shadow-gaming-purple/20 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-gaming-yellow/10 rounded-lg">
                          <Settings className="text-gaming-yellow" size={20} />
                        </div>
                        <h4 className="text-gaming-yellow font-bold text-lg">معلومات التركيب</h4>
                      </div>
                      <p className="text-gaming-purple whitespace-pre-wrap text-right" dir="rtl">{partAnalysisModal.analysis.installation}</p>
                    </div>
                  )}

                  {/* Market Positioning */}
                  {partAnalysisModal.analysis.marketPosition && (
                    <div className="p-5 bg-gradient-to-br from-purple-900/20 to-pink-900/10 rounded-xl border border-purple-500/20 shadow-lg hover:shadow-purple-500/20 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <DollarSign className="text-purple-400" size={20} />
                        </div>
                        <h4 className="text-purple-400 font-bold text-lg">الموقع في السوق</h4>
                      </div>
                      <p className="text-purple-300 whitespace-pre-wrap text-right" dir="rtl">{partAnalysisModal.analysis.marketPosition}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gaming-purple/30">
                    <button
                      onClick={() => {
                        // Copy analysis to clipboard
                        if (partAnalysisModal.rawAnalysis) {
                          navigator.clipboard.writeText(partAnalysisModal.rawAnalysis);
                          // Could add a toast notification here
                        }
                      }}
                      className="px-4 py-2 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-purple hover:border-gaming-purple transition-colors"
                    >
                      {t('partAnalysis.copyAnalysis')}
                    </button>
                    <button
                      onClick={saveAnalysisToProduct}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-purple-500/50"
                    >
                      {t('partAnalysis.saveToProduct')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Selection Modal */}
      {imageModal.isOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gaming-gray border border-gaming-yellow/50 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gaming-yellow">{t('imageViewer.selectProductImage')}</h3>
                  <p className="text-gaming-purple text-sm mt-1">
                    {imageModal.bestImageUrl ? 
                      `🎯 Best image auto-selected. Choose a different one if needed. (${imageModal.images?.length || 0} shown, more cached)` :
                      `Choose from ${imageModal.images?.length || 0} available images`
                    }
                  </p>
                </div>
                <button onClick={closeImageModal} className="text-gaming-purple hover:text-gaming-yellow">
                  <X size={24} />
                </button>
              </div>
              
              {imageModal.images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {imageModal.images.map((image, index) => {
                    // Check if this image is currently selected
                    const product = products.find(p => p.id === imageModal.productId);
                    const isSelected = product && product.image_url === image.url;
                    const isBestImage = image.url === imageModal.bestImageUrl;
                    
                    return (
                    <div
                      key={index}
                      className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                        image.blocked
                          ? 'cursor-not-allowed border-red-400 opacity-75'
                          : isSelected 
                          ? 'cursor-pointer border-gaming-yellow ring-2 ring-gaming-yellow/50' 
                          : isBestImage
                          ? 'cursor-pointer border-green-400 ring-2 ring-green-400/30'
                          : 'cursor-pointer border-transparent hover:border-gaming-purple'
                      }`}
                      onClick={() => {
                        if (!image.blocked) {
                          selectProductImage(image.url, imageModal.productId);
                        } else {
                          console.log('🚫 Blocked image cannot be selected:', image.url);
                        }
                      }}
                    >
<SearchResultImage image={image} />
                      <div className="p-2 bg-gaming-black/50">
                        <p className="text-gaming-purple text-xs truncate">{image.source}</p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-gaming-yellow text-black px-2 py-1 rounded text-xs font-semibold">
                          {t('imageViewer.current')}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gaming-purple">{t('imageViewer.noImagesFound')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}