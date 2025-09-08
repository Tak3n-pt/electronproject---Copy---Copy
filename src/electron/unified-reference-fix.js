/**
 * UNIFIED PRODUCT REFERENCE SYSTEM
 * One field to identify products - simple and effective
 */

class UnifiedProductReference {
  /**
   * Generate a unified reference for a product
   * Priority: real barcode > product code > generated
   */
  static createReference(item, requestId, index) {
    // 1. If there's a real barcode (numeric, 8-13 digits)
    if (item.barcode && /^\d{8,13}$/.test(item.barcode)) {
      return item.barcode; // Real barcode takes priority
    }
    
    // 2. If there's a product code/SKU
    if (item.productCode || item.reference || item.sku) {
      const code = item.productCode || item.reference || item.sku;
      // Add prefix if it's not already prefixed
      if (!/^[A-Z]+_/.test(code)) {
        return `SKU_${code}`;
      }
      return code;
    }
    
    // 3. If there's a barcode that's not standard format (might be custom)
    if (item.barcode) {
      // Add MAN_ prefix if it looks manual
      if (!/^[A-Z]+_/.test(item.barcode)) {
        return `MAN_${item.barcode}`;
      }
      return item.barcode;
    }
    
    // 4. Generate a new reference
    if (requestId && index !== undefined) {
      return `GEN_${requestId}_${index}`;
    }
    
    // 5. Ultimate fallback
    return `AUTO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Identify the type of reference
   */
  static getReferenceType(reference) {
    if (!reference) return 'none';
    
    // Real barcode (EAN/UPC)
    if (/^\d{8,13}$/.test(reference)) {
      return 'barcode';
    }
    
    // Check prefixes
    if (reference.startsWith('GEN_')) return 'generated';
    if (reference.startsWith('AUTO_')) return 'auto';
    if (reference.startsWith('SKU_')) return 'sku';
    if (reference.startsWith('MAN_')) return 'manual';
    
    // Unknown format
    return 'custom';
  }
  
  /**
   * Clean display name for UI
   */
  static getDisplayName(reference) {
    if (!reference) return 'No Reference';
    
    const type = this.getReferenceType(reference);
    
    switch(type) {
      case 'barcode':
        return reference; // Show as-is
      case 'generated':
        return `Generated: ${reference.substring(4)}`; // Remove GEN_ prefix
      case 'auto':
        return `Auto: ${reference.substring(5, 15)}...`; // Shorten auto codes
      case 'sku':
        return reference.substring(4); // Remove SKU_ prefix
      case 'manual':
        return reference.substring(4); // Remove MAN_ prefix
      default:
        return reference;
    }
  }
  
  /**
   * Search-friendly version (works with any format)
   */
  static normalizeForSearch(reference) {
    if (!reference) return '';
    
    // Remove all prefixes for searching
    return reference
      .replace(/^(GEN_|AUTO_|SKU_|MAN_)/, '')
      .toLowerCase()
      .trim();
  }
  
  /**
   * Check if two references match (ignoring type)
   */
  static matches(ref1, ref2) {
    if (!ref1 || !ref2) return false;
    
    // Direct match
    if (ref1 === ref2) return true;
    
    // Normalized match (ignoring prefixes)
    return this.normalizeForSearch(ref1) === this.normalizeForSearch(ref2);
  }
}

// Export for use in server
module.exports = UnifiedProductReference;