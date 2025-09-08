import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiOperations } from '../utils/api';
import { formatPrice, formatCompactPrice } from '../utils/currency';
import apiConfig from '../utils/apiConfig';
import {
  ShoppingCart,
  Calendar,
  DollarSign,
  Package,
  User,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Check,
  X,
  Clock,
  Hash,
  CreditCard,
  Receipt,
  RefreshCw,
  Eye,
  Trophy
} from 'lucide-react';

const RecentSalesPage = () => {
  const { t } = useTranslation();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedSale, setSelectedSale] = useState(null);
  const [stats, setStats] = useState({
    totalSales: 0,
    todaySales: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    averageSale: 0,
    topProduct: null
  });

  useEffect(() => {
    fetchSales();
    const interval = setInterval(fetchSales, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 Fetching sales data for period:', selectedPeriod);
      // Fetch sales data from the backend
      const response = await apiOperations.getSales(selectedPeriod);
      console.log('📊 Sales API response:', response);
      
      if (response.success) {
        console.log('✅ Sales data received:', response.sales?.length || 0, 'sales');
        // Transform the API response to match our component's expected format
        const transformedSales = (response.sales || []).map(sale => ({
          id: sale.id || sale.transaction_id,
          productName: sale.product_name,
          productBarcode: sale.barcode,
          quantity: sale.quantity,
          unitPrice: sale.unit_price,
          totalPrice: sale.total_price,
          paymentMethod: 'cash', // Default since API doesn't provide this
          timestamp: sale.timestamp,
          invoiceId: sale.transaction_id,
          status: 'completed', // Default since all sales are completed
          customerName: sale.notes?.includes('Customer:') ? sale.notes.split('Customer:')[1] : null,
          discount: 0, // API doesn't provide discount info
          vendorName: sale.vendor_name,
          categoryName: sale.category_name
        }));
        console.log('🔄 Transformed sales:', transformedSales);
        setSales(transformedSales);
        calculateStats(transformedSales);
        if (transformedSales.length === 0) {
          setError(t('sales.noSalesTransactions'));
        }
      } else {
        throw new Error(response.message || 'Failed to fetch sales');
      }
    } catch (err) {
      console.error('❌ Error fetching sales:', err);
      setError(`${t('sales.errorLoadingSales')}: ${err.message}. ${t('sales.mockDataNote')}`);
      // Use mock data for now if API fails
      const mockSales = generateMockSales();
      setSales(mockSales);
      calculateStats(mockSales);
    } finally {
      setLoading(false);
    }
  };

  const createTestData = async () => {
    try {
      console.log('🧪 Creating test sales data...');
      const response = await fetch(`${apiConfig.getBaseUrl()}/sales/create-test-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Test data created:', result.message);
        // Refresh the sales data
        fetchSales();
      } else {
        console.error('❌ Failed to create test data:', result.error);
        setError(result.error || t('sales.failedCreateTestData'));
      }
    } catch (err) {
      console.error('❌ Error creating test data:', err);
      setError(t('sales.failedCreateTestData'));
    }
  };

  const generateMockSales = () => {
    const now = new Date();
    return Array.from({ length: 10 }, (_, i) => ({
      id: `SALE_${Date.now()}_${i}`,
      productName: `Product ${i + 1}`,
      productBarcode: `123456789${i}`,
      quantity: Math.floor(Math.random() * 5) + 1,
      unitPrice: (Math.random() * 100 + 10).toFixed(2),
      totalPrice: ((Math.random() * 100 + 10) * (Math.floor(Math.random() * 5) + 1)).toFixed(2),
      paymentMethod: ['cash', 'card', 'mobile'][Math.floor(Math.random() * 3)],
      timestamp: new Date(now - i * 3600000).toISOString(),
      invoiceId: `INV_${Date.now()}_${i}`,
      status: ['completed', 'pending', 'cancelled'][Math.floor(Math.random() * 3)],
      customerName: `Customer ${i + 1}`,
      discount: Math.random() < 0.3 ? (Math.random() * 10).toFixed(2) : 0
    }));
  };

  const calculateStats = (salesData) => {
    const today = new Date().toDateString();
    const todaysSales = salesData.filter(sale => 
      new Date(sale.timestamp).toDateString() === today
    );

    const totalRevenue = salesData.reduce((sum, sale) => 
      sum + parseFloat(sale.totalPrice || 0), 0
    );
    const todayRevenue = todaysSales.reduce((sum, sale) => 
      sum + parseFloat(sale.totalPrice || 0), 0
    );

    // Find top selling product
    const productCounts = {};
    salesData.forEach(sale => {
      productCounts[sale.productName] = (productCounts[sale.productName] || 0) + sale.quantity;
    });
    const topProduct = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])[0];

    setStats({
      totalSales: salesData.length,
      todaySales: todaysSales.length,
      totalRevenue: totalRevenue.toFixed(2),
      todayRevenue: todayRevenue.toFixed(2),
      averageSale: salesData.length > 0 ? (totalRevenue / salesData.length).toFixed(2) : 0,
      topProduct: topProduct ? { name: topProduct[0], count: topProduct[1] } : null
    });
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = sale.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.productBarcode.includes(searchTerm) ||
                         sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.invoiceId.includes(searchTerm);
    return matchesSearch;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'text-green-400 bg-green-400/10';
      case 'pending': return 'text-yellow-400 bg-yellow-400/10';
      case 'cancelled': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getPaymentIcon = (method) => {
    switch(method) {
      case 'cash': return <DollarSign className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'mobile': return <Receipt className="w-4 h-4" />;
      default: return <DollarSign className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `${t('sales.today')}, ${date.toLocaleTimeString()}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `${t('sales.yesterday')}, ${date.toLocaleTimeString()}`;
    } else {
      return date.toLocaleString();
    }
  };

  return (
    <div className="h-full bg-gaming-black text-white p-6 overflow-hidden">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gaming-purple/20 rounded-xl">
                <ShoppingCart className="w-8 h-8 text-gaming-purple" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{t('sales.title')}</h1>
                <p className="text-gray-400 mt-1">{t('sales.subtitle')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createTestData}
                className="px-4 py-2 bg-gaming-yellow text-black rounded-lg hover:bg-gaming-yellow/80 transition-all flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                {t('sales.createTestData')}
              </button>
              <button
                onClick={fetchSales}
                className="px-4 py-2 bg-gaming-purple text-white rounded-lg hover:bg-gaming-purple/80 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('sales.refresh')}
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gaming-gray rounded-xl p-4 border border-gaming-yellow/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">{t('sales.todaysSales')}</span>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-gaming-yellow">{stats.todaySales}</p>
              <p className="text-sm text-gray-500 mt-1">{formatPrice(stats.todayRevenue)}</p>
            </div>

            <div className="bg-gaming-gray rounded-xl p-4 border border-gaming-purple/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">{t('sales.totalSales')}</span>
                <Package className="w-4 h-4 text-gaming-purple" />
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalSales}</p>
              <p className="text-sm text-gray-500 mt-1">{formatPrice(stats.totalRevenue)}</p>
            </div>

            <div className="bg-gaming-gray rounded-xl p-4 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">{t('sales.averageSale')}</span>
                <DollarSign className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-blue-400">{formatPrice(stats.averageSale)}</p>
              <p className="text-sm text-gray-500 mt-1">{t('sales.perTransaction')}</p>
            </div>

            <div className="bg-gaming-gray rounded-xl p-4 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">{t('sales.topProduct')}</span>
                <Trophy className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-lg font-bold text-green-400 truncate">
                {stats.topProduct ? stats.topProduct.name : 'N/A'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.topProduct ? `${stats.topProduct.count} ${t('sales.sold')}` : t('sales.noSalesYet')}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('sales.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gaming-gray border border-gaming-yellow/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gaming-yellow"
              />
            </div>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 bg-gaming-gray border border-gaming-purple/20 rounded-lg text-white focus:outline-none focus:border-gaming-purple"
            >
              <option value="today">{t('sales.today')}</option>
              <option value="week">{t('sales.thisWeek')}</option>
              <option value="month">{t('sales.thisMonth')}</option>
              <option value="all">{t('sales.allTime')}</option>
            </select>
          </div>
        </div>

        {/* Sales Table */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full bg-gaming-gray rounded-xl border border-gaming-yellow/10 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <RefreshCw className="w-12 h-12 text-gaming-purple animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">{t('sales.loadingSalesData')}</p>
                </div>
              </div>
            ) : error && sales.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-400">{error}</p>
                </div>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">{t('sales.noSalesFound')}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-auto h-full">
                <table className="w-full">
                  <thead className="bg-gaming-black/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('sales.time')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('sales.invoice')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('sales.product')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('sales.customer')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{t('sales.qty')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">{t('common.price')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{t('sales.payment')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{t('sales.status')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gaming-black/50">
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gaming-black/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-300">{formatDate(sale.timestamp)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-mono text-gaming-purple">{sale.invoiceId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-white">{sale.productName}</p>
                            <p className="text-xs text-gray-500 font-mono">{sale.productBarcode}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-300">{sale.customerName || t('sales.walkIn')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="text-sm text-white font-medium">{sale.quantity}</span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gaming-yellow">{formatPrice(sale.totalPrice)}</p>
                            {sale.discount > 0 && (
                              <p className="text-xs text-green-400">-{formatPrice(sale.discount)} {t('sales.off')}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {getPaymentIcon(sale.paymentMethod)}
                            <span className="text-xs text-gray-400 capitalize">
                              {sale.paymentMethod === 'cash' ? t('sales.cash') :
                               sale.paymentMethod === 'card' ? t('sales.card') :
                               sale.paymentMethod === 'mobile' ? t('sales.mobile') :
                               sale.paymentMethod}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sale.status)}`}>
                            {sale.status === 'completed' && <Check className="w-3 h-3 mr-1" />}
                            {sale.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                            {sale.status === 'cancelled' && <X className="w-3 h-3 mr-1" />}
                            {sale.status === 'completed' ? t('sales.completed') :
                             sale.status === 'pending' ? t('sales.pending') :
                             sale.status === 'cancelled' ? t('sales.cancelled') :
                             sale.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => setSelectedSale(sale)}
                            className="text-gaming-purple hover:text-gaming-yellow transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gaming-gray rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{t('sales.saleDetails')}</h3>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm">{t('sales.invoiceId')}</p>
                <p className="text-white font-mono">{selectedSale.invoiceId}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('common.product')}</p>
                <p className="text-white">{selectedSale.productName}</p>
                <p className="text-gray-500 text-sm font-mono">{selectedSale.productBarcode}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-400 text-sm">{t('common.quantity')}</p>
                  <p className="text-white">{selectedSale.quantity}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{t('sales.unitPrice')}</p>
                  <p className="text-white">{formatPrice(selectedSale.unitPrice)}</p>
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('sales.totalAmount')}</p>
                <p className="text-gaming-yellow text-xl font-bold">{formatPrice(selectedSale.totalPrice)}</p>
                {selectedSale.discount > 0 && (
                  <p className="text-green-400 text-sm">{t('sales.discount')}: {formatPrice(selectedSale.discount)}</p>
                )}
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('sales.customer')}</p>
                <p className="text-white">{selectedSale.customerName || t('sales.walkInCustomer')}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('sales.paymentMethod')}</p>
                <p className="text-white capitalize">
                  {selectedSale.paymentMethod === 'cash' ? t('sales.cash') :
                   selectedSale.paymentMethod === 'card' ? t('sales.card') :
                   selectedSale.paymentMethod === 'mobile' ? t('sales.mobile') :
                   selectedSale.paymentMethod}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('sales.dateTime')}</p>
                <p className="text-white">{new Date(selectedSale.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('sales.status')}</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedSale.status)}`}>
                  {selectedSale.status === 'completed' ? t('sales.completed') :
                   selectedSale.status === 'pending' ? t('sales.pending') :
                   selectedSale.status === 'cancelled' ? t('sales.cancelled') :
                   selectedSale.status}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedSale(null)}
              className="mt-6 w-full px-4 py-2 bg-gaming-purple text-white rounded-lg hover:bg-gaming-purple/80 transition-all"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecentSalesPage;