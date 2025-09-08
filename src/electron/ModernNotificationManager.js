/**
 * ModernNotificationManager.js - Minimal modern notification system
 * Clean, minimal notifications with multi-language support
 */

class ModernNotificationManager {
  constructor(db = null) {
    this.notifications = [];
    this.maxNotifications = 20;
    this.listeners = [];
    this.currentLanguage = 'en'; // Default language
    this.db = db; // SQLite database connection
    this.isInitialized = false;
  }

  /**
   * Initialize notification manager with database
   */
  async initialize(db) {
    if (!db) {
      console.warn('⚠️ ModernNotificationManager: No database provided, using memory-only mode');
      return;
    }
    
    this.db = db;
    
    // Load existing notifications from database
    await this.loadFromDatabase();
    
    // Clean up expired notifications
    await this.cleanupExpired();
    
    this.isInitialized = true;
    console.log('✅ ModernNotificationManager initialized with database');
  }

  /**
   * Load notifications from database on startup
   */
  async loadFromDatabase() {
    if (!this.db) return;
    
    try {
      const rows = await new Promise((resolve, reject) => {
        this.db.all(
          `SELECT * FROM modern_notifications 
           WHERE datetime(expires_at) > datetime('now')
           ORDER BY timestamp DESC
           LIMIT ?`,
          [this.maxNotifications],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
      
      this.notifications = rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        icon: row.icon,
        color: row.color,
        priority: row.priority,
        timestamp: row.timestamp,
        read: row.read === 1,
        action: row.action ? JSON.parse(row.action) : null
      }));
      
      console.log(`📋 Loaded ${this.notifications.length} notifications from database`);
    } catch (error) {
      console.error('❌ Error loading notifications from database:', error);
    }
  }

  /**
   * Save notification to database
   */
  async saveToDatabase(notification) {
    if (!this.db) return;
    
    try {
      await new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO modern_notifications 
           (id, type, title, message, icon, color, priority, timestamp, read, action)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            notification.id,
            notification.type,
            notification.title,
            notification.message || null,
            notification.icon || null,
            notification.color || null,
            notification.priority || 'normal',
            notification.timestamp,
            notification.read ? 1 : 0,
            notification.action ? JSON.stringify(notification.action) : null
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (error) {
      console.error('❌ Error saving notification to database:', error);
    }
  }

  /**
   * Update notification read status in database
   */
  async updateReadStatus(notificationId, read) {
    if (!this.db) return;
    
    try {
      await new Promise((resolve, reject) => {
        this.db.run(
          `UPDATE modern_notifications SET read = ? WHERE id = ?`,
          [read ? 1 : 0, notificationId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (error) {
      console.error('❌ Error updating notification read status:', error);
    }
  }

  /**
   * Delete notification from database
   */
  async deleteFromDatabase(notificationId) {
    if (!this.db) return;
    
    try {
      await new Promise((resolve, reject) => {
        this.db.run(
          `DELETE FROM modern_notifications WHERE id = ?`,
          [notificationId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (error) {
      console.error('❌ Error deleting notification from database:', error);
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpired() {
    if (!this.db) return;
    
    try {
      const result = await new Promise((resolve, reject) => {
        this.db.run(
          `DELETE FROM modern_notifications 
           WHERE datetime(expires_at) <= datetime('now')`,
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });
      
      if (result > 0) {
        console.log(`🗑️ Cleaned up ${result} expired notifications`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up expired notifications:', error);
    }
  }

  /**
   * Set language for notifications
   */
  setLanguage(lang) {
    this.currentLanguage = lang;
    console.log(`🌐 Notification language set to: ${lang}`);
  }

  /**
   * Translation strings
   */
  getTranslations() {
    return {
      en: {
        invoice_processed: 'Invoice processed',
        invoice_queued: 'Invoice queued', 
        product_sold: 'Product sold',
        mobile_connected: 'Mobile connected',
        mobile_disconnected: 'Mobile disconnected',
        error_occurred: 'Error occurred',
        items: 'items',
        item: 'item',
        sold_for: 'sold for',
        from: 'from',
        just_now: 'Just now',
        minutes_ago: 'm ago',
        hours_ago: 'h ago',
        days_ago: 'd ago'
      },
      fr: {
        invoice_processed: 'Facture traitée',
        invoice_queued: 'Facture mise en file',
        product_sold: 'Produit vendu',
        mobile_connected: 'Mobile connecté',
        mobile_disconnected: 'Mobile déconnecté',
        error_occurred: 'Erreur survenue',
        items: 'articles',
        item: 'article',
        sold_for: 'vendu pour',
        from: 'de',
        just_now: 'À l\'instant',
        minutes_ago: 'min',
        hours_ago: 'h',
        days_ago: 'j'
      },
      ar: {
        invoice_processed: 'تمت معالجة الفاتورة',
        invoice_queued: 'تم وضع الفاتورة في الصف',
        product_sold: 'تم بيع المنتج',
        mobile_connected: 'تم توصيل الهاتف',
        mobile_disconnected: 'تم فصل الهاتف',
        error_occurred: 'حدث خطأ',
        items: 'عناصر',
        item: 'عنصر',
        sold_for: 'بيع مقابل',
        from: 'من',
        just_now: 'الآن',
        minutes_ago: 'د',
        hours_ago: 'س',
        days_ago: 'ي'
      },
      es: {
        invoice_processed: 'Factura procesada',
        invoice_queued: 'Factura en cola',
        product_sold: 'Producto vendido',
        mobile_connected: 'Móvil conectado',
        mobile_disconnected: 'Móvil desconectado',
        error_occurred: 'Error ocurrido',
        items: 'artículos',
        item: 'artículo',
        sold_for: 'vendido por',
        from: 'de',
        just_now: 'Ahora',
        minutes_ago: 'min',
        hours_ago: 'h',
        days_ago: 'd'
      },
      de: {
        invoice_processed: 'Rechnung verarbeitet',
        invoice_queued: 'Rechnung in Warteschlange',
        product_sold: 'Produkt verkauft',
        mobile_connected: 'Mobil verbunden',
        mobile_disconnected: 'Mobil getrennt',
        error_occurred: 'Fehler aufgetreten',
        items: 'Artikel',
        item: 'Artikel',
        sold_for: 'verkauft für',
        from: 'von',
        just_now: 'Jetzt',
        minutes_ago: 'Min',
        hours_ago: 'Std',
        days_ago: 'T'
      }
    };
  }

  /**
   * Get translated text
   */
  t(key) {
    const translations = this.getTranslations();
    return translations[this.currentLanguage]?.[key] || translations.en[key] || key;
  }

  /**
   * Add minimal notification
   */
  async addNotification(type, data = {}) {
    const notification = {
      id: this.generateId(),
      type,
      timestamp: Date.now(),
      read: false,
      ...this.formatNotificationData(type, data)
    };

    this.notifications.unshift(notification);
    
    // Log notification creation for debugging
    console.log(`📢 [NOTIFICATION] Created: ${notification.type}`, {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      totalNotifications: this.notifications.length
    });
    
    // Keep only recent notifications in memory
    if (this.notifications.length > this.maxNotifications) {
      const removed = this.notifications.splice(this.maxNotifications);
      // Remove excess notifications from database
      for (const notif of removed) {
        await this.deleteFromDatabase(notif.id);
      }
    }

    // Save to database for persistence
    await this.saveToDatabase(notification);

    // Don't auto-expire notifications - let the user dismiss them
    // This was causing notifications to disappear too quickly
    // if (notification.priority !== 'high') {
    //   setTimeout(() => {
    //     this.removeNotification(notification.id);
    //   }, 5000);
    // }

    this.notifyListeners('new', notification);
    return notification;
  }

  /**
   * Format notification data based on type
   */
  formatNotificationData(type, data) {
    switch (type) {
      case 'invoice_processed':
        return {
          title: this.t('invoice_processed'),
          message: `${data.vendor} • ${data.totalItems} ${data.totalItems === 1 ? this.t('item') : this.t('items')}`,
          icon: '📄',
          color: '#10B981', // Green
          priority: 'normal',
          action: data.invoiceId ? { type: 'view_invoice', id: data.invoiceId } : null
        };

      case 'invoice_queued':
        return {
          title: this.t('invoice_queued'),
          message: `${data.vendor} • ${data.totalItems} ${data.totalItems === 1 ? this.t('item') : this.t('items')}`,
          icon: '⏳',
          color: '#F59E0B', // Amber
          priority: 'low',
          action: null
        };

      case 'product_sold':
        return {
          title: this.t('product_sold'),
          message: `${data.quantity}x ${data.productName} • DA ${data.totalPrice}`,
          icon: '💰',
          color: '#10B981', // Green
          priority: 'normal',
          action: data.saleId ? { type: 'view_sale', id: data.saleId } : null
        };

      case 'mobile_connected':
        return {
          title: this.t('mobile_connected'),
          message: data.ip || '',
          icon: '📱',
          color: '#10B981', // Green
          priority: 'low',
          action: null
        };

      case 'mobile_disconnected':
        return {
          title: this.t('mobile_disconnected'),
          message: '',
          icon: '📱',
          color: '#6B7280', // Gray
          priority: 'low',
          action: null
        };

      case 'error':
        return {
          title: this.t('error_occurred'),
          message: data.message || '',
          icon: '⚠️',
          color: '#EF4444', // Red
          priority: 'high',
          action: null
        };

      default:
        return {
          title: data.title || type,
          message: data.message || '',
          icon: '📢',
          color: '#3B82F6', // Blue
          priority: 'normal',
          action: null
        };
    }
  }

  /**
   * Invoice processing notification
   */
  notifyInvoiceProcessed(invoiceData) {
    return this.addNotification('invoice_processed', {
      vendor: invoiceData.vendor,
      totalItems: invoiceData.totalItems || invoiceData.items?.length || 0,
      invoiceId: invoiceData.id || invoiceData.requestId
    });
  }

  /**
   * Invoice queued notification
   */
  notifyInvoiceQueued(queueData) {
    return this.addNotification('invoice_queued', {
      vendor: queueData.vendor,
      totalItems: queueData.totalItems || 0
    });
  }

  /**
   * Product sale notification
   */
  notifyProductSold(saleData) {
    return this.addNotification('product_sold', {
      quantity: saleData.quantity,
      productName: saleData.productName,
      totalPrice: saleData.totalPrice,
      saleId: saleData.id
    });
  }

  /**
   * Mobile connection notification
   */
  notifyMobileConnection(connectionData) {
    return this.addNotification(
      connectionData.connected ? 'mobile_connected' : 'mobile_disconnected',
      { ip: connectionData.ip }
    );
  }

  /**
   * Error notification
   */
  notifyError(errorData) {
    return this.addNotification('error', {
      message: errorData.message || errorData.error || 'Unknown error'
    });
  }

  /**
   * Get all notifications
   */
  getNotifications(filters = {}) {
    let filtered = [...this.notifications];

    if (filters.unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }

    if (filters.limit) {
      filtered = filtered.slice(0, parseInt(filters.limit));
    }

    console.log(`📋 [NOTIFICATION] Fetching notifications:`, {
      total: this.notifications.length,
      filtered: filtered.length,
      filters: filters
    });

    return filtered;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      // Update in database
      await this.updateReadStatus(notificationId, true);
      this.notifyListeners('read', notification);
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    let markedCount = 0;
    
    for (const notification of this.notifications) {
      if (!notification.read) {
        notification.read = true;
        await this.updateReadStatus(notification.id, true);
        markedCount++;
      }
    }
    
    if (markedCount > 0) {
      this.notifyListeners('all_read', { count: markedCount });
    }
    
    return markedCount;
  }

  /**
   * Remove notification
   */
  async removeNotification(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index > -1) {
      const [removed] = this.notifications.splice(index, 1);
      // Delete from database
      await this.deleteFromDatabase(notificationId);
      this.notifyListeners('removed', removed);
      return true;
    }
    return false;
  }

  /**
   * Clear all notifications
   */
  async clearAll() {
    const count = this.notifications.length;
    
    // Clear from database
    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          this.db.run(
            `DELETE FROM modern_notifications`,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } catch (error) {
        console.error('❌ Error clearing all notifications from database:', error);
      }
    }
    
    this.notifications = [];
    this.notifyListeners('cleared', { count });
    return count;
  }

  /**
   * Get notification statistics
   */
  getStats() {
    const total = this.notifications.length;
    const unread = this.notifications.filter(n => !n.read).length;
    
    return {
      total,
      unread,
      read: total - unread
    };
  }

  /**
   * Format notification for API response (compatibility method)
   * This method is called by the server endpoints
   */
  formatNotification(notification) {
    if (!notification) return null;
    
    // Return notification with formatted time ago
    return {
      ...notification,
      timeAgo: this.getTimeAgo(notification.timestamp),
      formattedTime: new Date(notification.timestamp).toLocaleTimeString()
    };
  }

  /**
   * Format time ago
   */
  getTimeAgo(timestamp) {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return this.t('just_now');
    if (diffMinutes < 60) return `${diffMinutes} ${this.t('minutes_ago')}`;
    if (diffHours < 24) return `${diffHours} ${this.t('hours_ago')}`;
    return `${diffDays} ${this.t('days_ago')}`;
  }

  /**
   * Event listener management
   */
  addEventListener(callback) {
    this.listeners.push(callback);
  }

  removeEventListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

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
   * Generate unique ID
   */
  generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

module.exports = ModernNotificationManager;