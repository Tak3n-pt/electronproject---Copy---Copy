import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, X, Check, Settings } from 'lucide-react';
import { fetchWithTimeout } from '../utils/api';
import apiConfig from '../utils/apiConfig';

const ModernNotifications = () => {
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Language options
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ar', name: 'العربية', flag: '🇩🇿' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
  ];

  // Fetch notifications from server
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await fetchWithTimeout(`${apiConfig.getBaseUrl()}/api/modern-notifications`);
      const data = await response.json();
      
      if (data.success) {
        console.log('📬 [CLIENT] Fetched notifications:', {
          count: data.notifications?.length || 0,
          unread: data.stats?.unread || 0,
          notifications: data.notifications
        });
        setNotifications(data.notifications || []);
        setUnreadCount(data.stats?.unread || 0);
      } else {
        console.error('❌ [CLIENT] Failed to fetch notifications:', data);
      }
    } catch (error) {
      console.error('❌ [CLIENT] Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await fetchWithTimeout(`${apiConfig.getBaseUrl()}/api/modern-notifications/${notificationId}/read`, {
        method: 'POST'
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Remove notification
  const removeNotification = async (notificationId) => {
    try {
      await fetchWithTimeout(`${apiConfig.getBaseUrl()}/api/modern-notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      // Update local state
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  };

  // Clear all notifications
  const clearAll = async () => {
    try {
      await fetchWithTimeout(`${apiConfig.getBaseUrl()}/api/modern-notifications/clear`, {
        method: 'POST'
      });
      
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  // Change language
  const changeLanguage = async (langCode) => {
    try {
      // Update frontend language
      i18n.changeLanguage(langCode);
      
      // Update server notification language
      await fetchWithTimeout(`${apiConfig.getBaseUrl()}/api/modern-notifications/language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: langCode })
      });
      
      // Refresh notifications with new language
      await fetchNotifications();
      
      setShowSettings(false);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle outside click to close panels
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.notification-panel')) {
        setShowPanel(false);
        setShowSettings(false);
      }
    };

    if (showPanel || showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPanel, showSettings]);

  return (
    <div className="relative notification-panel">
      {/* Notification Bell Button */}
      <button
        onClick={() => {
          setShowPanel(!showPanel);
          setShowSettings(false);
        }}
        className={`
          relative p-2.5 rounded-xl transition-all duration-300 shadow-lg
          ${unreadCount > 0 
            ? 'bg-gradient-to-r from-gaming-yellow to-gaming-purple text-white shadow-gaming-yellow/30 hover:shadow-gaming-yellow/50' 
            : 'bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 shadow-gray-200'
          }
          ${showPanel ? 'ring-2 ring-gaming-yellow ring-opacity-50 scale-105' : 'hover:scale-105'}
        `}
        title={t('notifications.title')}
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-bounce shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showPanel && (
        <div className="absolute right-0 top-14 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gaming-yellow to-gaming-purple p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-white" />
              <h3 className="font-semibold text-white">{t('notifications.title')}</h3>
              {unreadCount > 0 && (
                <span className="bg-white bg-opacity-20 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Language Settings */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                }}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title={t('notifications.settings')}
              >
                <Settings className="w-4 h-4 text-white" />
              </button>
              
              {/* Close Button */}
              <button
                onClick={() => setShowPanel(false)}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title={t('common.close')}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Language Settings Dropdown */}
          {showSettings && (
            <div className="border-b border-gray-100 bg-gray-50 p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">{t('notifications.language')}</h4>
              <div className="grid grid-cols-2 gap-2">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg text-sm transition-colors
                      ${i18n.language === lang.code 
                        ? 'bg-gaming-yellow text-white font-medium' 
                        : 'bg-white hover:bg-gray-100 text-gray-700'
                      }
                    `}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="p-6 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-gaming-yellow border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-600 text-sm">{t('common.loading')}</p>
            </div>
          )}

          {/* Notifications List */}
          {!isLoading && (
            <>
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="font-medium text-gray-700 mb-1">{t('notifications.empty')}</h4>
                  <p className="text-gray-500 text-sm">{t('notifications.noNotifications')}</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`
                        p-4 border-b border-gray-100 transition-colors cursor-pointer
                        ${!notification.read 
                          ? 'bg-gradient-to-r from-blue-50 to-transparent hover:from-blue-100' 
                          : 'hover:bg-gray-50'
                        }
                      `}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: notification.color + '20', color: notification.color }}
                        >
                          {notification.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className={`font-medium truncate ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-gaming-yellow rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          
                          {notification.message && (
                            <p className="text-sm text-gray-600 mb-2 truncate">
                              {notification.message}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {new Date(notification.timestamp).toLocaleTimeString(i18n.language, { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                            
                            {/* Action Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                              title={t('common.remove')}
                            >
                              <X className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Actions */}
              {notifications.length > 0 && (
                <div className="p-3 bg-gray-50 flex items-center justify-between">
                  <button
                    onClick={fetchNotifications}
                    className="text-sm text-gaming-purple hover:text-gaming-yellow font-medium transition-colors"
                  >
                    {t('common.refresh')}
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                  >
                    {t('common.clearAll')}
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

export default ModernNotifications;