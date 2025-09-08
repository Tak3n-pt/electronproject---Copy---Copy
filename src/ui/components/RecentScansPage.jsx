import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../utils/currency';
import Lottie from "lottie-react";
import { gamingLoaderAnimation, successAnimation } from "../assets/animations";
import { apiOperations, handleApiError, getImageUrl } from "../utils/api";
import {
  FileText, Calendar, DollarSign, Package, Clock, CheckCircle,
  AlertCircle, RefreshCw, User, Receipt, TrendingUp, ArrowRight,
  Image, X, Scan, Trophy, Zap, Activity, ChevronLeft, ChevronRight,
  Images as ImagesIcon, Search, Filter, Eye, Star, Download,
  BarChart3, PieChart, Layers, Tag, MapPin, Building2, CreditCard,
  Smartphone, Monitor, Globe, Wifi, WifiOff, ChevronUp, ChevronDown,
  Info
} from "lucide-react";

export default function RecentScansPage() {
  const { t, i18n } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageModal, setImageModal] = useState({ open: false, images: [], currentIndex: 0, invoiceNumber: null });
  const [detailsModal, setDetailsModal] = useState({ open: false, invoice: null });
  const [refreshing, setRefreshing] = useState(false);
  
  // Enhanced filtering and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [headerCollapsed, setHeaderCollapsed] = useState(false); // State for collapsible header

  const fetchRecentInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiOperations.getRecentScans(20);
      // FIXED: Process invoice data like mobile app - keep original URLs intact
      const processedInvoices = (data.scans || data.invoices || []).map(invoice => ({
        ...invoice,
        // Copy mobile app logic: preserve original URLs, don't overprocess
        invoice_image_url: invoice.invoice_image_url || invoice.invoiceImageUrl,
        invoiceImageUrl: invoice.invoiceImageUrl || invoice.invoice_image_url,
        // Keep paths for fallback
        invoice_image_path: invoice.invoice_image_path || invoice.invoiceImagePath
      }));
      setInvoices(processedInvoices);
      setFilteredInvoices(processedInvoices);
    } catch (err) {
      console.error('Failed to fetch recent invoices:', err);
      setError(handleApiError(err, t('scans.loadError')));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRecentInvoices();
    setTimeout(() => setRefreshing(false), 500);
  };

  useEffect(() => {
    fetchRecentInvoices();
  }, []);

  // Enhanced filtering and search logic
  useEffect(() => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice => 
        (invoice.vendor_name || '').toLowerCase().includes(searchLower) ||
        (invoice.invoice_number || '').toLowerCase().includes(searchLower) ||
        (invoice.customer_name || '').toLowerCase().includes(searchLower) ||
        (invoice.items || []).some(item => 
          (item.name || '').toLowerCase().includes(searchLower) ||
          (item.description || '').toLowerCase().includes(searchLower)
        )
      );
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(invoice => 
        (invoice.status || 'processing').toLowerCase() === selectedStatus.toLowerCase()
      );
    }

    // Source filter
    if (selectedSource !== 'all') {
      filtered = filtered.filter(invoice => {
        const source = invoice.source || 'desktop_app';
        return source === selectedSource;
      });
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        default:
          filterDate = null;
      }
      
      if (filterDate) {
        filtered = filtered.filter(invoice => 
          new Date(invoice.created_at || invoice.invoice_date) >= filterDate
        );
      }
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'vendor':
          aValue = a.vendor_name || '';
          bValue = b.vendor_name || '';
          break;
        case 'amount':
          aValue = parseFloat(a.total_amount || 0);
          bValue = parseFloat(b.total_amount || 0);
          break;
        case 'items':
          aValue = parseInt(a.total_items || 0);
          bValue = parseInt(b.total_items || 0);
          break;
        case 'date':
        default:
          aValue = new Date(a.created_at || a.invoice_date || 0);
          bValue = new Date(b.created_at || b.invoice_date || 0);
          break;
      }
      
      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });

    setFilteredInvoices(filtered);
  }, [invoices, searchTerm, selectedStatus, selectedSource, dateFilter, sortBy, sortOrder]);

  // Statistics calculation
  const statistics = {
    total: invoices.length,
    success: invoices.filter(i => i.status === 'success' || i.status === 'completed').length,
    pending: invoices.filter(i => i.status === 'pending').length,
    failed: invoices.filter(i => i.status === 'error' || i.status === 'failed').length,
    mobile: invoices.filter(i => i.source === 'mobile_app').length,
    desktop: invoices.filter(i => i.source !== 'mobile_app').length,
    totalValue: invoices.reduce((sum, i) => sum + (parseFloat(i.total_amount) || 0), 0),
    totalItems: invoices.reduce((sum, i) => sum + (parseInt(i.total_items) || 0), 0)
  };

  // Keyboard navigation for image modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!imageModal.open) return;
      
      switch (event.key) {
        case 'Escape':
          closeImageModal();
          break;
        case 'ArrowLeft':
          if (imageModal.images.length > 1) {
            event.preventDefault();
            prevImage();
          }
          break;
        case 'ArrowRight':
          if (imageModal.images.length > 1) {
            event.preventDefault();
            nextImage();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [imageModal.open, imageModal.images.length]);

  const formatDate = (dateString) => {
    if (!dateString) return t('common.dash');
    const locale = i18n.language === 'ar' ? 'ar-SA' : i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return formatPrice(amount || 0);
  };

  const getStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'success':
      case 'completed':
        return { icon: CheckCircle, class: "bg-green-900/30 text-green-400 border-green-500/50" };
      case 'pending':
        return { icon: Clock, class: "bg-yellow-900/30 text-yellow-400 border-yellow-500/50" };
      case 'error':
      case 'failed':
        return { icon: AlertCircle, class: "bg-red-900/30 text-red-400 border-red-500/50" };
      default:
        return { icon: Activity, class: "bg-gaming-purple/30 text-gaming-purple border-gaming-purple/50" };
    }
  };

  const openImageModal = (images, invoiceNumber, startIndex = 0) => {
    // Ensure images is an array
    const imageArray = Array.isArray(images) ? images : [{ url: images, path: images, page: 1, type: 'main' }];
    setImageModal({ 
      open: true, 
      images: imageArray, 
      currentIndex: startIndex, 
      invoiceNumber 
    });
  };

  const closeImageModal = () => {
    setImageModal({ open: false, images: [], currentIndex: 0, invoiceNumber: null });
  };

  const openDetailsModal = (invoice) => {
    setDetailsModal({ open: true, invoice });
  };

  const closeDetailsModal = () => {
    setDetailsModal({ open: false, invoice: null });
  };

  const nextImage = () => {
    setImageModal(prev => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.images.length
    }));
  };

  const prevImage = () => {
    setImageModal(prev => ({
      ...prev,
      currentIndex: prev.currentIndex === 0 ? prev.images.length - 1 : prev.currentIndex - 1
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gaming-black">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-4">
            <Lottie animationData={gamingLoaderAnimation} loop={true} />
          </div>
          <p className="text-gaming-purple">{t('scans.loadingScans')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gaming-black">
        <div className="text-center">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchRecentInvoices}
            className="px-4 py-2 bg-gaming-yellow text-gaming-black font-bold rounded-lg hover:bg-gaming-yellow-dark transition-colors"
          >
            {t('scans.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-black p-3 sm:p-6">
      {/* Enhanced Header with Collapsible Functionality */}
      <div className="mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-gaming-yellow/20 to-gaming-purple/20 rounded-xl border border-gaming-yellow/50 shadow-lg">
              <Scan className="text-gaming-yellow" size={32} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gaming-yellow bg-gradient-to-r from-gaming-yellow to-gaming-purple bg-clip-text">
                {t('scans.title')}
              </h1>
              <p className="text-gaming-purple flex items-center gap-2">
                <BarChart3 size={16} />
                {t('scans.subtitle')} - {filteredInvoices.length} of {invoices.length} scans
              </p>
            </div>
            {/* Collapse/Expand Button */}
            <button
              onClick={() => setHeaderCollapsed(!headerCollapsed)}
              className="p-2 bg-gaming-gray border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-all group"
              title={headerCollapsed ? t('scans.expandHeader') : t('scans.collapseHeader')}
            >
              {headerCollapsed ? (
                <ChevronDown className="text-gaming-yellow group-hover:text-gaming-yellow" size={20} />
              ) : (
                <ChevronUp className="text-gaming-yellow group-hover:text-gaming-yellow" size={20} />
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:space-x-4">
            {/* Export Button */}
            <button
              onClick={() => {
                const exportData = filteredInvoices.map(invoice => ({
                  invoice_number: invoice.invoice_number || invoice.id,
                  vendor: invoice.vendor || t('common.notAvailable'),
                  date: new Date(invoice.created_at || invoice.timestamp).toLocaleDateString(),
                  items: invoice.items?.length || invoice.item_count || 0,
                  total: parseFloat(invoice.total || invoice.amount || 0).toFixed(2),
                  status: invoice.status || 'processing',
                  source: invoice.source || t('common.unknown'),
                  processing_time: invoice.processing_time ? `${parseFloat(invoice.processing_time).toFixed(1)}s` : t('common.notAvailable')
                }));
                
                const csv = [
                  [t('scans.csvHeaders.invoiceNumber'), t('scans.csvHeaders.vendor'), t('scans.csvHeaders.date'), t('scans.csvHeaders.items'), t('scans.csvHeaders.total'), t('scans.csvHeaders.status'), t('scans.csvHeaders.source'), t('scans.csvHeaders.processingTime')],
                  ...exportData.map(row => [
                    row.invoice_number,
                    row.vendor,
                    row.date,
                    row.items,
                    row.total,
                    row.status,
                    row.source,
                    row.processing_time
                  ])
                ].map(row => row.join(',')).join('\n');
                
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-scans-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="p-2.5 sm:p-3 bg-gradient-to-r from-gaming-purple/20 to-gaming-yellow/20 border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-all hover:scale-105 hover:shadow-lg"
              title={t('scans.exportToCsv')}
            >
              <Download className="text-gaming-yellow" size={18} />
            </button>
            
            {/* View Mode Toggle */}
            <div className="flex bg-gaming-gray border border-gaming-purple/30 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-gaming-yellow text-gaming-black' : 'text-gaming-purple hover:text-gaming-yellow'}`}
              >
                <Layers size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-gaming-yellow text-gaming-black' : 'text-gaming-purple hover:text-gaming-yellow'}`}
              >
                <Receipt size={16} />
              </button>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2.5 sm:p-3 bg-gaming-gray border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-all ${refreshing ? 'animate-spin' : ''} hover:scale-105`}
            >
              <RefreshCw className="text-gaming-yellow" size={18} />
            </button>
            
            <div className="bg-gradient-to-br from-gaming-gray to-gaming-gray/80 border border-gaming-purple/30 rounded-lg px-4 py-2 shadow-lg">
              <div className="flex items-center space-x-2">
                <Trophy className="text-gaming-yellow" size={20} />
                <div>
                  <p className="text-gaming-purple text-xs">{t('scans.totalScans')}</p>
                  <p className="text-2xl font-bold text-gaming-yellow">{filteredInvoices.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Content: Search, Filters, and Stats */}
        <div className={`transition-all duration-300 overflow-hidden ${headerCollapsed ? 'max-h-0' : 'max-h-[1000px]'}`}>
          {/* Enhanced Search and Filters */}
          <div className="bg-gaming-gray/50 border border-gaming-purple/20 rounded-xl p-6 mb-6 backdrop-blur-sm">
          <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
            {/* Search */}
            <div className="lg:col-span-2 xl:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gaming-purple" size={18} />
              <input
                type="text"
                placeholder={t('scans.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gaming-purple/60 focus:border-gaming-yellow focus:ring-2 focus:ring-gaming-yellow/20 transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow focus:border-gaming-yellow transition-all appearance-none cursor-pointer"
              >
                <option value="all">{t('scans.allStatus')}</option>
                <option value="success">✅ {t('scans.success')}</option>
                <option value="completed">✅ {t('common.completed')}</option>
                <option value="pending">⏳ {t('scans.pending')}</option>
                <option value="processing">🔄 {t('scans.processing')}</option>
                <option value="failed">❌ {t('scans.failed')}</option>
              </select>
              <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gaming-purple pointer-events-none" size={18} />
            </div>

            {/* Source Filter */}
            <div className="relative">
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full p-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow focus:border-gaming-yellow transition-all appearance-none cursor-pointer"
              >
                <option value="all">{t('scans.allSources')}</option>
                <option value="mobile_app">📱 {t('scans.mobile')}</option>
                <option value="desktop_app">🖥️ {t('scans.desktop')}</option>
              </select>
              <Building2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gaming-purple pointer-events-none" size={18} />
            </div>

            {/* Date Filter */}
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full p-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow focus:border-gaming-yellow transition-all appearance-none cursor-pointer"
              >
                <option value="all">{t('scans.allTime')}</option>
                <option value="today">{t('scans.today')}</option>
                <option value="week">{t('scans.lastWeek')}</option>
                <option value="month">{t('scans.lastMonth')}</option>
              </select>
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gaming-purple pointer-events-none" size={18} />
            </div>

            {/* Sort Controls */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 p-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow focus:border-gaming-yellow transition-all appearance-none cursor-pointer text-sm"
              >
                <option value="date">{t('scans.date')}</option>
                <option value="vendor">{t('scans.vendor')}</option>
                <option value="amount">{t('scans.amount')}</option>
                <option value="items">{t('scans.items')}</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-3 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-purple hover:text-gaming-yellow hover:border-gaming-yellow transition-all"
                title={`Sort ${sortOrder === 'asc' ? t('scans.sortDescending') : t('scans.sortAscending')}`}
              >
                <TrendingUp className={`transform transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} size={18} />
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-gaming-purple">
              <CheckCircle size={16} className="text-green-400" />
              <span>{statistics.success} {t('scans.success')}</span>
            </div>
            <div className="flex items-center gap-2 text-gaming-purple">
              <Clock size={16} className="text-yellow-400" />
              <span>{statistics.pending} {t('scans.pending')}</span>
            </div>
            <div className="flex items-center gap-2 text-gaming-purple">
              <Smartphone size={16} className="text-blue-400" />
              <span>{statistics.mobile} {t('scans.mobile')}</span>
            </div>
            <div className="flex items-center gap-2 text-gaming-purple">
              <Monitor size={16} className="text-purple-400" />
              <span>{statistics.desktop} {t('scans.desktop')}</span>
            </div>
            <div className="flex items-center gap-2 text-gaming-purple">
              <DollarSign size={16} className="text-gaming-yellow" />
              <span>{formatCurrency(statistics.totalValue)} {t('scans.total')}</span>
            </div>
            <div className="flex items-center gap-2 text-gaming-purple">
              <Package size={16} className="text-gaming-yellow" />
              <span>{statistics.totalItems.toLocaleString()} {t('scans.items')}</span>
            </div>
          </div>
        </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-900/20 to-gaming-gray border border-green-500/30 rounded-xl p-3 sm:p-4 hover:animate-glow transition-all hover:scale-105 cursor-pointer shadow-lg">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="text-green-400" size={18} />
              </div>
              <span className="text-green-400 text-xs sm:text-sm font-medium hidden sm:inline">{t('scans.success')}</span>
              <span className="text-green-400 text-xs font-medium sm:hidden">✓</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gaming-yellow mb-1">
              {statistics.success}
            </p>
            <p className="text-gaming-purple text-xs flex items-center gap-1">
              <TrendingUp size={12} />
              <span className="hidden sm:inline">{statistics.total > 0 ? Math.round((statistics.success / statistics.total) * 100) : 0}% success rate</span>
              <span className="sm:hidden">{statistics.total > 0 ? Math.round((statistics.success / statistics.total) * 100) : 0}%</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-yellow-900/20 to-gaming-gray border border-yellow-500/30 rounded-xl p-3 sm:p-4 hover:animate-glow transition-all hover:scale-105 cursor-pointer shadow-lg">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-lg">
                <Clock className="text-yellow-400" size={18} />
              </div>
              <span className="text-yellow-400 text-xs sm:text-sm font-medium hidden sm:inline">{t('scans.pending')}</span>
              <span className="text-yellow-400 text-xs font-medium sm:hidden">⏳</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gaming-yellow mb-1">
              {statistics.pending}
            </p>
            <p className="text-gaming-purple text-xs flex items-center gap-1">
              <Activity size={12} />
              <span className="hidden sm:inline">{t('scans.inQueue')}</span>
              <span className="sm:hidden">{t('scans.queue')}</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-gaming-purple/20 to-gaming-gray border border-gaming-purple/50 rounded-xl p-3 sm:p-4 hover:animate-glow transition-all hover:scale-105 cursor-pointer shadow-lg">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-gaming-purple/20 rounded-lg">
                <DollarSign className="text-gaming-purple" size={18} />
              </div>
              <span className="text-gaming-purple text-xs sm:text-sm font-medium hidden sm:inline">{t('scans.total')}</span>
              <span className="text-gaming-purple text-xs font-medium sm:hidden">$</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gaming-yellow mb-1">
              {formatCurrency(statistics.totalValue)}
            </p>
            <p className="text-gaming-purple text-xs flex items-center gap-1">
              <BarChart3 size={12} />
              <span className="hidden sm:inline">{t('scans.totalItemsCount', {count: statistics.totalItems.toLocaleString()})}</span>
              <span className="sm:hidden">{t('scans.itemsCount', {count: statistics.totalItems.toLocaleString()})}</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-gaming-yellow/20 to-gaming-gray border border-gaming-yellow/50 rounded-xl p-3 sm:p-4 hover:animate-glow transition-all hover:scale-105 cursor-pointer shadow-lg">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="p-1.5 sm:p-2 bg-gaming-yellow/20 rounded-lg">
                <Zap className="text-gaming-yellow" size={18} />
              </div>
              <span className="text-gaming-yellow text-xs sm:text-sm font-medium hidden sm:inline">{t('scans.today')}</span>
              <span className="text-gaming-yellow text-xs font-medium sm:hidden">📅</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gaming-yellow mb-1">
              {invoices.filter(i => {
                const today = new Date().toDateString();
                return new Date(i.created_at).toDateString() === today;
              }).length}
            </p>
            <p className="text-gaming-purple text-xs flex items-center gap-1">
              <Calendar size={12} />
              <span className="hidden sm:inline">{t('scans.scansToday')}</span>
              <span className="sm:hidden">{t('scans.today')}</span>
            </p>
          </div>
        </div>
        </div>
        {/* End of Collapsible Content */}
        
        {/* Quick Stats Summary when collapsed */}
        {headerCollapsed && (
          <div className="bg-gaming-gray/50 border border-gaming-purple/20 rounded-lg p-3 mb-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gaming-purple">{t('scans.total')}:</span>
                <span className="text-gaming-yellow font-bold">{filteredInvoices.length}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-green-400">✅ {statistics.success}</span>
                <span className="text-yellow-400">⏳ {statistics.pending}</span>
                <span className="text-gaming-yellow">{formatCurrency(statistics.totalValue)}</span>
              </div>
              <button
                onClick={() => setHeaderCollapsed(false)}
                className="text-gaming-purple hover:text-gaming-yellow transition-colors flex items-center gap-1"
              >
                <Filter size={14} />
                <span>{t('scans.showFilters')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-gradient-to-br from-gaming-gray/80 to-gaming-black border border-gaming-purple/30 rounded-xl p-12 text-center shadow-2xl">
          <div className="mb-6">
            {invoices.length === 0 ? (
              <Receipt className="text-gaming-purple mx-auto mb-4" size={64} />
            ) : (
              <Search className="text-gaming-purple mx-auto mb-4" size={64} />
            )}
          </div>
          <h3 className="text-gaming-yellow text-2xl font-bold mb-3">
            {invoices.length === 0 ? t('scans.noRecentScans') : t('scans.noMatchingScans')}
          </h3>
          <p className="text-gaming-purple text-lg">
            {invoices.length === 0 ? t('scans.startScanning') : t('scans.tryAdjustingFilters')}
          </p>
          {filteredInvoices.length !== invoices.length && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('all');
                setSelectedSource('all');
                setDateFilter('all');
              }}
              className="mt-4 px-6 py-3 bg-gaming-yellow text-gaming-black font-bold rounded-lg hover:bg-gaming-yellow-dark transition-colors"
            >
              {t('scans.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 xl:grid-cols-2 gap-6' : 'space-y-3'}`}>
          {filteredInvoices.map((invoice) => {
            const statusInfo = getStatusBadge(invoice.status);
            const StatusIcon = statusInfo.icon;
            
            if (viewMode === 'list') {
              // Compact List View Layout
              return (
                <div
                  key={invoice.id}
                  className="bg-gradient-to-r from-gaming-gray/90 to-gaming-gray/70 border border-gaming-purple/30 rounded-xl p-4 hover:border-gaming-yellow/50 transition-all hover:shadow-xl group backdrop-blur-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    {/* Left Section: Icon + Basic Info */}
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                      <div className="p-2.5 bg-gradient-to-br from-gaming-yellow/20 to-gaming-purple/20 rounded-lg border border-gaming-yellow/30 shadow-md group-hover:scale-105 transition-transform">
                        <Receipt className="text-gaming-yellow" size={18} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-gaming-yellow font-bold text-lg bg-gradient-to-r from-gaming-yellow to-gaming-purple bg-clip-text truncate">
                            {t('scans.invoice')} #{invoice.invoice_number || invoice.id.slice(0, 8)}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${statusInfo.class} font-medium shadow-sm`}>
                            <StatusIcon size={12} />
                            <span>{invoice.status || t('scans.processing')}</span>
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gaming-purple">
                          <span className="flex items-center gap-1">
                            <Building size={14} />
                            {invoice.vendor || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(invoice.created_at || invoice.timestamp).toLocaleDateString()}
                          </span>
                          {invoice.source && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              invoice.source === 'mobile' ? 'bg-gaming-purple/20 text-gaming-purple' : 'bg-gaming-yellow/20 text-gaming-yellow'
                            }`}>
                              {invoice.source === 'mobile' ? `📱 ${t('scans.mobile')}` : `🖥️ ${t('scans.desktop')}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Stats */}
                    <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap sm:flex-nowrap">
                      <div className="text-center">
                        <div className="text-gaming-yellow font-bold text-base sm:text-lg">
                          {invoice.items?.length || invoice.item_count || 0}
                        </div>
                        <div className="text-gaming-purple text-xs">{t('scans.items')}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-gaming-yellow font-bold text-base sm:text-lg">
                          ${parseFloat(invoice.total || invoice.amount || 0).toFixed(2)}
                        </div>
                        <div className="text-gaming-purple text-xs">{t('scans.total')}</div>
                      </div>
                      
                      {invoice.processing_time && (
                        <div className="text-center hidden sm:block">
                          <div className="text-gaming-purple font-medium text-sm">
                            {parseFloat(invoice.processing_time).toFixed(1)}s
                          </div>
                          <div className="text-gaming-purple text-xs">{t('scans.processing')}</div>
                        </div>
                      )}
                    </div>

                    {/* Right Section: Actions */}
                    <div className="flex items-center gap-2">
                      {(invoice.images?.length > 0 || invoice.invoice_image_path || invoice.invoiceImagePath || invoice.invoice_image_url || invoice.has_invoice_image) && (
                        <div className="flex items-center gap-1">
                          {invoice.image_count > 1 && (
                            <span className="bg-gaming-purple px-1.5 py-0.5 text-xs text-white rounded-full">
                              {invoice.image_count}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              if (invoice.images && invoice.images.length > 0) {
                                const formattedImages = invoice.images.map(img => ({
                                  url: img.url || getImageUrl(img.path),
                                  path: img.path,
                                  page: img.page,
                                  type: img.type
                                }));
                                console.log('List view - Opening multi-image modal:', formattedImages);
                                openImageModal(formattedImages, invoice.invoice_number);
                              } else {
                                let singleImage = null;
                                // Use already processed URLs from API
                                singleImage = invoice.invoice_image_url || 
                                             invoice.invoiceImageUrl || 
                                             invoice.invoice_image_path || 
                                             invoice.invoiceImagePath;
                                
                                if (singleImage) {
                                  console.log('List view - Opening single image modal:', singleImage);
                                  openImageModal([{ url: singleImage, path: singleImage, page: 1, type: 'main' }], invoice.invoice_number);
                                } else {
                                  console.warn('List view - No image available for invoice:', invoice.invoice_number);
                                }
                              }
                            }}
                            className="p-2 bg-gaming-black/50 border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-colors"
                            title={invoice.image_count > 1 ? t('scans.viewImages') : t('scans.viewImage')}
                          >
                            {invoice.image_count > 1 ? (
                              <ImagesIcon className="text-gaming-yellow" size={16} />
                            ) : (
                              <Image className="text-gaming-yellow" size={16} />
                            )}
                          </button>
                        </div>
                      )}
                      
                      <button
                        onClick={() => openDetailsModal(invoice)}
                        className="p-2 bg-gradient-to-r from-gaming-yellow/20 to-gaming-purple/20 border border-gaming-yellow/30 rounded-lg hover:from-gaming-yellow/30 hover:to-gaming-purple/30 transition-all shadow-md hover:shadow-lg"
                        title={t('scans.viewDetails')}
                      >
                        <Info className="text-gaming-yellow" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            
            // Grid View Layout (existing)
            return (
              <div
                key={invoice.id}
                className="bg-gradient-to-br from-gaming-gray/90 to-gaming-gray/70 border border-gaming-purple/30 rounded-2xl p-6 hover:border-gaming-yellow/50 transition-all hover:animate-glow hover:scale-[1.02] hover:shadow-2xl group backdrop-blur-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="p-3 bg-gradient-to-br from-gaming-yellow/20 to-gaming-purple/20 rounded-xl border border-gaming-yellow/30 shadow-lg group-hover:scale-110 transition-transform">
                        <Receipt className="text-gaming-yellow" size={22} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-gaming-yellow font-bold text-xl bg-gradient-to-r from-gaming-yellow to-gaming-purple bg-clip-text">
                            {t('scans.invoice')} #{invoice.invoice_number || invoice.id.slice(0, 8)}
                          </h3>
                          <span className={`px-3 py-1.5 rounded-full border text-xs flex items-center space-x-1.5 ${statusInfo.class} font-medium shadow-lg`}>
                            <StatusIcon size={14} />
                            <span>{invoice.status || t('scans.processing')}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 size={14} className="text-gaming-purple" />
                          <p className="text-gaming-purple text-sm font-medium">
                            {invoice.vendor_name || t('scans.unknownVendor')}
                          </p>
                          {/* Source indicator */}
                          <div className="flex items-center gap-1 ml-2">
                            {invoice.source === 'mobile_app' ? (
                              <><Smartphone size={12} className="text-blue-400" /><span className="text-blue-400 text-xs">{t('scans.mobile')}</span></>
                            ) : (
                              <><Monitor size={12} className="text-purple-400" /><span className="text-purple-400 text-xs">{t('scans.desktop')}</span></>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Information Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="bg-gaming-black/30 rounded-lg p-3 border border-gaming-purple/20 hover:border-gaming-purple/40 transition-colors">
                        <div className="flex items-center space-x-2 mb-1">
                          <Calendar className="text-gaming-purple" size={16} />
                          <p className="text-gaming-purple text-xs font-medium">{t('scans.date')}</p>
                        </div>
                        <p className="text-gaming-yellow text-sm font-bold">
                          {formatDate(invoice.invoice_date || invoice.created_at)}
                        </p>
                      </div>

                      <div className="bg-gaming-black/30 rounded-lg p-3 border border-gaming-purple/20 hover:border-gaming-yellow/40 transition-colors">
                        <div className="flex items-center space-x-2 mb-1">
                          <DollarSign className="text-gaming-yellow" size={16} />
                          <p className="text-gaming-purple text-xs font-medium">{t('scans.amount')}</p>
                        </div>
                        <p className="text-gaming-yellow text-lg font-bold">
                          {formatCurrency(
                            invoice.total_amount || 
                            invoice.totals_data?.invoiceTotal || 
                            invoice.totals_data?.total || 
                            0
                          )}
                        </p>
                      </div>

                      <div className="bg-gaming-black/30 rounded-lg p-3 border border-gaming-purple/20 hover:border-gaming-purple/40 transition-colors">
                        <div className="flex items-center space-x-2 mb-1">
                          <Package className="text-gaming-purple" size={16} />
                          <p className="text-gaming-purple text-xs font-medium">{t('scans.items')}</p>
                        </div>
                        <p className="text-gaming-yellow text-sm font-bold">
                          {(invoice.total_items || invoice.items?.length || 0).toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-gaming-black/30 rounded-lg p-3 border border-gaming-purple/20 hover:border-gaming-purple/40 transition-colors">
                        <div className="flex items-center space-x-2 mb-1">
                          {invoice.customer_name ? (
                            <>
                              <User className="text-gaming-purple" size={16} />
                              <p className="text-gaming-purple text-xs font-medium">{t('scans.customer')}</p>
                            </>
                          ) : (
                            <>
                              <Activity className="text-gaming-purple" size={16} />
                              <p className="text-gaming-purple text-xs font-medium">{t('scans.processing')}</p>
                            </>
                          )}
                        </div>
                        <p className="text-gaming-yellow text-sm font-bold">
                          {invoice.customer_name || 
                           (invoice.processingMethod === 'content_understanding' ? t('scans.aiEnhanced') : t('scans.standard'))}
                        </p>
                      </div>
                    </div>

                    {/* Processing Notes */}
                    {invoice.processing_notes && (
                      <div className="mt-4 pt-4 border-t border-gaming-purple/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-gaming-purple text-sm">{t('errors.processingNotes')}</p>
                          <TrendingUp className="text-gaming-yellow" size={16} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-gaming-purple text-sm">{invoice.processing_notes}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Quality Analysis */}
                    {invoice.quality_analysis && (
                      <div className="mt-4 pt-4 border-t border-gaming-purple/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-gaming-purple text-sm">{t('imageViewer.qualityAnalysis')}</p>
                          <CheckCircle className="text-green-400" size={16} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {invoice.quality_analysis.imageQuality && (
                            <div className="text-gaming-purple">
                              {t('imageViewer.imageQuality')}: <span className="text-gaming-yellow">{invoice.quality_analysis.imageQuality}</span>
                            </div>
                          )}
                          {invoice.quality_analysis.processingTime && (
                            <div className="text-gaming-purple">
                              Processing: <span className="text-gaming-yellow">{invoice.quality_analysis.processingTime}ms</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Enhanced Action Buttons */}
                    <div className="mt-4 pt-4 border-t border-gaming-purple/20">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          {invoice.items && invoice.items.length > 0 && (
                            <button
                              onClick={() => openDetailsModal(invoice)}
                              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gaming-purple/20 to-gaming-purple/10 text-gaming-purple hover:from-gaming-purple/30 hover:to-gaming-purple/20 hover:text-gaming-yellow rounded-lg transition-all border border-gaming-purple/30 hover:border-gaming-yellow/50 shadow-lg hover:shadow-xl"
                            >
                              <Package size={16} />
                              <span className="font-medium">{t('scans.viewItems')} ({invoice.items.length})</span>
                              <ArrowRight size={14} />
                            </button>
                          )}
                          
                          {invoice.processingMethod === 'content_understanding' && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-900/30 to-emerald-900/20 text-green-400 rounded-full text-xs border border-green-500/30 shadow-lg">
                              <Zap size={12} />
                              <span className="font-semibold">{t('scans.aiEnhanced')}</span>
                            </div>
                          )}
                          
                          {/* Quality indicators */}
                          {invoice.quality_analysis && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-900/30 to-cyan-900/20 text-blue-400 rounded-full text-xs border border-blue-500/30 shadow-lg">
                              <BarChart3 size={12} />
                              <span className="font-semibold">{t('scans.qualityChecked')}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-gaming-black/50 rounded-lg border border-gaming-purple/20">
                            {invoice.source === 'mobile_app' ? (
                              <>
                                <Smartphone size={14} className="text-blue-400" />
                                <span className="text-blue-400 text-xs font-medium">{t('scans.mobile')}</span>
                              </>
                            ) : (
                              <>
                                <Monitor size={14} className="text-purple-400" />
                                <span className="text-purple-400 text-xs font-medium">{t('scans.desktop')}</span>
                              </>
                            )}
                          </div>
                          
                          {/* Processing time indicator */}
                          {invoice.quality_analysis?.processingTime && (
                            <div className="text-xs text-gaming-purple/80 flex items-center gap-1">
                              <Clock size={12} />
                              {invoice.quality_analysis.processingTime}ms
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(invoice.images?.length > 0 || invoice.invoice_image_path || invoice.invoiceImagePath || invoice.invoice_image_url || invoice.has_invoice_image) && (
                    <div className="ml-4 flex items-center gap-2">
                      {invoice.image_count > 1 && (
                        <span className="bg-gaming-purple px-2 py-1 text-xs text-white rounded-full">
                          {invoice.image_count} {t('scans.images')}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          if (invoice.images && invoice.images.length > 0) {
                            // Use new multiple images format
                            const formattedImages = invoice.images.map(img => ({
                              url: img.url || getImageUrl(img.path),
                              path: img.path,
                              page: img.page,
                              type: img.type
                            }));
                            openImageModal(formattedImages, invoice.invoice_number);
                          } else {
                            // FIXED: Use direct URLs like mobile app - copy mobile app logic exactly
                            let singleImage = null;
                            
                            // Debug logging
                            console.log('Grid view - Invoice image data:', {
                              invoice_image_url: invoice.invoice_image_url,
                              invoiceImageUrl: invoice.invoiceImageUrl,
                              invoice_image_path: invoice.invoice_image_path,
                              invoiceImagePath: invoice.invoiceImagePath,
                              images: invoice.images
                            });
                            
                            // Use already processed URLs from API (they're already passed through getImageUrl)
                            singleImage = invoice.invoice_image_url || 
                                         invoice.invoiceImageUrl || 
                                         invoice.invoice_image_path || 
                                         invoice.invoiceImagePath;
                            
                            if (singleImage) {
                              console.log('Grid view - Using processed image URL:', singleImage);
                            }
                            
                            if (singleImage) {
                              console.log('Opening image modal with URL:', singleImage);
                              openImageModal([{ url: singleImage, path: singleImage, page: 1, type: 'main' }], invoice.invoice_number);
                            } else {
                              console.warn('No image URL available for invoice:', invoice.invoice_number);
                            }
                          }
                        }}
                        className="p-3 bg-gaming-black border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-colors group-hover:animate-pulse"
                        title={invoice.image_count > 1 ? t('scans.viewImages') : t('scans.viewImage')}
                      >
                        {invoice.image_count > 1 ? (
                          <ImagesIcon className="text-gaming-yellow" size={20} />
                        ) : (
                          <Image className="text-gaming-yellow" size={20} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Gallery Modal */}
      {imageModal.open && imageModal.images.length > 0 && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-5xl max-h-[95vh] w-full">
            {/* Close Button */}
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 p-2 bg-gaming-yellow text-gaming-black rounded-lg hover:bg-gaming-yellow-dark transition-colors z-20"
            >
              <X size={24} />
            </button>

            {/* Image Counter */}
            {imageModal.images.length > 1 && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-gaming-gray/80 text-gaming-yellow rounded-lg z-20">
                {imageModal.currentIndex + 1} / {imageModal.images.length}
              </div>
            )}

            {/* Navigation Arrows */}
            {imageModal.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-gaming-gray/80 text-gaming-yellow rounded-full hover:bg-gaming-yellow hover:text-gaming-black transition-all z-20"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-gaming-gray/80 text-gaming-yellow rounded-full hover:bg-gaming-yellow hover:text-gaming-black transition-all z-20"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            {/* Main Image Display */}
            <div className="bg-gaming-gray border border-gaming-yellow/50 rounded-xl p-2 overflow-auto max-h-[90vh]">
              <div className="flex flex-col items-center">
                {/* Image Info */}
                {imageModal.images.length > 1 && (
                  <div className="w-full mb-2 p-2 bg-gaming-black rounded-lg">
                    <div className="flex justify-between text-sm text-gaming-purple">
                      <span>Page {imageModal.images[imageModal.currentIndex].page}</span>
                      <span className="capitalize">{imageModal.images[imageModal.currentIndex].type}</span>
                    </div>
                  </div>
                )}
                
                {/* Current Image */}
                <img
                  src={imageModal.images[imageModal.currentIndex].url}
                  alt={`${t('scans.invoice')} ${imageModal.invoiceNumber} - Page ${imageModal.images[imageModal.currentIndex].page}`}
                  className="max-w-full max-h-[80vh] rounded-lg object-contain"
                  onError={(e) => {
                    console.error('Image load error - URL:', e.target.src);
                    console.error('Image modal state:', imageModal);
                    // Instead of hiding, show error placeholder
                    e.target.onerror = null; // Prevent infinite loop
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiNhYWEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBMb2FkIEVycm9yPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              </div>
            </div>

            {/* Thumbnail Navigation */}
            {imageModal.images.length > 1 && (
              <div className="mt-4 flex justify-center gap-2 flex-wrap max-h-24 overflow-y-auto">
                {imageModal.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setImageModal(prev => ({ ...prev, currentIndex: index }))}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      index === imageModal.currentIndex
                        ? 'border-gaming-yellow shadow-lg'
                        : 'border-gaming-gray hover:border-gaming-purple'
                    }`}
                  >
                    <img
                      src={image.url}
                      alt={`Page ${image.page}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5">
                      {image.page}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {detailsModal.open && detailsModal.invoice && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gaming-gray border border-gaming-yellow/50 rounded-xl max-w-4xl max-h-[90vh] overflow-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gaming-purple/30">
              <div className="flex items-center gap-3">
                <Receipt className="text-gaming-yellow" size={24} />
                <div>
                  <h2 className="text-gaming-yellow text-xl font-bold">
                    {t('scans.invoice')} #{detailsModal.invoice.invoice_number}
                  </h2>
                  <p className="text-gaming-purple text-sm">
                    {detailsModal.invoice.vendor_name || t('scans.unknownVendor')}
                  </p>
                </div>
              </div>
              <button
                onClick={closeDetailsModal}
                className="p-2 bg-gaming-yellow text-gaming-black rounded-lg hover:bg-gaming-yellow-dark transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Summary Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gaming-black rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-gaming-purple" size={16} />
                    <span className="text-gaming-purple text-sm">{t('scans.date')}</span>
                  </div>
                  <p className="text-gaming-yellow font-medium">
                    {formatDate(detailsModal.invoice.invoice_date || detailsModal.invoice.created_at)}
                  </p>
                </div>
                
                <div className="bg-gaming-black rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="text-gaming-purple" size={16} />
                    <span className="text-gaming-purple text-sm">{t('scans.items')}</span>
                  </div>
                  <p className="text-gaming-yellow font-medium">
                    {detailsModal.invoice.total_items || detailsModal.invoice.items?.length || 0}
                  </p>
                </div>
                
                <div className="bg-gaming-black rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="text-gaming-purple" size={16} />
                    <span className="text-gaming-purple text-sm">{t('scans.total')}</span>
                  </div>
                  <p className="text-gaming-yellow font-bold text-lg">
                    {formatCurrency(
                      detailsModal.invoice.total_amount || 
                      detailsModal.invoice.totals_data?.invoiceTotal || 
                      0
                    )}
                  </p>
                </div>
              </div>

              {/* Items List */}
              {detailsModal.invoice.items && detailsModal.invoice.items.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="text-gaming-yellow" size={20} />
                    <h3 className="text-gaming-yellow text-lg font-bold">
                      {t('scans.lineItems')} ({detailsModal.invoice.items.length})
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    {detailsModal.invoice.items.map((item, idx) => (
                      <div key={idx} className="bg-gaming-black rounded-lg p-4 border border-gaming-purple/20">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-gaming-yellow font-medium text-sm mb-2">
                              {item.description || item.name || `${t('scans.item')} ${idx + 1}`}
                            </h4>
                            
                            {item.productCode && (
                              <p className="text-gaming-purple text-xs mb-2">
                                {t('scans.code')}: {item.productCode}
                              </p>
                            )}
                            
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="text-gaming-purple">{t('scans.quantity')}:</span>
                                <span className="text-gaming-yellow ml-2 font-medium">
                                  {item.quantity || 1}
                                </span>
                              </div>
                              <div>
                                <span className="text-gaming-purple">{t('scans.unitPrice')}:</span>
                                <span className="text-gaming-yellow ml-2 font-medium">
                                  {formatCurrency(item.unitPrice || 0)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gaming-purple">{t('scans.total')}:</span>
                                <span className="text-gaming-yellow ml-2 font-bold">
                                  {formatCurrency(item.totalPrice || item.amount || 0)}
                                </span>
                              </div>
                            </div>

                            {/* Low confidence warning */}
                            {item.confidence && item.confidence < 0.7 && (
                              <div className="mt-2">
                                <span className="inline-flex items-center gap-1 bg-red-900/30 text-red-400 px-2 py-1 rounded-full text-xs">
                                  <AlertCircle size={12} />
                                  {t('scans.lowConfidence')}: {(item.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Information */}
              {(detailsModal.invoice.additionalFields && Object.keys(detailsModal.invoice.additionalFields).length > 0) && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="text-gaming-yellow" size={20} />
                    <h3 className="text-gaming-yellow text-lg font-bold">
                      {t('scans.additionalInfo')}
                    </h3>
                  </div>
                  
                  <div className="bg-gaming-black rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(detailsModal.invoice.additionalFields).map(([key, value], idx) => (
                        <div key={idx} className="flex justify-between py-1">
                          <span className="text-gaming-purple text-sm">{key}:</span>
                          <span className="text-gaming-yellow text-sm">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Totals */}
              {detailsModal.invoice.totals_data && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="text-gaming-yellow" size={20} />
                    <h3 className="text-gaming-yellow text-lg font-bold">
                      {t('scans.invoiceTotals')}
                    </h3>
                  </div>
                  
                  <div className="bg-gaming-black rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {detailsModal.invoice.totals_data.invoiceSubTotal && (
                        <div className="text-center">
                          <p className="text-gaming-purple text-sm">{t('scans.subtotal')}</p>
                          <p className="text-gaming-yellow text-lg font-medium">
                            {formatCurrency(detailsModal.invoice.totals_data.invoiceSubTotal)}
                          </p>
                        </div>
                      )}
                      {detailsModal.invoice.totals_data.invoiceTotalTax !== undefined && (
                        <div className="text-center">
                          <p className="text-gaming-purple text-sm">{t('scans.tax')}</p>
                          <p className="text-gaming-yellow text-lg font-medium">
                            {formatCurrency(detailsModal.invoice.totals_data.invoiceTotalTax)}
                          </p>
                        </div>
                      )}
                      {detailsModal.invoice.totals_data.invoiceTotal && (
                        <div className="text-center">
                          <p className="text-gaming-purple text-sm">{t('scans.total')}</p>
                          <p className="text-gaming-yellow text-xl font-bold">
                            {formatCurrency(detailsModal.invoice.totals_data.invoiceTotal)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}