// Barcode generation utility
import { formatPrice } from './currency';
import apiConfig from './apiConfig';

// Generate barcode based on product info
export const generateBarcode = (product) => {
  // If product already has a barcode, return it
  if (product.barcode) {
    return product.barcode;
  }
  
  // Generate new barcode using timestamp and product ID
  const timestamp = Date.now().toString();
  const productId = product.id ? product.id.toString().padStart(4, '0') : '0000';
  
  // Create barcode: 2-digit prefix + 4-digit product ID + 6-digit timestamp suffix
  const prefix = '12'; // Store prefix
  const timestampSuffix = timestamp.slice(-6);
  const newBarcode = `${prefix}${productId}${timestampSuffix}`;
  
  return newBarcode;
};

// Generate printable barcode data for labels
export const generatePrintableBarcode = (product) => {
  const barcode = generateBarcode(product);
  
  return {
    barcode,
    productName: product.name,
    price: formatPrice(product.price),
    category: product.category_name || 'General',
    vendor: product.vendor_name || 'Store',
    generatedAt: new Date().toLocaleDateString('fr-DZ'),
    qrData: JSON.stringify({
      id: product.id,
      name: product.name,
      barcode,
      price: product.price
    })
  };
};

// Create barcode for printing (HTML format)
export const createBarcodeHTML = (barcodeData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Barcode - ${barcodeData.productName}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 20px; 
          background: white;
        }
        .barcode-container { 
          border: 2px solid #000; 
          padding: 20px; 
          width: 300px; 
          text-align: center;
          background: white;
        }
        .barcode-number { 
          font-family: 'Courier New', monospace; 
          font-size: 18px; 
          font-weight: bold; 
          letter-spacing: 2px;
          margin: 10px 0;
        }
        .barcode-lines {
          height: 60px;
          background: linear-gradient(90deg, 
            black 2px, white 2px, white 4px, black 4px, black 6px, white 6px, white 8px,
            black 8px, black 10px, white 10px, white 12px, black 12px, black 14px, white 14px, white 16px,
            black 16px, black 18px, white 18px, white 20px, black 20px, black 22px, white 22px, white 24px,
            black 24px, black 26px, white 26px, white 28px, black 28px, black 30px, white 30px);
          background-size: 30px 100%;
          margin: 15px 0;
        }
        .product-info { 
          font-size: 12px; 
          margin-top: 10px;
        }
        .price { 
          font-size: 16px; 
          font-weight: bold; 
          color: #2196F3;
        }
        .print-info {
          font-size: 10px;
          color: #666;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="barcode-container">
        <div class="product-info">
          <strong>${barcodeData.productName}</strong>
        </div>
        <div class="barcode-lines"></div>
        <div class="barcode-number">${barcodeData.barcode}</div>
        <div class="price">${barcodeData.price}</div>
        <div class="product-info">
          ${barcodeData.category} • ${barcodeData.vendor}
        </div>
        <div class="print-info">
          Generated: ${barcodeData.generatedAt}
        </div>
      </div>
      
      <script>
        // Auto-print when page loads
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;
};

// Print barcode
export const printBarcode = (product) => {
  const barcodeData = generatePrintableBarcode(product);
  const htmlContent = createBarcodeHTML(barcodeData);
  
  // Create new window for printing
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  return barcodeData;
};

// Save barcode to product (API call)
export const saveBarcodeToProduct = async (productId, barcode) => {
  try {
    const response = await fetch(`${apiConfig.getBaseUrl()}/products/${productId}/barcode`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ barcode }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to save barcode:', error);
    throw error;
  }
};

export default {
  generateBarcode,
  generatePrintableBarcode,
  createBarcodeHTML,
  printBarcode,
  saveBarcodeToProduct
};