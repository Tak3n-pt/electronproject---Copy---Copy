import React, { useState } from "react";
import { useTranslation } from 'react-i18next';
import { formatPrice, parseCurrency, CURRENCY } from '../utils/currency';
import Lottie from "lottie-react";
import { gamingLoaderAnimation, successAnimation } from "../assets/animations";
import {
  Package, DollarSign, Hash, User, Tag, FileText,
  AlertCircle, Save, Plus, ShoppingCart, Scan,
  CheckCircle, X, Gamepad2, Zap, TrendingUp
} from "lucide-react";
import apiConfig from '../utils/apiConfig';

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

export default function AddProductPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: "",
    quantity: "",
    costPrice: "",
    sellingPrice: "",
    barcode: "",
    vendor: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Validate required fields
    if (!form.name.trim()) {
      setError(t('products.productName') + ' ' + t('products.required'));
      setLoading(false);
      return;
    }

    if (!form.quantity || parseFloat(form.quantity) <= 0) {
      setError(t('products.quantity') + ' ' + t('products.required'));
      setLoading(false);
      return;
    }

    try {
      const productData = {
        name: form.name.trim(),
        quantity: parseFloat(form.quantity),
        costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
        sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : null,
        barcode: form.barcode.trim() || null,
        vendor: form.vendor.trim() || null,
      };

      const response = await fetchWithTimeout(`${apiConfig.getBaseUrl()}/stock/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || t('errors.failedToAddProduct'));
      }

      setSuccess(true);
      setForm({
        name: "",
        quantity: "",
        costPrice: "",
        sellingPrice: "",
        barcode: "",
        vendor: "",
      });

      // Hide success message after 4 seconds
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error("Add product error:", err);
      setError(err.message || t('errors.failedToAddProduct'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gaming-black">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-4">
            <Lottie animationData={gamingLoaderAnimation} loop={true} />
          </div>
          <p className="text-gaming-purple">{t('products.addingProduct')}</p>
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
            <div className="p-3 bg-gaming-gray rounded-xl border border-gaming-purple/30">
              <Plus className="text-gaming-yellow" size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gaming-yellow">{t('nav.addProduct')}</h1>
              <p className="text-gaming-purple">{t('products.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-gaming-gray border border-gaming-purple/30 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <Package className="text-gaming-yellow" size={20} />
                <div>
                  <p className="text-gaming-purple text-xs">{t('products.stock')}</p>
                  <p className="text-2xl font-bold text-gaming-yellow">+</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 bg-gaming-gray border border-green-500/50 rounded-xl p-4 hover:animate-glow transition-all">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16">
              <Lottie animationData={successAnimation} loop={false} />
            </div>
            <div>
              <h3 className="text-green-400 font-bold text-lg">{t('products.productAdded')}</h3>
              <p className="text-gaming-purple">{t('products.productAdded')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-gaming-gray border border-red-500/50 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="text-red-400" size={24} />
            <div>
              <h3 className="text-red-400 font-bold">{t('common.error')}</h3>
              <p className="text-gaming-purple">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-gaming-gray border border-gaming-purple/30 rounded-xl p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Product Name */}
            <div className="md:col-span-2">
              <label className="block text-gaming-purple text-sm mb-2">
                {t('products.productName')} *
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gaming-purple" size={18} />
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder={t('products.productName')}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gaming-purple/50 focus:outline-none focus:border-gaming-yellow transition-colors"
                />
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-gaming-purple text-sm mb-2">
                {t('products.quantity')} *
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gaming-purple" size={18} />
                <input
                  type="number"
                  name="quantity"
                  value={form.quantity}
                  onChange={handleChange}
                  placeholder={t('products.quantity')}
                  min="0"
                  step="1"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gaming-purple/50 focus:outline-none focus:border-gaming-yellow transition-colors"
                />
              </div>
            </div>

            {/* Barcode */}
            <div>
              <label className="block text-gaming-purple text-sm mb-2">
                {t('products.barcode')}
              </label>
              <div className="relative">
                <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gaming-purple" size={18} />
                <input
                  type="text"
                  name="barcode"
                  value={form.barcode}
                  onChange={handleChange}
                  placeholder={t('products.barcode')}
                  className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gaming-purple/50 focus:outline-none focus:border-gaming-yellow transition-colors"
                />
              </div>
            </div>

            {/* Cost Price */}
            <div>
              <label className="block text-gaming-purple text-sm mb-2">
                {t('products.costPrice')}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gaming-purple" size={18} />
                <input
                  type="number"
                  name="costPrice"
                  value={form.costPrice}
                  onChange={handleChange}
                  placeholder={t('products.costPrice')}
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gaming-purple/50 focus:outline-none focus:border-gaming-yellow transition-colors"
                />
              </div>
            </div>

            {/* Selling Price */}
            <div>
              <label className="block text-gaming-purple text-sm mb-2">
                {t('products.sellingPrice')}
              </label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gaming-purple" size={18} />
                <input
                  type="number"
                  name="sellingPrice"
                  value={form.sellingPrice}
                  onChange={handleChange}
                  placeholder={t('products.sellingPrice')}
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gaming-purple/50 focus:outline-none focus:border-gaming-yellow transition-colors"
                />
              </div>
            </div>

            {/* Vendor */}
            <div className="md:col-span-2">
              <label className="block text-gaming-purple text-sm mb-2">
                {t('products.vendor')}/{t('products.supplier')}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gaming-purple" size={18} />
                <input
                  type="text"
                  name="vendor"
                  value={form.vendor}
                  onChange={handleChange}
                  placeholder={t('products.vendor')}
                  className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gaming-purple/50 focus:outline-none focus:border-gaming-yellow transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="mt-6 p-4 bg-gaming-black/50 border border-gaming-purple/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="text-gaming-yellow" size={16} />
              <h3 className="text-gaming-yellow text-sm font-bold">{t('products.proTips')}</h3>
            </div>
            <ul className="text-gaming-purple text-xs space-y-1">
              <li>• {t('products.tip1')}</li>
              <li>• {t('products.tip2')}</li>
              <li>• {t('products.tip3')}</li>
              <li>• {t('products.tip4')}</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-gaming-yellow text-gaming-black font-bold px-8 py-3 rounded-lg hover:bg-gaming-yellow-dark transition-all hover:animate-glow focus:outline-none focus:ring-2 focus:ring-gaming-yellow/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-gaming-black border-t-transparent rounded-full animate-spin"></div>
                  <span>{t('common.adding')}</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>{t('nav.addProduct')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}