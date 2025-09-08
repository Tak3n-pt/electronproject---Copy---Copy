import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { formatPrice, formatCompactPrice } from '../utils/currency';
import { 
  TrendingUp, 
  TrendingDown,
  Package, 
  ShoppingCart, 
  FileText,
  Calendar,
  Users, 
  Percent, 
  AlertCircle,
  RefreshCw,
  BarChart3,
  PieChart,
  Clock,
  Target,
  Zap,
  Award
} from "lucide-react";
import { apiOperations, handleApiError, fetchWithTimeout } from "../utils/api";
import { apiConfig } from "../utils/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function StatsPage() {
  const { t } = useTranslation();
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedView, setSelectedView] = useState('sales'); // 'sales' or 'invoices'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [salesStats, setSalesStats] = useState({
    revenue: 0,
    profit: 0,
    grossProfit: 0,
    netProfit: 0,
    units: 0,
    transactions: 0,
    avgOrderValue: 0,
    profitMargin: 0,
    grossMargin: 0,
    netMargin: 0,
    totalCost: 0,
    totalInvoiced: 0,
    roi: 0,
    topProducts: [],
    topProfitableProducts: [],
    lowMarginProducts: []
  });

  const [invoiceStats, setInvoiceStats] = useState({
    totalInvoices: 0,
    processedInvoices: 0,
    pendingInvoices: 0,
    avgProcessingTime: 0,
    successRate: 0,
    totalValue: 0
  });

  const [chartData, setChartData] = useState({
    profitWaterfall: null,
    marginDistribution: null,
    costVsPrice: null,
    purchaseVsSales: null,
    profitByProduct: null
  });

  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    totalValue: 0,
    turnoverRate: 0,
    topCategories: []
  });

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [selectedPeriod, selectedView]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let statsData = null;
      if (selectedView === 'sales') {
        statsData = await loadSalesStats();
        await loadInventoryStats(); // Load inventory data for sales view
      } else {
        statsData = await loadInvoiceStats();
      }
      
      await loadChartData(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setError(handleApiError(error, 'Failed to load dashboard statistics'));
    } finally {
      setLoading(false);
    }
  };

  const loadSalesStats = async () => {
    try {
      console.log('📊 Loading sales stats for period:', selectedPeriod);
      
      // Get sales transactions (type = 'sale') from database
      const base = apiConfig.getBaseUrl();
      const response = await fetchWithTimeout(`${base}/api/transactions?type=sale&period=${selectedPeriod}`);
      const data = await response.json();
      const sales = data.transactions || [];
      
      console.log('✅ Sales data loaded:', sales.length, 'transactions');
      
      // Calculate metrics from actual sales transactions
      const revenue = sales.reduce((sum, sale) => sum + parseFloat(sale.total_price || 0), 0);
      const units = sales.reduce((sum, sale) => sum + parseInt(sale.quantity || 0), 0);
      const transactions = sales.length;
      
      // Get all products to access their cost prices
      const productsResponse = await fetchWithTimeout(`${base}/products`);
      const productsData = await productsResponse.json();
      const products = productsData.products || [];
      
      // Create a map for quick product lookup
      const productMap = {};
      products.forEach(p => {
        productMap[p.id] = p;
      });
      
      // Calculate actual costs using real cost_price from database
      let totalCost = 0;
      let totalWithActualCost = 0;
      let salesWithCost = [];
      
      for (const sale of sales) {
        const product = productMap[sale.product_id];
        let costPrice = 0;
        let hasActualCost = false;
        
        if (product && product.cost_price !== null && product.cost_price !== undefined) {
          // Use actual cost price from database
          costPrice = parseFloat(product.cost_price);
          hasActualCost = true;
        } else if (product && product.price) {
          // Fallback: estimate at 60% of selling price (40% margin)
          costPrice = parseFloat(product.price) * 0.6;
        } else {
          // Last resort: use 60% of sale price
          costPrice = parseFloat(sale.total_price || 0) * 0.6 / sale.quantity;
        }
        
        const saleCost = costPrice * sale.quantity;
        totalCost += saleCost;
        if (hasActualCost) {
          totalWithActualCost += saleCost;
        }
        
        // Store sale with cost info for product analysis
        salesWithCost.push({
          ...sale,
          product_name: product?.name || sale.product_name,
          cost_price: costPrice,
          total_cost: saleCost,
          profit: parseFloat(sale.total_price || 0) - saleCost,
          margin: parseFloat(sale.total_price || 0) > 0 ? 
            ((parseFloat(sale.total_price || 0) - saleCost) / parseFloat(sale.total_price || 0) * 100) : 0,
          has_actual_cost: hasActualCost
        });
      }
      
      // Get invoice totals for the period (what we paid to suppliers)
      const invoicesResponse = await fetchWithTimeout(`${base}/invoices/recent`);
      const invoicesData = await invoicesResponse.json();
      const invoices = invoicesData.invoices || [];
      
      // Filter invoices by period
      const now = new Date();
      const filteredInvoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.created_at || invoice.finalized_at);
        switch (selectedPeriod) {
          case 'today':
            return invoiceDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return invoiceDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return invoiceDate >= monthAgo;
          case 'year':
            const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            return invoiceDate >= yearAgo;
          default:
            return true;
        }
      });
      
      const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
      
      // Calculate different profit metrics
      const grossProfit = revenue - totalCost;
      const grossMargin = revenue > 0 ? (grossProfit / revenue * 100) : 0;
      
      // Estimate operating expenses (you can make this configurable)
      const operatingExpenseRate = 0.15; // 15% of revenue for operating expenses
      const operatingExpenses = revenue * operatingExpenseRate;
      const netProfit = grossProfit - operatingExpenses;
      const netMargin = revenue > 0 ? (netProfit / revenue * 100) : 0;
      
      // Calculate ROI (Return on Investment)
      const roi = totalInvoiced > 0 ? ((revenue - totalInvoiced) / totalInvoiced * 100) : 0;
      
      const avgOrderValue = transactions > 0 ? revenue / transactions : 0;

      // Analyze products by profitability
      const productAnalysis = {};
      for (const sale of salesWithCost) {
        const productName = sale.product_name;
        
        if (!productAnalysis[productName]) {
          productAnalysis[productName] = {
            name: productName,
            units: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            transactions: 0,
            avgMargin: 0,
            hasActualCost: false
          };
        }
        
        productAnalysis[productName].units += parseInt(sale.quantity || 0);
        productAnalysis[productName].revenue += parseFloat(sale.total_price || 0);
        productAnalysis[productName].cost += sale.total_cost;
        productAnalysis[productName].profit += sale.profit;
        productAnalysis[productName].transactions += 1;
        if (sale.has_actual_cost) {
          productAnalysis[productName].hasActualCost = true;
        }
      }
      
      // Calculate average margins for each product
      Object.values(productAnalysis).forEach(product => {
        product.avgMargin = product.revenue > 0 ? (product.profit / product.revenue * 100) : 0;
      });

      // Top products by revenue
      const topProducts = Object.values(productAnalysis)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      
      // Top profitable products (by profit amount)
      const topProfitableProducts = Object.values(productAnalysis)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);
      
      // Low margin products (products with margin < 20%)
      const lowMarginProducts = Object.values(productAnalysis)
        .filter(p => p.avgMargin < 20 && p.revenue > 0)
        .sort((a, b) => a.avgMargin - b.avgMargin)
        .slice(0, 5);

      const stats = {
        revenue: Math.round(revenue * 100) / 100,
        profit: Math.round(grossProfit * 100) / 100, // Keep as grossProfit for backward compatibility
        grossProfit: Math.round(grossProfit * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        units,
        transactions,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        profitMargin: Math.round(grossMargin * 100) / 100, // Keep as grossMargin for backward compatibility
        grossMargin: Math.round(grossMargin * 100) / 100,
        netMargin: Math.round(netMargin * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        topProducts,
        topProfitableProducts,
        lowMarginProducts
      };
      
      setSalesStats(stats);
      return stats;

    } catch (error) {
      console.error('❌ Error loading sales stats:', error);
      // Set empty data when no sales found
      const emptyStats = {
        revenue: 0,
        profit: 0,
        grossProfit: 0,
        netProfit: 0,
        units: 0,
        transactions: 0,
        avgOrderValue: 0,
        profitMargin: 0,
        grossMargin: 0,
        netMargin: 0,
        totalCost: 0,
        totalInvoiced: 0,
        roi: 0,
        topProducts: [],
        topProfitableProducts: [],
        lowMarginProducts: []
      };
      setSalesStats(emptyStats);
      return emptyStats;
    }
  };

  const loadInvoiceStats = async () => {
    try {
      console.log('📄 Loading invoice stats for period:', selectedPeriod);
      
      // Get recent invoices
      const invoicesResponse = await apiOperations.getRecentInvoices(100);
      const invoices = invoicesResponse.invoices || [];
      
      // Filter by selected period
      const now = new Date();
      const filteredInvoices = invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.created_at);
        switch (selectedPeriod) {
          case 'today':
            return invoiceDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return invoiceDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return invoiceDate >= monthAgo;
          case 'year':
            const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            return invoiceDate >= yearAgo;
          default:
            return true;
        }
      });

      const totalInvoices = filteredInvoices.length;
      const processedInvoices = filteredInvoices.filter(inv => inv.status === 'completed').length;
      const pendingInvoices = filteredInvoices.filter(inv => inv.status === 'pending').length;
      const successRate = totalInvoices > 0 ? (processedInvoices / totalInvoices * 100) : 0;
      const totalValue = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
      
      // Calculate average processing time (mock for now)
      const avgProcessingTime = 45; // seconds

      const stats = {
        totalInvoices,
        processedInvoices,
        pendingInvoices,
        avgProcessingTime,
        successRate: Math.round(successRate * 100) / 100,
        totalValue: Math.round(totalValue * 100) / 100
      };
      
      setInvoiceStats(stats);
      return stats;

    } catch (error) {
      console.error('❌ Error loading invoice stats:', error);
      const emptyStats = {
        totalInvoices: 0,
        processedInvoices: 0,
        pendingInvoices: 0,
        avgProcessingTime: 0,
        successRate: 0,
        totalValue: 0
      };
      setInvoiceStats(emptyStats);
      return emptyStats;
    }
  };

  const loadInventoryStats = async () => {
    try {
      console.log('📦 Loading inventory stats...');
      const base = apiConfig.getBaseUrl();
      
      // Get all products
      const products = await apiOperations.getProducts();
      
      console.log('✅ Products data loaded:', products.length, 'products');
      
      // Calculate inventory metrics
      const totalProducts = products.length;
      const lowStock = products.filter(p => {
        const qty = parseInt(p.quantity || 0);
        const minStock = parseInt(p.min_stock || 5);
        return qty > 0 && qty <= minStock;
      }).length;
      
      const outOfStock = products.filter(p => parseInt(p.quantity || 0) === 0).length;
      
      const totalValue = products.reduce((sum, product) => {
        const qty = parseInt(product.quantity || 0);
        const price = parseFloat(product.cost_price || product.selling_price || 0);
        return sum + (qty * price);
      }, 0);

      // Calculate category breakdown for inventory
      const categoryMap = {};
      products.forEach(product => {
        const category = product.category || 'other';
        const qty = parseInt(product.quantity || 0);
        const value = qty * parseFloat(product.cost_price || product.selling_price || 0);
        
        if (!categoryMap[category]) {
          categoryMap[category] = { count: 0, value: 0 };
        }
        categoryMap[category].count += qty;
        categoryMap[category].value += value;
      });

      const topCategories = Object.entries(categoryMap)
        .map(([category, data]) => ({
          category,
          count: data.count,
          value: Math.round(data.value * 100) / 100
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Estimate turnover rate using historical sales transactions
      const salesResponse = await fetchWithTimeout(`${base}/api/transactions?type=sale&period=month`);
      const salesData = await salesResponse.json();
      const monthlySales = salesData.transactions || [];
      const monthlySoldUnits = monthlySales.reduce((sum, sale) => sum + parseInt(sale.quantity || 0), 0);
      const averageInventory = products.reduce((sum, p) => sum + parseInt(p.quantity || 0), 0);
      const turnoverRate = averageInventory > 0 ? Math.round((monthlySoldUnits / averageInventory) * 12 * 100) / 100 : 0;

      setInventoryStats({
        totalProducts,
        lowStock,
        outOfStock,
        totalValue: Math.round(totalValue * 100) / 100,
        turnoverRate,
        topCategories
      });

    } catch (error) {
      console.error('❌ Error loading inventory stats:', error);
      setInventoryStats({
        totalProducts: 0,
        lowStock: 0,
        outOfStock: 0,
        totalValue: 0,
        turnoverRate: 0,
        topCategories: []
      });
    }
  };

  const loadChartData = async (statsData) => {
    try {
      console.log('📊 Loading real business chart data for period:', selectedPeriod);
      
      if (selectedView === 'sales' && statsData) {
        await loadRealBusinessCharts(statsData);
      } else if (selectedView === 'invoices') {
        await loadInvoiceChartData();
      }
      
    } catch (error) {
      console.error('❌ Error loading chart data:', error);
      setChartData({
        profitWaterfall: null,
        marginDistribution: null,
        costVsPrice: null,
        purchaseVsSales: null,
        profitByProduct: null
      });
    }
  };

  const loadRealBusinessCharts = async (statsData) => {
    try {
      // Use the passed statsData instead of state (which might not be updated yet)
      const currentStats = statsData || salesStats;
      
      // Ensure we have valid stats data
      if (!currentStats || currentStats.revenue === undefined) {
        console.warn('No stats data available for charts');
        return;
      }
      
      const base = apiConfig.getBaseUrl();
      
      // Get all products with cost and selling prices
      const productsResponse = await fetchWithTimeout(`${base}/products`);
      const productsData = await productsResponse.json();
      const products = productsData.products || [];
      
      // Create product map for quick lookup
      const productMap = {};
      products.forEach(p => {
        productMap[p.id] = p;
      });
      
      // 1. PROFIT WATERFALL CHART - Shows how revenue becomes profit
      const waterfallData = {
        labels: [t('charts.totalRevenue'), t('charts.totalCosts'), t('charts.grossProfit'), t('charts.operatingExpenses'), t('charts.netProfit')],
        datasets: [{
          label: t('charts.profitWaterfall'),
          data: [
            currentStats.revenue || 0,
            -(currentStats.totalCost || 0),
            currentStats.grossProfit || 0,
            -(currentStats.revenue * 0.15) || 0,
            currentStats.netProfit || 0
          ],
          backgroundColor: [
            'rgba(255, 215, 0, 0.8)',  // Revenue - Gold
            'rgba(255, 99, 99, 0.8)',   // Costs - Red
            'rgba(177, 156, 217, 0.8)', // Gross - Purple
            'rgba(255, 165, 0, 0.8)',   // Expenses - Orange
            currentStats.netProfit > 0 ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)' // Net - Green/Red
          ],
          borderColor: [
            'rgba(255, 215, 0, 1)',
            'rgba(255, 99, 99, 1)',
            'rgba(177, 156, 217, 1)',
            'rgba(255, 165, 0, 1)',
            currentStats.netProfit > 0 ? 'rgba(76, 175, 80, 1)' : 'rgba(244, 67, 54, 1)'
          ],
          borderWidth: 2
        }]
      };
      
      // 2. MARGIN DISTRIBUTION - Shows how many products in each margin range
      const marginRanges = {
        [t('charts.marginRanges.loss')]: 0,
        [t('charts.marginRanges.low')]: 0,
        [t('charts.marginRanges.ok')]: 0,
        [t('charts.marginRanges.good')]: 0,
        [t('charts.marginRanges.excellent')]: 0
      };
      
      // Analyze each product's actual margin
      const productMargins = [];
      products.forEach(product => {
        if (product.cost_price && product.price) {
          const margin = ((product.price - product.cost_price) / product.price) * 100;
          productMargins.push({
            name: product.name,
            margin: margin,
            cost: product.cost_price,
            price: product.price
          });
          
          if (margin < 0) marginRanges[t('charts.marginRanges.loss')]++;
          else if (margin < 20) marginRanges[t('charts.marginRanges.low')]++;
          else if (margin < 30) marginRanges[t('charts.marginRanges.ok')]++;
          else if (margin < 40) marginRanges[t('charts.marginRanges.good')]++;
          else marginRanges[t('charts.marginRanges.excellent')]++;
        }
      });
      
      const marginDistributionData = {
        labels: Object.keys(marginRanges),
        datasets: [{
          label: t('charts.numberOfProducts'),
          data: Object.values(marginRanges),
          backgroundColor: [
            'rgba(244, 67, 54, 0.8)',  // Loss - Red
            'rgba(255, 152, 0, 0.8)',  // Low - Orange
            'rgba(255, 235, 59, 0.8)', // OK - Yellow
            'rgba(139, 195, 74, 0.8)', // Good - Light Green
            'rgba(76, 175, 80, 0.8)'   // Excellent - Green
          ],
          borderColor: '#1a1a1a',
          borderWidth: 2
        }]
      };
      
      // 3. COST VS SELLING PRICE - Top 10 products comparison
      const topProductsForComparison = productMargins
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 10);
      
      const costVsPriceData = {
        labels: topProductsForComparison.map(p => p.name.substring(0, 20)),
        datasets: [
          {
            label: t('charts.costPrice'),
            data: topProductsForComparison.map(p => p.cost),
            backgroundColor: 'rgba(255, 99, 99, 0.8)',
            borderColor: 'rgba(255, 99, 99, 1)',
            borderWidth: 2
          },
          {
            label: t('charts.sellingPrice'),
            data: topProductsForComparison.map(p => p.price),
            backgroundColor: 'rgba(76, 175, 80, 0.8)',
            borderColor: 'rgba(76, 175, 80, 1)',
            borderWidth: 2
          }
        ]
      };
      
      // 4. PURCHASE VS SALES TIMELINE - Compare what we bought vs what we sold
      // Fetch real transaction and invoice data for timeline
      const timeLabels = getChartLabels();
      const purchasesByTime = new Array(timeLabels.length).fill(0);
      const salesByTime = new Array(timeLabels.length).fill(0);
      
      // Get sales transactions for timeline
      const salesResponse = await fetchWithTimeout(`${base}/api/transactions?type=sale&period=${selectedPeriod}`);
      const salesData = await salesResponse.json();
      const sales = salesData.transactions || [];
      
      // Get invoices for timeline
      const invoicesResponse = await fetchWithTimeout(`${base}/invoices/recent`);
      const invoicesData = await invoicesResponse.json();
      const invoices = invoicesData.invoices || [];
      
      // Group purchases (invoices) by time
      invoices.forEach(invoice => {
        const dateStr = invoice.created_at || invoice.finalized_at || invoice.timestamp;
        const index = getTimeLabelIndex(dateStr, timeLabels);
        if (index >= 0 && index < purchasesByTime.length) {
          purchasesByTime[index] += parseFloat(invoice.total_amount || 0);
        }
      });
      
      // Group sales by time
      sales.forEach(sale => {
        const dateStr = sale.timestamp || sale.created_at;
        const index = getTimeLabelIndex(dateStr, timeLabels);
        if (index >= 0 && index < salesByTime.length) {
          salesByTime[index] += parseFloat(sale.total_price || 0);
        }
      });
      
      const purchaseVsSalesData = {
        labels: timeLabels,
        datasets: [
          {
            label: t('charts.purchases'),
            data: purchasesByTime,
            borderColor: 'rgba(255, 99, 99, 1)',
            backgroundColor: 'rgba(255, 99, 99, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: t('charts.sales'),
            data: salesByTime,
            borderColor: 'rgba(76, 175, 80, 1)',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      };
      
      // 5. PROFIT BY PRODUCT - Bar chart of actual profit per product
      const profitByProductData = {
        labels: (currentStats.topProfitableProducts || []).slice(0, 8).map(p => p.name.substring(0, 15)),
        datasets: [{
          label: t('charts.profitAmount'),
          data: (currentStats.topProfitableProducts || []).slice(0, 8).map(p => p.profit),
          backgroundColor: (currentStats.topProfitableProducts || []).slice(0, 8).map(p => 
            p.avgMargin >= 30 ? 'rgba(76, 175, 80, 0.8)' : 
            p.avgMargin >= 20 ? 'rgba(255, 235, 59, 0.8)' : 
            'rgba(255, 152, 0, 0.8)'
          ),
          borderColor: '#1a1a1a',
          borderWidth: 2
        }]
      };
      
      setChartData({
        profitWaterfall: waterfallData,
        marginDistribution: marginDistributionData,
        costVsPrice: costVsPriceData,
        purchaseVsSales: purchaseVsSalesData,
        profitByProduct: profitByProductData
      });
      
    } catch (error) {
      console.error('❌ Error loading real business charts:', error);
      throw error;
    }
  };
  
  const getTimeLabelIndex = (dateStr, labels) => {
    const date = new Date(dateStr);
    const now = new Date();
    
    switch (selectedPeriod) {
      case 'today':
        return date.getHours();
      case 'week':
        return date.getDay();
      case 'month':
        return date.getDate() - 1;
      case 'year':
        return date.getMonth();
      default:
        return 0;
    }
  };
  
  const loadSalesChartData_OLD = async (labels) => {
    try {
      // Get historical sales transactions from database
      const base = apiConfig.getBaseUrl();
      const response = await fetchWithTimeout(`${base}/api/transactions?type=sale&period=${selectedPeriod}`);
      const data = await response.json();
      const sales = data.transactions || [];
      
      // Group sales data by time period
      const timeSeriesData = groupSalesByTimeLabels(sales, labels);
      const revenueData = timeSeriesData.map(period => period.revenue);
      const profitData = timeSeriesData.map(period => period.profit);
      const marginData = timeSeriesData.map(period => period.margin);
      
      // Get category breakdown from actual sales data
      const categoryData = await getCategoryBreakdown(sales);
      
      setChartData({
        salesTrend: {
          labels,
          datasets: [
            {
              label: t('stats.revenue'),
              data: revenueData,
              borderColor: '#FFD700',
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: t('stats.profit'),
              data: profitData,
              borderColor: '#B19CD9',
              backgroundColor: 'rgba(177, 156, 217, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        profitTrend: {
          labels,
          datasets: [{
            label: t('stats.metrics.margin') + ' %',
            data: marginData,
            backgroundColor: '#B19CD9',
            borderColor: '#8B7AA8',
            borderWidth: 2
          }]
        },
        categoryBreakdown: {
          labels: categoryData.labels,
          datasets: [{
            data: categoryData.values,
            backgroundColor: ['#FFD700', '#B19CD9', '#4CAF50', '#FF6B6B', '#45B7D1'],
            borderWidth: 2,
            borderColor: '#1a1a1a'
          }]
        }
      });
      
    } catch (error) {
      console.error('❌ Error loading sales chart data:', error);
      // Fallback to empty data instead of mock data
      const emptyData = labels.map(() => 0);
      
      setChartData({
        salesTrend: {
          labels,
          datasets: [
            {
              label: t('stats.revenue'),
              data: emptyData,
              borderColor: '#FFD700',
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: t('stats.profit'),
              data: emptyData,
              borderColor: '#B19CD9',
              backgroundColor: 'rgba(177, 156, 217, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        profitTrend: {
          labels,
          datasets: [{
            label: t('stats.metrics.margin') + ' %',
            data: emptyData,
            backgroundColor: '#B19CD9',
            borderColor: '#8B7AA8',
            borderWidth: 2
          }]
        },
        categoryBreakdown: {
          labels: [t('stats.categories.electronics'), t('stats.categories.gaming'), t('stats.categories.accessories'), t('stats.categories.software'), t('stats.categories.other')],
          datasets: [{
            data: [0, 0, 0, 0, 0],
            backgroundColor: ['#FFD700', '#B19CD9', '#4CAF50', '#FF6B6B', '#45B7D1'],
            borderWidth: 2,
            borderColor: '#1a1a1a'
          }]
        }
      });
    }
  };

  const loadInvoiceChartData = async () => {
    // Simplified invoice charts - can be enhanced later
    setChartData({
      profitWaterfall: null,
      marginDistribution: null,
      costVsPrice: null,
      purchaseVsSales: null,
      profitByProduct: null
    });
  };
  
  const loadInvoiceChartData_OLD = async (labels) => {
    try {
      // Get historical invoice data
      const invoicesResponse = await apiOperations.getRecentInvoices(1000); // Get more data for analysis
      const invoices = invoicesResponse.invoices || [];
      
      // Filter invoices by selected period and group by time
      const timeSeriesData = groupInvoicesByTimeLabels(invoices, labels);
      const processedData = timeSeriesData.map(period => period.processed);
      const totalData = timeSeriesData.map(period => period.total);
      
      // Calculate success rates over time
      const successRates = timeSeriesData.map(period => 
        period.total > 0 ? (period.processed / period.total * 100) : 0
      );
      
      // Get invoice status breakdown
      const statusBreakdown = getInvoiceStatusBreakdown(invoices);
      
      setChartData({
        salesTrend: {
          labels,
          datasets: [
            {
              label: t('stats.totalInvoices'),
              data: totalData,
              borderColor: '#FFD700',
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: t('stats.metrics.processed'),
              data: processedData,
              borderColor: '#B19CD9',
              backgroundColor: 'rgba(177, 156, 217, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        profitTrend: {
          labels,
          datasets: [{
            label: t('stats.successRate') + ' %',
            data: successRates,
            backgroundColor: '#B19CD9',
            borderColor: '#8B7AA8',
            borderWidth: 2
          }]
        },
        categoryBreakdown: {
          labels: statusBreakdown.labels,
          datasets: [{
            data: statusBreakdown.values,
            backgroundColor: ['#4CAF50', '#FFD700', '#FF6B6B', '#B19CD9'],
            borderWidth: 2,
            borderColor: '#1a1a1a'
          }]
        }
      });
      
    } catch (error) {
      console.error('❌ Error loading invoice chart data:', error);
      // Fallback to empty data
      const emptyData = labels.map(() => 0);
      
      setChartData({
        salesTrend: {
          labels,
          datasets: [
            {
              label: t('stats.totalInvoices'),
              data: emptyData,
              borderColor: '#FFD700',
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: t('stats.metrics.processed'),
              data: emptyData,
              borderColor: '#B19CD9',
              backgroundColor: 'rgba(177, 156, 217, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        profitTrend: {
          labels,
          datasets: [{
            label: t('stats.successRate') + ' %',
            data: emptyData,
            backgroundColor: '#B19CD9',
            borderColor: '#8B7AA8',
            borderWidth: 2
          }]
        },
        categoryBreakdown: {
          labels: [t('common.completed'), t('common.pending'), t('common.failed'), t('common.processing')],
          datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: ['#4CAF50', '#FFD700', '#FF6B6B', '#B19CD9'],
            borderWidth: 2,
            borderColor: '#1a1a1a'
          }]
        }
      });
    }
  };

  const getChartLabels = () => {
    switch (selectedPeriod) {
      case 'today':
        return Array.from({ length: 24 }, (_, i) => `${i}:00`);
      case 'week':
        return [t('common.days.mon'), t('common.days.tue'), t('common.days.wed'), t('common.days.thu'), t('common.days.fri'), t('common.days.sat'), t('common.days.sun')];
      case 'month':
        return Array.from({ length: 30 }, (_, i) => `${i + 1}`);
      case 'year':
        return [t('common.months.jan'), t('common.months.feb'), t('common.months.mar'), t('common.months.apr'), t('common.months.may'), t('common.months.jun'), t('common.months.jul'), t('common.months.aug'), t('common.months.sep'), t('common.months.oct'), t('common.months.nov'), t('common.months.dec')];
      default:
        return [t('common.months.jan'), t('common.months.feb'), t('common.months.mar'), t('common.months.apr'), t('common.months.may'), t('common.months.jun')];
    }
  };

  const groupSalesByTimeLabels = (sales, labels) => {
    const now = new Date();
    
    return labels.map((label, index) => {
      let startDate, endDate;
      
      switch (selectedPeriod) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), index, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), index + 1, 0, 0);
          break;
        case 'week':
          const dayNames = [t('common.days.mon'), t('common.days.tue'), t('common.days.wed'), t('common.days.thu'), t('common.days.fri'), t('common.days.sat'), t('common.days.sun')];
          const dayIndex = dayNames.indexOf(label);
          const startOfWeek = new Date(now.getTime() - (now.getDay() - 1) * 24 * 60 * 60 * 1000);
          startDate = new Date(startOfWeek.getTime() + dayIndex * 24 * 60 * 60 * 1000);
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), index + 1, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth(), index + 2, 0, 0, 0);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), index, 1, 0, 0, 0);
          endDate = new Date(now.getFullYear(), index + 1, 1, 0, 0, 0);
          break;
        default:
          startDate = new Date(now.getFullYear(), index, 1, 0, 0, 0);
          endDate = new Date(now.getFullYear(), index + 1, 1, 0, 0, 0);
      }
      
      const periodSales = sales.filter(sale => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= startDate && saleDate < endDate;
      });
      
      const revenue = periodSales.reduce((sum, sale) => sum + parseFloat(sale.total_price || 0), 0);
      const estimatedCosts = revenue * 0.7; // 70% of revenue as cost
      const profit = revenue - estimatedCosts;
      const margin = revenue > 0 ? (profit / revenue * 100) : 0;
      
      return {
        revenue: Math.round(revenue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin: Math.round(margin * 100) / 100
      };
    });
  };

  const groupInvoicesByTimeLabels = (invoices, labels) => {
    const now = new Date();
    
    // Filter invoices by selected period first
    const filteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.created_at);
      switch (selectedPeriod) {
        case 'today':
          return invoiceDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return invoiceDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return invoiceDate >= monthAgo;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return invoiceDate >= yearAgo;
        default:
          return true;
      }
    });
    
    return labels.map((label, index) => {
      let startDate, endDate;
      
      switch (selectedPeriod) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), index, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), index + 1, 0, 0);
          break;
        case 'week':
          const dayNames = [t('common.days.mon'), t('common.days.tue'), t('common.days.wed'), t('common.days.thu'), t('common.days.fri'), t('common.days.sat'), t('common.days.sun')];
          const dayIndex = dayNames.indexOf(label);
          const startOfWeek = new Date(now.getTime() - (now.getDay() - 1) * 24 * 60 * 60 * 1000);
          startDate = new Date(startOfWeek.getTime() + dayIndex * 24 * 60 * 60 * 1000);
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), index + 1, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth(), index + 2, 0, 0, 0);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), index, 1, 0, 0, 0);
          endDate = new Date(now.getFullYear(), index + 1, 1, 0, 0, 0);
          break;
        default:
          startDate = new Date(now.getFullYear(), index, 1, 0, 0, 0);
          endDate = new Date(now.getFullYear(), index + 1, 1, 0, 0, 0);
      }
      
      const periodInvoices = filteredInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.created_at);
        return invoiceDate >= startDate && invoiceDate < endDate;
      });
      
      const total = periodInvoices.length;
      const processed = periodInvoices.filter(inv => inv.status === 'completed').length;
      
      return { total, processed };
    });
  };

  const getCategoryBreakdown = async (sales) => {
    try {
      // Get products to map sales to categories
      const productsResponse = await apiOperations.getProducts();
      const products = productsResponse.products || [];
      
      const categoryMap = {};
      sales.forEach(sale => {
        const product = products.find(p => p.name === sale.product_name || p.barcode === sale.barcode);
        const category = product?.category || 'other';
        
        if (!categoryMap[category]) {
          categoryMap[category] = 0;
        }
        categoryMap[category] += parseFloat(sale.total_price || 0);
      });
      
      // Map to translation keys
      const categoryLabels = Object.keys(categoryMap).map(cat => {
        switch (cat.toLowerCase()) {
          case 'electronics': return t('stats.categories.electronics');
          case 'gaming': return t('stats.categories.gaming');
          case 'accessories': return t('stats.categories.accessories');
          case 'software': return t('stats.categories.software');
          case 'hardware': return t('stats.categories.hardware');
          default: return t('stats.categories.other');
        }
      });
      
      const categoryValues = Object.values(categoryMap);
      
      return {
        labels: categoryLabels,
        values: categoryValues
      };
      
    } catch (error) {
      console.error('❌ Error getting category breakdown:', error);
      return {
        labels: [t('stats.categories.electronics'), t('stats.categories.gaming'), t('stats.categories.accessories'), t('stats.categories.software'), t('stats.categories.other')],
        values: [0, 0, 0, 0, 0]
      };
    }
  };

  const getInvoiceStatusBreakdown = (invoices) => {
    const statusMap = {
      completed: 0,
      pending: 0,
      failed: 0,
      processing: 0
    };
    
    invoices.forEach(invoice => {
      const status = invoice.status || 'pending';
      if (statusMap[status] !== undefined) {
        statusMap[status]++;
      }
    });
    
    return {
      labels: [t('common.completed'), t('common.pending'), t('common.failed'), t('common.processing')],
      values: [statusMap.completed, statusMap.pending, statusMap.failed, statusMap.processing]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#FFD700',
          font: { size: 12, weight: 'bold' }
        }
      },
      tooltip: {
        backgroundColor: '#1a1a1a',
        titleColor: '#FFD700',
        bodyColor: '#fff',
        borderColor: '#FFD700',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            if (context.dataset.label.includes('Revenue') || context.dataset.label.includes('Profit')) {
              return `${context.dataset.label}: ${formatPrice(context.parsed.y)}`;
            }
            return `${context.dataset.label}: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: '#333' },
        ticks: { color: '#FFD700' }
      },
      y: {
        grid: { color: '#333' },
        ticks: { 
          color: '#FFD700',
          callback: function(value) {
            return formatCompactPrice(value);
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gaming-black">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-gaming-purple animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t('stats.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gaming-black">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadStats}
            className="mt-4 px-4 py-2 bg-gaming-purple text-white rounded-lg hover:bg-gaming-purple/80"
          >
            {t('stats.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gaming-black text-white p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gaming-yellow/20 rounded-xl">
                <BarChart3 className="w-8 h-8 text-gaming-yellow" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{t('stats.title')}</h1>
                <p className="text-gray-400 mt-1">{t('stats.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={loadStats}
              className="px-4 py-2 bg-gaming-purple text-white rounded-lg hover:bg-gaming-purple/80 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {t('stats.refresh')}
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* View Toggle */}
            <div className="flex bg-gaming-gray rounded-lg p-1">
              <button
                onClick={() => setSelectedView('sales')}
                className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${
                  selectedView === 'sales' 
                    ? 'bg-gaming-yellow text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {t('stats.views.sales')}
              </button>
              <button
                onClick={() => setSelectedView('invoices')}
                className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${
                  selectedView === 'invoices' 
                    ? 'bg-gaming-yellow text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                {t('stats.views.invoices')}
              </button>
            </div>

            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 bg-gaming-gray border border-gaming-purple/20 rounded-lg text-white focus:outline-none focus:border-gaming-purple"
            >
              <option value="today">{t('stats.periods.today')}</option>
              <option value="week">{t('stats.periods.week')}</option>
              <option value="month">{t('stats.periods.month')}</option>
              <option value="year">{t('stats.periods.year')}</option>
              <option value="all">{t('stats.periods.all')}</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        {selectedView === 'sales' ? (
          <>
            {/* Primary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-yellow/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-gaming-yellow/20 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-gaming-yellow" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.revenue')}</h3>
                <p className="text-2xl font-bold text-white mb-1">{formatPrice(salesStats.revenue)}</p>
                <p className="text-xs text-green-400">+{salesStats.transactions} {t('stats.metrics.transactions')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-purple/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-gaming-purple/20 rounded-lg">
                    <Target className="w-6 h-6 text-gaming-purple" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('charts.grossProfit')}</h3>
                <p className="text-2xl font-bold text-gaming-purple mb-1">{formatPrice(salesStats.grossProfit)}</p>
                <p className="text-xs text-green-400">{salesStats.grossMargin.toFixed(1)}% {t('stats.metrics.margin')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Zap className="w-6 h-6 text-emerald-400" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('charts.netProfit')}</h3>
                <p className="text-2xl font-bold text-emerald-400 mb-1">{formatPrice(salesStats.netProfit)}</p>
                <p className="text-xs text-emerald-400">{salesStats.netMargin.toFixed(1)}% {t('stats.metrics.margin')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-cyan-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <Percent className="w-6 h-6 text-cyan-400" />
                  </div>
                  {salesStats.roi > 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('charts.returnOnInvestment')}</h3>
                <p className="text-2xl font-bold text-cyan-400 mb-1">{salesStats.roi.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">{t('charts.returnOnInvestment')}</p>
              </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gaming-gray rounded-xl p-6 border border-red-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <TrendingDown className="w-6 h-6 text-red-400" />
                  </div>
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('charts.totalCosts')}</h3>
                <p className="text-2xl font-bold text-red-400 mb-1">{formatPrice(salesStats.totalCost)}</p>
                <p className="text-xs text-gray-500">{t('charts.productCosts')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-orange-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <FileText className="w-6 h-6 text-orange-400" />
                  </div>
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('charts.totalInvoiced')}</h3>
                <p className="text-2xl font-bold text-orange-400 mb-1">{formatPrice(salesStats.totalInvoiced)}</p>
                <p className="text-xs text-gray-500">{t('charts.paidToSuppliers')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-blue-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Package className="w-6 h-6 text-blue-400" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.unitsSold')}</h3>
                <p className="text-2xl font-bold text-blue-400 mb-1">{salesStats.units.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{salesStats.transactions} {t('stats.metrics.orders')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-green-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Award className="w-6 h-6 text-green-400" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.avgOrderValue')}</h3>
                <p className="text-2xl font-bold text-green-400 mb-1">{formatPrice(salesStats.avgOrderValue)}</p>
                <p className="text-xs text-gray-500">{t('stats.metrics.perTransaction')}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-yellow/20">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gaming-yellow/20 rounded-lg">
                  <FileText className="w-6 h-6 text-gaming-yellow" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.totalInvoices')}</h3>
              <p className="text-2xl font-bold text-white mb-1">{invoiceStats.totalInvoices}</p>
              <p className="text-xs text-green-400">+{invoiceStats.processedInvoices} {t('stats.metrics.processed')}</p>
            </div>

            <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-purple/20">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gaming-purple/20 rounded-lg">
                  <Zap className="w-6 h-6 text-gaming-purple" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.successRate')}</h3>
              <p className="text-2xl font-bold text-gaming-purple mb-1">{invoiceStats.successRate}%</p>
              <p className="text-xs text-green-400">{invoiceStats.processedInvoices}/{invoiceStats.totalInvoices} {t('processing.invoices')}</p>
            </div>

            <div className="bg-gaming-gray rounded-xl p-6 border border-blue-500/20">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.avgProcessing')}</h3>
              <p className="text-2xl font-bold text-blue-400 mb-1">{invoiceStats.avgProcessingTime}s</p>
              <p className="text-xs text-gray-500">{t('stats.metrics.perInvoice')}</p>
            </div>

            <div className="bg-gaming-gray rounded-xl p-6 border border-green-500/20">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Award className="w-6 h-6 text-green-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.totalValue')}</h3>
              <p className="text-2xl font-bold text-green-400 mb-1">{formatPrice(invoiceStats.totalValue)}</p>
              <p className="text-xs text-gray-500">{t('stats.metrics.invoicedAmount')}</p>
            </div>
          </div>
        )}

        {/* Real Business Charts */}
        {selectedView === 'sales' ? (
          <>
            {/* Primary Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Profit Waterfall - How Revenue Becomes Profit */}
              <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-yellow/10">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-gaming-yellow" />
                  {t('charts.profitWaterfall')}
                </h3>
                <div className="h-64">
                  {chartData.profitWaterfall && (
                    <Bar 
                      data={chartData.profitWaterfall} 
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          tooltip: {
                            ...chartOptions.plugins.tooltip,
                            callbacks: {
                              label: function(context) {
                                const value = Math.abs(context.parsed.y);
                                const prefix = context.parsed.y < 0 ? '-' : '';
                                return `${context.dataset.label}: ${prefix}${formatPrice(value)}`;
                              }
                            }
                          }
                        },
                        scales: {
                          ...chartOptions.scales,
                          y: {
                            ...chartOptions.scales.y,
                            ticks: {
                              ...chartOptions.scales.y.ticks,
                              callback: function(value) {
                                return formatCompactPrice(Math.abs(value));
                              }
                            }
                          }
                        }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Margin Distribution */}
              <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-purple/10">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-gaming-purple" />
                  {t('charts.marginDistribution')}
                </h3>
                <div className="h-64">
                  {chartData.marginDistribution && (
                    <Doughnut 
                      data={chartData.marginDistribution} 
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          legend: {
                            position: 'bottom',
                            labels: {
                              color: '#FFD700',
                              padding: 15,
                              font: { size: 11 }
                            }
                          },
                          tooltip: {
                            ...chartOptions.plugins.tooltip,
                            callbacks: {
                              label: function(context) {
                                return `${context.label}: ${context.parsed} products`;
                              }
                            }
                          }
                        }
                      }} 
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Cost vs Selling Price Comparison */}
              <div className="bg-gaming-gray rounded-xl p-6 border border-emerald-500/10">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
                  {t('charts.costVsPrice')}
                </h3>
                <div className="h-64">
                  {chartData.costVsPrice && (
                    <Bar 
                      data={chartData.costVsPrice} 
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          tooltip: {
                            ...chartOptions.plugins.tooltip,
                            callbacks: {
                              label: function(context) {
                                return `${context.dataset.label}: ${formatPrice(context.parsed.y)}`;
                              },
                              afterLabel: function(context) {
                                if (context.datasetIndex === 1) {
                                  const cost = chartData.costVsPrice.datasets[0].data[context.dataIndex];
                                  const price = context.parsed.y;
                                  const margin = ((price - cost) / price * 100).toFixed(1);
                                  return `Margin: ${margin}%`;
                                }
                              }
                            }
                          }
                        }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Profit by Product */}
              <div className="bg-gaming-gray rounded-xl p-6 border border-cyan-500/10">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  {t('charts.actualProfitByProduct')}
                </h3>
                <div className="h-64">
                  {chartData.profitByProduct && (
                    <Bar 
                      data={chartData.profitByProduct} 
                      options={{
                        ...chartOptions,
                        indexAxis: 'y',
                        plugins: {
                          ...chartOptions.plugins,
                          legend: {
                            display: false
                          },
                          tooltip: {
                            ...chartOptions.plugins.tooltip,
                            callbacks: {
                              label: function(context) {
                                return `Profit: ${formatPrice(context.parsed.x)}`;
                              }
                            }
                          }
                        },
                        scales: {
                          x: {
                            grid: { color: '#333' },
                            ticks: { 
                              color: '#FFD700',
                              callback: function(value) {
                                return formatCompactPrice(value);
                              }
                            }
                          },
                          y: {
                            grid: { color: '#333' },
                            ticks: { color: '#FFD700', font: { size: 10 } }
                          }
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Full Width Chart - Purchase vs Sales Timeline */}
            <div className="bg-gaming-gray rounded-xl p-6 border border-blue-500/10 mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                {t('charts.purchaseVsSales')}
              </h3>
              <div className="h-64">
                {chartData.purchaseVsSales && (
                  <Line 
                    data={chartData.purchaseVsSales} 
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        tooltip: {
                          ...chartOptions.plugins.tooltip,
                          callbacks: {
                            label: function(context) {
                              return `${context.dataset.label}: ${formatPrice(context.parsed.y)}`;
                            }
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          /* Keep invoice charts as is for invoice view */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-yellow/10">
              <h3 className="text-xl font-bold text-white mb-4">{t('processing.invoiceAnalytics')}</h3>
              <div className="h-64 flex items-center justify-center text-gray-400">
                {t('processing.invoiceAnalyticsComingSoon')}
              </div>
            </div>
          </div>
        )}

        {/* Top Products / Recent Invoices */}
        {selectedView === 'sales' && salesStats.topProducts.length > 0 && (
          <>
            {/* Top Revenue Products */}
            <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-yellow/10 mb-8">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-gaming-yellow" />
                {t('charts.topRevenueProducts')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {salesStats.topProducts.map((product, index) => (
                  <div key={index} className="bg-gaming-black rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium truncate">{product.name}</span>
                      <span className="text-gaming-yellow text-sm">#{index + 1}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('stats.revenue')}:</span>
                        <span className="text-gaming-yellow font-medium">{formatPrice(product.revenue)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('stats.profit')}:</span>
                        <span className="text-gaming-purple font-medium">{formatPrice(product.profit)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('stats.metrics.margin')}:</span>
                        <span className={`font-medium ${product.avgMargin >= 30 ? 'text-green-400' : product.avgMargin >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {product.avgMargin.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('stats.units')}:</span>
                        <span className="text-white">{product.units}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Profitable Products */}
            {salesStats.topProfitableProducts.length > 0 && (
              <div className="bg-gaming-gray rounded-xl p-6 border border-emerald-500/10 mb-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  {t('charts.mostProfitableProducts')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {salesStats.topProfitableProducts.slice(0, 6).map((product, index) => (
                    <div key={index} className="bg-gaming-black rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium truncate">{product.name}</span>
                        <span className="text-emerald-400 text-sm">#{index + 1}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">{t('stats.profit')}:</span>
                          <span className="text-emerald-400 font-medium">{formatPrice(product.profit)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">{t('stats.revenue')}:</span>
                          <span className="text-gaming-yellow">{formatPrice(product.revenue)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">{t('stats.cost')}:</span>
                          <span className="text-red-400">{formatPrice(product.cost)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">{t('stats.metrics.margin')}:</span>
                          <span className={`font-medium ${product.avgMargin >= 30 ? 'text-green-400' : product.avgMargin >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {product.avgMargin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Margin Alert */}
            {salesStats.lowMarginProducts.length > 0 && (
              <div className="bg-gaming-gray rounded-xl p-6 border border-red-500/10 mb-8">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  {t('charts.lowMarginAlert')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {salesStats.lowMarginProducts.map((product, index) => (
                    <div key={index} className="bg-red-900/20 rounded-lg p-4 border border-red-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{product.name}</span>
                        <span className="text-red-400 font-bold">{product.avgMargin.toFixed(1)}% margin</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-400">{t('stats.revenue')}: </span>
                          <span className="text-white">{formatPrice(product.revenue)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">{t('stats.cost')}: </span>
                          <span className="text-red-400">{formatPrice(product.cost)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">{t('stats.profit')}: </span>
                          <span className="text-yellow-400">{formatPrice(product.profit)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">{t('stats.unitsSold')}: </span>
                          <span className="text-white">{product.units}</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-red-500/20">
                        <span className="text-xs text-red-400">
                          {product.hasActualCost ? t('charts.usingActualCost') : t('charts.estimatedCost')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Business Intelligence Insights */}
        {selectedView === 'sales' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit Analysis */}
            <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-purple/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-gaming-purple" />
                {t('charts.profitAnalysis')}
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-gaming-black rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">{t('charts.grossProfitMargin')}</span>
                    <span className={`font-bold ${salesStats.grossMargin >= 30 ? 'text-green-400' : salesStats.grossMargin >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {salesStats.grossMargin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${salesStats.grossMargin >= 30 ? 'bg-green-400' : salesStats.grossMargin >= 20 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(salesStats.grossMargin, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="p-3 bg-gaming-black rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">{t('charts.netProfitMargin')}</span>
                    <span className={`font-bold ${salesStats.netMargin >= 20 ? 'text-green-400' : salesStats.netMargin >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {salesStats.netMargin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${salesStats.netMargin >= 20 ? 'bg-green-400' : salesStats.netMargin >= 10 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(Math.max(salesStats.netMargin, 0), 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="p-3 bg-gaming-black rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">{t('charts.returnOnInvestment')}</span>
                    <span className={`font-bold ${salesStats.roi >= 50 ? 'text-green-400' : salesStats.roi >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {salesStats.roi.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {t('charts.revenueVsTotalInvoiced')}
                  </div>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-gaming-gray rounded-xl p-6 border border-green-500/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-400" />
                {t('charts.financialBreakdown')}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gaming-black rounded-lg">
                  <span className="text-gray-300">{t('charts.totalRevenue')}</span>
                  <span className="text-gaming-yellow font-bold">{formatPrice(salesStats.revenue)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gaming-black rounded-lg">
                  <span className="text-gray-300">{t('charts.productCosts')}</span>
                  <span className="text-red-400 font-bold">-{formatPrice(salesStats.totalCost)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gaming-black rounded-lg">
                  <span className="text-gray-300">{t('charts.operatingExpenses')}</span>
                  <span className="text-orange-400 font-bold">-{formatPrice(salesStats.revenue * 0.15)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gaming-black rounded-lg border-t border-gray-600 pt-3">
                  <span className="text-gray-300 font-medium">{t('charts.netProfit')}</span>
                  <span className={`font-bold text-lg ${salesStats.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatPrice(salesStats.netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Product Stock Info - Only show for sales view */}
        {selectedView === 'sales' && (
          <div className="mt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Package className="w-6 h-6 text-gaming-yellow" />
                {t('processing.productStockInformation')}
              </h2>
              <p className="text-gray-400 mt-1">{t('stats.inventoryLevels')}</p>
            </div>

            {/* Product Stock Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gaming-gray rounded-xl p-6 border border-gaming-yellow/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-gaming-yellow/20 rounded-lg">
                    <Package className="w-6 h-6 text-gaming-yellow" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.totalProducts')}</h3>
                <p className="text-2xl font-bold text-white mb-1">{inventoryStats.totalProducts}</p>
                <p className="text-xs text-green-400">{t('stats.totalProductsInStock')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-orange-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-orange-400" />
                  </div>
                  <TrendingDown className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.lowStock')}</h3>
                <p className="text-2xl font-bold text-orange-400 mb-1">{inventoryStats.lowStock}</p>
                <p className="text-xs text-orange-400">{t('stats.needRestockAttention')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-red-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.outOfStock')}</h3>
                <p className="text-2xl font-bold text-red-400 mb-1">{inventoryStats.outOfStock}</p>
                <p className="text-xs text-red-400">{t('stats.outOfStockItems')}</p>
              </div>

              <div className="bg-gaming-gray rounded-xl p-6 border border-green-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Award className="w-6 h-6 text-green-400" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{t('stats.totalValue')}</h3>
                <p className="text-2xl font-bold text-green-400 mb-1">{formatPrice(inventoryStats.totalValue)}</p>
                <p className="text-xs text-green-400">{t('stats.totalInventoryValue')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}