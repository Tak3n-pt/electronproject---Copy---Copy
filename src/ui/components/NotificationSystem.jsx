import React, { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export const NotificationContext = React.createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message, type = "info", duration = 5000) => {
    const id = Date.now();
    const notification = { id, message, type, duration };
    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      <NotificationContainer 
        notifications={notifications} 
        onRemove={removeNotification} 
      />
    </NotificationContext.Provider>
  );
}

function NotificationContainer({ notifications, onRemove }) {
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onRemove={() => onRemove(notification.id)}
        />
      ))}
    </div>
  );
}

function Notification({ notification, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  };

  const getIcon = () => {
    switch (notification.type) {
      case "success":
        return <CheckCircle className="text-green-400" size={20} />;
      case "error":
        return <AlertCircle className="text-red-400" size={20} />;
      case "warning":
        return <AlertTriangle className="text-yellow-400" size={20} />;
      default:
        return <Info className="text-gaming-purple" size={20} />;
    }
  };

  const getStyles = () => {
    switch (notification.type) {
      case "success":
        return "border-green-500/50 bg-gaming-gray";
      case "error":
        return "border-red-500/50 bg-gaming-gray";
      case "warning":
        return "border-yellow-500/50 bg-gaming-gray";
      default:
        return "border-gaming-purple/50 bg-gaming-gray";
    }
  };

  return (
    <div
      className={`
        flex items-center space-x-3 p-4 rounded-lg border shadow-lg
        ${getStyles()}
        ${isExiting ? "animate-slide-out" : "animate-slide-in"}
        transition-all duration-300
      `}
    >
      {getIcon()}
      <p className="flex-1 text-gaming-yellow text-sm">{notification.message}</p>
      <button
        onClick={handleRemove}
        className="text-gaming-purple hover:text-gaming-yellow transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function useNotification() {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}