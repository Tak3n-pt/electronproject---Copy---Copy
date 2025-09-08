// Currency utility for Algerian Dinars (DZD)
export const formatCurrency = (amount, options = {}) => {
  const {
    showSymbol = true,
    decimalPlaces = 2,
    abbreviated = false
  } = options;

  // Handle null/undefined/NaN
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? 'DA 0.00' : '0.00';
  }

  const numAmount = parseFloat(amount);
  
  // Handle abbreviation for large numbers
  if (abbreviated && numAmount >= 1000) {
    if (numAmount >= 1000000) {
      const millions = (numAmount / 1000000).toFixed(1);
      return showSymbol ? `DA ${millions}M` : `${millions}M`;
    } else if (numAmount >= 1000) {
      const thousands = (numAmount / 1000).toFixed(1);
      return showSymbol ? `DA ${thousands}K` : `${thousands}K`;
    }
  }

  // Format with proper decimal places and thousands separator
  const formatted = numAmount.toLocaleString('fr-DZ', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  });

  return showSymbol ? `DA ${formatted}` : formatted;
};

// Specific formatting functions
export const formatPrice = (price) => formatCurrency(price, { decimalPlaces: 2 });
export const formatCompactPrice = (price) => formatCurrency(price, { abbreviated: true, decimalPlaces: 1 });
export const formatPriceNoSymbol = (price) => formatCurrency(price, { showSymbol: false });

// Parse currency string back to number
export const parseCurrency = (currencyString) => {
  if (typeof currencyString !== 'string') return parseFloat(currencyString) || 0;
  
  // Remove DA, spaces, and convert to number
  const cleaned = currencyString
    .replace(/DA/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
    
  return parseFloat(cleaned) || 0;
};

// Currency constants
export const CURRENCY = {
  symbol: 'DA',
  code: 'DZD',
  name: 'Algerian Dinar',
  nameFr: 'Dinar Algérien',
  nameAr: 'دينار جزائري'
};

export default {
  formatCurrency,
  formatPrice,
  formatCompactPrice,
  formatPriceNoSymbol,
  parseCurrency,
  CURRENCY
};