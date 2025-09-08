/**
 * DesktopNotificationManager.js - Notification system for desktop app
 * Handles notifications for invoice processing, queue status, and system events
 */

class DesktopNotificationManager {
  constructor() {
    this.notifications = [];
    this.maxNotifications = 50;
    this.listeners = [];
  }

  /**
   * Add a new notification
   */
  addNotification(notification) {
    const newNotification = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      read: false,
      priority: notification.priority || 'normal', // low, normal, high, critical
      ...notification
    };

    this.notifications.unshift(newNotification);
    
    // Keep only recent notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    // Notify listeners
    this.notifyListeners('new', newNotification);

    console.log(`📢 Desktop notification: ${notification.title || notification.message}`);
    return newNotification;
  }

  /**
   * Invoice processing notification
   */
  notifyInvoiceProcessed(invoiceData) {
    const notification = {
      type: 'invoice_processed',
      title: 'Invoice Processed',
      message: `Invoice from ${invoiceData.vendor} with ${invoiceData.totalItems} items processed successfully`,
      priority: 'normal',
      data: {
        vendor: invoiceData.vendor,
        invoiceNumber: invoiceData.invoiceNumber,
        totalItems: invoiceData.totalItems,
        requestId: invoiceData.requestId,
        source: invoiceData.processingMethod || 'mobile-app'
      },
      icon: 'invoice',
      color: '#4CAF50'
    };

    return this.addNotification(notification);
  }

  /**
   * Invoice queued notification (from mobile app)
   */
  notifyInvoiceQueued(queueData) {
    const notification = {
      type: 'invoice_queued',
      title: 'Invoice Queued',
      message: `Invoice from ${queueData.vendor} queued for processing when desktop is available`,
      priority: 'normal',
      data: {
        vendor: queueData.vendor,
        totalItems: queueData.totalItems || queueData.items?.length || 0,
        source: 'mobile-queue'
      },
      icon: 'queue',
      color: '#FF9800'
    };

    return this.addNotification(notification);
  }

  /**
   * System status notification
   */
  notifySystemStatus(status) {
    const notification = {
      type: 'system_status',
      title: status.title || 'System Status',
      message: status.message,
      priority: status.priority || 'low',
      data: status.data || {},
      icon: 'system',
      color: status.color || '#2196F3'
    };

    return this.addNotification(notification);
  }

  /**
   * Mobile app connection notification
   */
  notifyMobileConnection(connectionData) {
    const notification = {
      type: 'mobile_connection',
      title: connectionData.connected ? 'Mobile App Connected' : 'Mobile App Disconnected',
      message: connectionData.connected 
        ? `Mobile app connected from ${connectionData.ip || 'unknown IP'}`
        : 'Mobile app disconnected',
      priority: 'low',
      data: connectionData,
      icon: 'mobile',
      color: connectionData.connected ? '#4CAF50' : '#9E9E9E'
    };

    return this.addNotification(notification);
  }

  /**
   * Product sale notification
   */
  notifyProductSold(saleData) {
    const notification = {
      type: 'product_sold',
      title: 'Product Sold',
      message: `${saleData.quantity}x ${saleData.productName} sold for $${saleData.totalPrice}`,
      priority: 'normal',
      data: saleData,
      icon: 'sale',
      color: '#8BC34A'
    };

    return this.addNotification(notification);
  }

  /**
   * Error notification
   */
  notifyError(errorData) {
    const notification = {
      type: 'error',
      title: errorData.title || 'Error',
      message: errorData.message,
      priority: 'high',
      data: errorData,
      icon: 'error',
      color: '#F44336'
    };

    return this.addNotification(notification);
  }

  /**
   * Get all notifications
   */
  getNotifications(filters = {}) {
    let filtered = this.notifications;

    // Filter by type
    if (filters.type) {
      filtered = filtered.filter(n => n.type === filters.type);
    }

    // Filter by read status
    if (filters.unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }

    // Filter by priority
    if (filters.priority) {
      filtered = filtered.filter(n => n.priority === filters.priority);
    }

    // Limit results
    if (filters.limit) {
      filtered = filtered.slice(0, parseInt(filters.limit));
    }

    return filtered;
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.notifyListeners('updated', notification);
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    let markedCount = 0;
    this.notifications.forEach(notification => {
      if (!notification.read) {
        notification.read = true;
        markedCount++;
      }
    });

    if (markedCount > 0) {
      this.notifyListeners('bulk_updated', { markedCount });
    }

    return markedCount;
  }

  /**
   * Clear old notifications
   */
  clearOldNotifications(olderThanHours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

    const originalLength = this.notifications.length;
    this.notifications = this.notifications.filter(notification => {
      return new Date(notification.timestamp) > cutoffTime;
    });

    const clearedCount = originalLength - this.notifications.length;
    
    if (clearedCount > 0) {
      console.log(`🗑️ Cleared ${clearedCount} old notifications`);
      this.notifyListeners('cleared', { clearedCount });
    }

    return clearedCount;
  }

  /**
   * Get notification statistics
   */
  getStats() {
    const total = this.notifications.length;
    const unread = this.notifications.filter(n => !n.read).length;
    const byType = {};
    const byPriority = {};

    this.notifications.forEach(notification => {
      // Count by type
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      
      // Count by priority
      byPriority[notification.priority] = (byPriority[notification.priority] || 0) + 1;
    });

    return {
      total,
      unread,
      read: total - unread,
      byType,
      byPriority
    };
  }

  /**
   * Add event listener
   */
  addEventListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Notification listener error:', error);
      }
    });
  }

  /**
   * Generate unique notification ID
   */
  generateId() {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format notification for display
   */
  formatNotification(notification) {
    return {
      ...notification,
      timeAgo: this.getTimeAgo(notification.timestamp),
      formattedTimestamp: new Date(notification.timestamp).toLocaleString()
    };
  }

  /**
   * Get human-readable time difference
   */
  getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  }
}

module.exports = DesktopNotificationManager;