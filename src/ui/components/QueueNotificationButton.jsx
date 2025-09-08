// QueueNotificationButton.jsx - Mobile Sync Notifications (Sales, Scans)
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchWithTimeout } from '../utils/api';
import apiConfig from '../utils/apiConfig';
import { 
  Bell, 
  Smartphone, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Image,
  Images as ImagesIcon,
  Package,
  X,
  Eye,
  Trash2,
  ShoppingCart,
  Camera,
  TrendingUp
} from 'lucide-react';

const QueueNotificationButton = () => {
  const { t } = useTranslation();
  const [queueNotifications, setQueueNotifications] = useState([]); // Keep for fetching but don't show tab
  const [salesNotifications, setSalesNotifications] = useState([]);
  const [scansNotifications, setScansNotifications] = useState([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('scans'); // sales, scans (removed queue)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all types of notifications from desktop server
  const fetchAllNotifications = async () => {
    try {
      setIsLoading(true);
      
      // Fetch queue notifications (keep for count but don't show tab)
      const queueUrl = `${apiConfig.getBaseUrl()}/api/queue-notifications`;
      const queueResponse = await fetchWithTimeout(queueUrl);
      const queueData = await queueResponse.json();
      
      // Fetch sales notifications  
      const salesUrl = `${apiConfig.getBaseUrl()}/api/sales-notifications`;
      const salesResponse = await fetchWithTimeout(salesUrl);
      const salesData = await salesResponse.json();
      
      // Fetch scans notifications
      const scansUrl = `${apiConfig.getBaseUrl()}/api/scans-notifications`;
      const scansResponse = await fetchWithTimeout(scansUrl);
      const scansData = await scansResponse.json();
      
      if (queueData.success && salesData.success && scansData.success) {
        setQueueNotifications(queueData.notifications || []); // Keep for count
        setSalesNotifications(salesData.notifications || []);
        setScansNotifications(scansData.notifications || []);
        
        // Calculate total unread count (include queue for count but don't show tab)
        const totalUnread = (queueData.unreadCount || 0) + 
                          (salesData.unreadCount || 0) + 
                          (scansData.unreadCount || 0);
        setTotalUnreadCount(totalUnread);
        setError(null);
      } else {
        setError('Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId, type = 'scans') => {
    try {
      const endpoints = {
        queue: `${apiConfig.getBaseUrl()}/api/queue-notifications/${notificationId}/read`,
        sales: `${apiConfig.getBaseUrl()}/api/sales-notifications/${notificationId}/read`,
        scans: `${apiConfig.getBaseUrl()}/api/scans-notifications/${notificationId}/read`
      };
      
      const url = endpoints[type];
      const response = await fetchWithTimeout(url, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        // Update local state based on type
        const updateFunctions = {
          queue: setQueueNotifications,
          sales: setSalesNotifications,
          scans: setScansNotifications
        };
        
        updateFunctions[type](prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, isRead: true } 
              : n
          )
        );
        setTotalUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // Clear all notifications for active tab
  const clearAllNotifications = async () => {
    try {
      const endpoints = {
        queue: `${apiConfig.getBaseUrl()}/api/queue-notifications/clear`,
        sales: `${apiConfig.getBaseUrl()}/api/sales-notifications/clear`,
        scans: `${apiConfig.getBaseUrl()}/api/scans-notifications/clear`
      };
      
      const url = endpoints[activeTab];
      const response = await fetchWithTimeout(url, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        // Clear notifications for active tab
        const clearFunctions = {
          queue: () => setQueueNotifications([]),
          sales: () => setSalesNotifications([]),
          scans: () => setScansNotifications([])
        };
        
        clearFunctions[activeTab]();
        
        // Recalculate total unread count (include queue but don't show tab)
        const currentCounts = {
          queue: activeTab === 'queue' ? 0 : queueNotifications.filter(n => !n.isRead).length,
          sales: activeTab === 'sales' ? 0 : salesNotifications.filter(n => !n.isRead).length,
          scans: activeTab === 'scans' ? 0 : scansNotifications.filter(n => !n.isRead).length
        };
        
        setTotalUnreadCount(currentCounts.queue + currentCounts.sales + currentCounts.scans);
      }
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  // Auto-refresh notifications every 30 seconds
  useEffect(() => {
    fetchAllNotifications();
    const interval = setInterval(fetchAllNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get current notifications based on active tab
  const getCurrentNotifications = () => {
    switch (activeTab) {
      case 'queue': return queueNotifications; // Keep for completeness but tab doesn't exist
      case 'sales': return salesNotifications;
      case 'scans': return scansNotifications;
      default: return [];
    }
  };

  // Render notification content based on active tab
  const renderNotificationContent = () => {
    const notifications = getCurrentNotifications();
    
    if (notifications.length === 0) {
      const emptyMessages = {
        queue: { title: t('queue.allCaughtUp'), message: t('queue.noQueueNotifications') },
        sales: { title: t('queue.noSales'), message: t('queue.noSalesNotifications') },
        scans: { title: t('queue.noScans'), message: t('queue.noScanNotifications') }
      };
      
      const emptyMessage = emptyMessages[activeTab];
      
      return (
        <div className="p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h4 className="font-medium text-gray-700 mb-1">{emptyMessage.title}</h4>
          <p className="text-gray-500 text-sm">{emptyMessage.message}</p>
        </div>
      );
    }

    return (
      <div className="max-h-64 overflow-y-auto">
        {notifications.map((notification) => renderNotificationItem(notification))}
      </div>
    );
  };

  // Render individual notification item
  const renderNotificationItem = (notification) => {
    const icons = {
      queue: <Package className={`w-4 h-4 ${!notification.isRead ? 'text-blue-600' : 'text-gray-600'}`} />,
      sales: <ShoppingCart className={`w-4 h-4 ${!notification.isRead ? 'text-green-600' : 'text-gray-600'}`} />,
      scans: <Camera className={`w-4 h-4 ${!notification.isRead ? 'text-purple-600' : 'text-gray-600'}`} />
    };

    return (
      <div
        key={notification.id}
        className={`
          border-b border-gray-100 p-4 hover:bg-gray-50 cursor-pointer
          ${!notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
        `}
        onClick={() => !notification.isRead && markAsRead(notification.id, activeTab)}
      >
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={`
            p-2 rounded-full flex-shrink-0
            ${!notification.isRead ? 'bg-blue-100' : 'bg-gray-100'}
          `}>
            {icons[activeTab]}
          </div>

          <div className="flex-1 min-w-0">
            {activeTab === 'queue' && renderQueueNotification(notification)}
            {activeTab === 'sales' && renderSalesNotification(notification)}
            {activeTab === 'scans' && renderScansNotification(notification)}
          </div>
        </div>
      </div>
    );
  };

  // Render queue notification details (keep for completeness)
  const renderQueueNotification = (notification) => (
    <>
      {/* Vendor & Status */}
      <div className="flex items-center justify-between mb-1">
        <h4 className={`font-medium truncate ${!notification.isRead ? 'text-blue-900' : 'text-gray-700'}`}>
          {notification.vendor}
        </h4>
        {!notification.isRead && (
          <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
        )}
      </div>

      {/* Items & Images Info */}
      <div className="flex items-center gap-4 mb-2 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Package className="w-3 h-3" />
          <span>{notification.totalItems} items</span>
        </div>
        {notification.imageCount > 0 && (
          <div className="flex items-center gap-1">
            <Image className="w-3 h-3" />
            <span>{notification.imageCount} image{notification.imageCount > 1 ? 's' : ''}</span>
            {notification.isMultiPage && (
              <span className="bg-purple-100 text-purple-800 px-1 py-0.5 rounded text-xs">
                Multi-page
              </span>
            )}
          </div>
        )}
      </div>

      {/* Amount & Timestamp */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-green-600">
          ${notification.totalAmount?.toFixed(2) || '0.00'}
        </span>
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{formatTimestamp(notification.syncTimestamp)}</span>
        </div>
      </div>

      {/* Source Info */}
      <div className="mt-1">
        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
          <Smartphone className="w-3 h-3" />
          {t('notifications.queueNumber')}{notification.queueId?.slice(-8) || 'Unknown'}
        </span>
      </div>
    </>
  );

  // Render sales notification details
  const renderSalesNotification = (notification) => (
    <>
      {/* Product Name & Status */}
      <div className="flex items-center justify-between mb-1">
        <h4 className={`font-medium truncate ${!notification.isRead ? 'text-green-900' : 'text-gray-700'}`}>
          {notification.productName || 'Unknown Product'}
        </h4>
        {!notification.isRead && (
          <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>
        )}
      </div>

      {/* Sale Details */}
      <div className="flex items-center gap-4 mb-2 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span>Qty: {notification.quantity}</span>
        </div>
        {notification.barcode && (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs">{notification.barcode}</span>
          </div>
        )}
      </div>

      {/* Amount & Timestamp */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-green-600">
          ${notification.total?.toFixed(2) || '0.00'}
        </span>
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{formatTimestamp(notification.timestamp)}</span>
        </div>
      </div>

      {/* Source Info */}
      <div className="mt-1">
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs">
          <ShoppingCart className="w-3 h-3" />
          {t('notifications.mobileSale')}
        </span>
      </div>
    </>
  );

  // Render scans notification details
  const renderScansNotification = (notification) => (
    <>
      {/* Vendor/Product & Status */}
      <div className="flex items-center justify-between mb-1">
        <h4 className={`font-medium truncate ${!notification.isRead ? 'text-purple-900' : 'text-gray-700'}`}>
          {notification.vendor || notification.productName || 'Recent Scan'}
        </h4>
        {!notification.isRead && (
          <span className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></span>
        )}
      </div>

      {/* Scan Details */}
      <div className="flex items-center gap-4 mb-2 text-sm text-gray-600">
        {notification.totalItems && (
          <div className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            <span>{notification.totalItems} items</span>
          </div>
        )}
        {notification.barcode && (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs">{notification.barcode}</span>
          </div>
        )}
      </div>
      
      {/* Additional Fields from Content Understanding */}
      {notification.additionalFields && Object.keys(notification.additionalFields).length > 0 && (
        <div className="mb-2 p-2 bg-gray-50 rounded text-xs">
          <div className="font-medium text-gray-700 mb-1">Additional Info:</div>
          {Object.entries(notification.additionalFields).slice(0, 3).map(([key, value]) => (
            <div key={key} className="text-gray-600">
              {key}: {value}
            </div>
          ))}
          {Object.keys(notification.additionalFields).length > 3 && (
            <div className="text-gray-500 italic">+{Object.keys(notification.additionalFields).length - 3} more</div>
          )}
        </div>
      )}
      
      {/* Processing Method Indicator */}
      {notification.processingMethod && (
        <div className="mb-1">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${
            notification.processingMethod === 'content_understanding' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            {notification.processingMethod === 'content_understanding' ? `✨ ${t('scans.aiEnhanced')}` : t('scans.standard')}
          </span>
        </div>
      )}

      {/* Amount & Timestamp */}
      <div className="flex items-center justify-between text-sm">
        {notification.totalAmount && (
          <span className="font-medium text-green-600">
            ${notification.totalAmount.toFixed(2)}
          </span>
        )}
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{formatTimestamp(notification.timestamp)}</span>
        </div>
      </div>

      {/* Source Info & Image */}
      <div className="mt-1 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs">
          <Camera className="w-3 h-3" />
          {t('notifications.mobileScan')}
        </span>
        
        {/* FIXED: Add image preview for scan notifications - handles both single and multi-page */}
        {notification.imagePath && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Handle both single and multi-page images
              let images = [];
              
              // Check if imagePath starts with '[' or '{' to detect JSON
              if (notification.imagePath.startsWith('[')) {
                try {
                  // Multi-page: Parse JSON array of image paths
                  const imagePaths = JSON.parse(notification.imagePath);
                  if (Array.isArray(imagePaths)) {
                    images = imagePaths.map((path, index) => ({
                      url: `${apiConfig.getBaseUrl()}/${path}`,
                      path: path,
                      page: index + 1,
                      type: 'page'
                    }));
                  }
                } catch (e) {
                  console.warn('🚨 [NOTIFICATION] Failed to parse multi-page JSON:', e);
                }
              } else {
                // Single image: Direct path string (most common case)
                const imagePath = notification.imagePath.startsWith('/') 
                  ? notification.imagePath.substring(1) 
                  : notification.imagePath;
                images = [{
                  url: `${apiConfig.getBaseUrl()}/${imagePath}`,
                  path: imagePath,
                  page: 1,
                  type: 'single'
                }];
              }
              
              // Open image in new window
              if (images.length > 0) {
                const imageUrl = images[0].url;
                window.open(imageUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                console.log(`🖼️ [NOTIFICATION] Opening image: ${imageUrl}`);
                console.log(`🔍 [NOTIFICATION] Original imagePath: "${notification.imagePath}"`);
                console.log(`📊 [NOTIFICATION] Parsed ${images.length} image(s)`);
              } else {
                console.warn('🚨 [NOTIFICATION] No images parsed from imagePath:', notification.imagePath);
              }
            }}
            className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium shadow-sm transition-colors"
            title={notification.isMultiPage ? `View ${notification.imageCount || 1} images` : 'View invoice image'}
          >
            {notification.isMultiPage ? (
              <ImagesIcon className="w-4 h-4" />
            ) : (
              <Image className="w-4 h-4" />
            )}
            <span className="ml-1">
              {notification.isMultiPage ? `View ${notification.imageCount || 1} Images` : 'View Image'}
            </span>
          </button>
        )}
      </div>
    </>
  );

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      {/* Notification Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`
          relative p-2 rounded-lg transition-all duration-200
          ${totalUnreadCount > 0 
            ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg animate-pulse' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          }
          ${showPanel ? 'ring-2 ring-blue-300' : ''}
        `}
        title={t('notifications.mobileSyncTitle')}
      >
        <div className="relative">
          <Smartphone className="w-5 h-5" />
          {totalUnreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-bounce">
              {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
            </span>
          )}
        </div>
      </button>

      {/* Notification Panel */}
      {showPanel && (
        <div className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-2xl border z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              <h3 className="font-semibold">{t('notifications.mobileSync')}</h3>
              {totalUnreadCount > 0 && (
                <span className="bg-red-500 px-2 py-1 rounded-full text-xs font-bold">
                  {totalUnreadCount} {t('notifications.new')}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="hover:bg-white/20 p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="bg-gray-50 border-b flex">
            <button
              onClick={() => setActiveTab('sales')}
              className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 ${
                activeTab === 'sales' 
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Sales
              {salesNotifications.filter(n => !n.isRead).length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {salesNotifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('scans')}
              className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 ${
                activeTab === 'scans' 
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              Scans
              {scansNotifications.filter(n => !n.isRead).length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {scansNotifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="p-4 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-600 text-sm">{t('notifications.loadingNotifications')}</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={fetchNotifications}
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          )}

          {/* Notifications List */}
          {!isLoading && !error && (
            <>
              {renderNotificationContent()}

              {/* Footer Actions */}
              {getCurrentNotifications().length > 0 && (
                <div className="p-3 bg-gray-50 flex items-center justify-between text-sm">
                  <button
                    onClick={fetchAllNotifications}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="w-3 h-3" />
                    Refresh
                  </button>
                  <button
                    onClick={clearAllNotifications}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear All
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default QueueNotificationButton;