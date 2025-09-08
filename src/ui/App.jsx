// File: src/ui/App.jsx
import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import AddProductPage from "./components/AddProductPage";
import ProductListPage from "./components/ViewProductsPage";
import RecentScansPage from "./components/RecentScansPage";
import RecentSalesPage from "./components/RecentSalesPage";
import StatsPage from "./components/StatsPage";
import DebtPage from "./components/DebtPage";
import QuickActions from "./components/QuickActions";
import DashboardHeaderOption7 from "./components/DashboardHeaderOption7";
import LanguageSwitcher from "./components/LanguageSwitcher";
import ModernNotifications from "./components/ModernNotifications";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { apiOperations } from "./utils/api";
import Lottie from "lottie-react";
import { gamingLoaderAnimation } from "./assets/animations";
import { 
  PlusSquare, 
  List, 
  Settings, 
  Package, 
  FileText, 
  BarChart3,
  Gamepad2,
  Trophy,
  Zap,
  CreditCard,
  Wifi,
  WifiOff,
  AlertCircle,
  ShoppingCart
} from "lucide-react";
import "../index.css";

export default function App() {
  const { t, i18n } = useTranslation();
  const [selectedPage, setSelectedPage] = useState("stats");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('checking'); // 'online', 'offline', 'checking'
  const [error, setError] = useState(null);
  
  // Set initial direction based on language
  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Check server connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await apiOperations.healthCheck();
        setConnectionStatus('online');
        setError(null);
      } catch (error) {
        console.error('Connection check failed:', error);
        setConnectionStatus('offline');
        setError(t('common.connectionError'));
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handlePageChange = (page) => {
    setIsLoading(true);
    setTimeout(() => {
      setSelectedPage(page);
      setIsLoading(false);
    }, 300);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'k', ctrl: true, callback: () => setShowQuickActions(true) },
    { key: '1', ctrl: true, callback: () => handlePageChange('stats') },
    { key: '2', ctrl: true, callback: () => handlePageChange('list') },
    { key: '3', ctrl: true, callback: () => handlePageChange('debt') },
    { key: 'n', ctrl: true, callback: () => handlePageChange('add') },
    { key: 'd', ctrl: true, callback: () => handlePageChange('debt') },
  ]);

  const tabs = [
    { id: "stats", label: t('nav.dashboard'), icon: BarChart3, color: "text-gaming-yellow" },
    { id: "add", label: t('nav.addProduct'), icon: PlusSquare, color: "text-gaming-purple" },
    { id: "list", label: t('nav.inventory'), icon: Package, color: "text-gaming-yellow" },
    { id: "sales", label: t('nav.recentSales'), icon: ShoppingCart, color: "text-gaming-purple" },
    { id: "debt", label: t('nav.debts'), icon: CreditCard, color: "text-gaming-purple" },
    { id: "scans", label: t('nav.recentScans'), icon: FileText, color: "text-gaming-yellow" },
  ];

  return (
    <div className="flex flex-col h-screen bg-gaming-black">
      {/* macOS Style Title Bar */}
      <div className="bg-gaming-gray border-b border-gaming-yellow/20 px-4 py-3 flex items-center justify-between draggable">
        <div className="flex items-center space-x-2">
          <Gamepad2 className="text-gaming-yellow" size={24} />
          <span className="text-gaming-yellow font-bold text-lg">{t('brand.name')}</span>
          <Trophy className="text-gaming-purple" size={20} />
        </div>
        <div className="flex items-center space-x-3 non-draggable">
          <div className="non-draggable">
            <LanguageSwitcher />
          </div>
          <div className="non-draggable">
            <ModernNotifications />
          </div>
          <div className="flex items-center space-x-2">
            {connectionStatus === 'online' ? (
              <Wifi className="text-green-400" size={16} />
            ) : connectionStatus === 'offline' ? (
              <WifiOff className="text-red-400" size={16} />
            ) : (
              <div className="w-4 h-4 border-2 border-gaming-purple border-t-transparent rounded-full animate-spin"></div>
            )}
            <span className={`text-xs ${
              connectionStatus === 'online' ? 'text-green-400' : 
              connectionStatus === 'offline' ? 'text-red-400' : 'text-gaming-purple'
            }`}>
              {connectionStatus === 'online' ? t('common.connected') : 
               connectionStatus === 'offline' ? t('common.disconnected') : t('common.loading')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="text-gaming-yellow animate-pulse" size={20} />
            <span className="text-gaming-purple text-sm">{t('brand.version')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer transition-colors" 
              title={t('common.close')}
              onClick={() => window.electron?.windowClose()}
            ></div>
            <div 
              className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer transition-colors" 
              title={t('common.minimize')}
              onClick={() => window.electron?.windowMinimize()}
            ></div>
            <div 
              className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer transition-colors" 
              title={t('common.maximize')}
              onClick={() => window.electron?.windowMaximize()}
            ></div>
          </div>
        </div>
      </div>

      {/* macOS Style Tabs */}
      <div className="bg-gaming-dark border-b border-gaming-purple/30 px-4 py-2">
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handlePageChange(tab.id)}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-all duration-200
                ${selectedPage === tab.id 
                  ? 'bg-gaming-black border-t border-l border-r border-gaming-yellow/50 -mb-px z-10' 
                  : 'bg-gaming-gray/50 hover:bg-gaming-gray border border-transparent hover:border-gaming-purple/30'
                }
              `}
            >
              <tab.icon 
                size={18} 
                className={selectedPage === tab.id ? tab.color : 'text-gray-500'}
              />
              <span className={`
                text-sm font-medium
                ${selectedPage === tab.id ? tab.color : 'text-gray-500'}
              `}>
                {tab.label}
              </span>
              {selectedPage === tab.id && (
                <div className="w-2 h-2 rounded-full bg-gaming-yellow animate-pulse ml-2"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gaming-gray border-r border-gaming-purple/30 shadow-xl">
          <div className="p-4">
            <div className="bg-gradient-to-br from-gaming-yellow/20 to-gaming-purple/20 rounded-xl p-4 mb-4 border border-gaming-yellow/30">
              <div className="flex items-center justify-between mb-2">
                <Gamepad2 className="text-gaming-yellow" size={32} />
                <div className="w-16 h-16">
                  <Lottie animationData={gamingLoaderAnimation} loop={true} />
                </div>
              </div>
              <h3 className="text-gaming-yellow font-bold text-lg">{t('brand.name')}</h3>
              <p className="text-gaming-purple text-sm">{t('brand.tagline')}</p>
            </div>
          </div>
          
          <ul className="p-4 space-y-2">
            <li>
              <button
                onClick={() => handlePageChange("stats")}
                className={`
                  flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200
                  ${selectedPage === "stats" 
                    ? 'bg-gradient-to-r from-gaming-yellow/30 to-gaming-purple/30 border border-gaming-yellow/50 shadow-lg animate-glow' 
                    : 'bg-gaming-black/50 hover:bg-gaming-black border border-transparent hover:border-gaming-purple/30'
                  }
                `}
              >
                <BarChart3 size={20} className={selectedPage === "stats" ? "text-gaming-yellow" : "text-gaming-purple"} />
                <span className={selectedPage === "stats" ? "text-gaming-yellow font-bold" : "text-gaming-purple"}>
                  {t('nav.dashboard')}
                </span>
              </button>
            </li>
            <li>
              <button
                onClick={() => handlePageChange("add")}
                className={`
                  flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200
                  ${selectedPage === "add" 
                    ? 'bg-gradient-to-r from-gaming-yellow/30 to-gaming-purple/30 border border-gaming-yellow/50 shadow-lg animate-glow' 
                    : 'bg-gaming-black/50 hover:bg-gaming-black border border-transparent hover:border-gaming-purple/30'
                  }
                `}
              >
                <PlusSquare size={20} className={selectedPage === "add" ? "text-gaming-yellow" : "text-gaming-purple"} />
                <span className={selectedPage === "add" ? "text-gaming-yellow font-bold" : "text-gaming-purple"}>
                  {t('nav.addProduct')}
                </span>
              </button>
            </li>
            <li>
              <button
                onClick={() => handlePageChange("list")}
                className={`
                  flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200
                  ${selectedPage === "list" 
                    ? 'bg-gradient-to-r from-gaming-yellow/30 to-gaming-purple/30 border border-gaming-yellow/50 shadow-lg animate-glow' 
                    : 'bg-gaming-black/50 hover:bg-gaming-black border border-transparent hover:border-gaming-purple/30'
                  }
                `}
              >
                <Package size={20} className={selectedPage === "list" ? "text-gaming-yellow" : "text-gaming-purple"} />
                <span className={selectedPage === "list" ? "text-gaming-yellow font-bold" : "text-gaming-purple"}>
                  {t('nav.inventory')}
                </span>
              </button>
            </li>
            <li>
              <button
                onClick={() => handlePageChange("debt")}
                className={`
                  flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200
                  ${selectedPage === "debt" 
                    ? 'bg-gradient-to-r from-gaming-yellow/30 to-gaming-purple/30 border border-gaming-yellow/50 shadow-lg animate-glow' 
                    : 'bg-gaming-black/50 hover:bg-gaming-black border border-transparent hover:border-gaming-purple/30'
                  }
                `}
              >
                <CreditCard size={20} className={selectedPage === "debt" ? "text-gaming-yellow" : "text-gaming-purple"} />
                <span className={selectedPage === "debt" ? "text-gaming-yellow font-bold" : "text-gaming-purple"}>
                  {t('nav.debtManager')}
                </span>
              </button>
            </li>
            <li>
              <button
                onClick={() => handlePageChange("scans")}
                className={`
                  flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200
                  ${selectedPage === "scans" 
                    ? 'bg-gradient-to-r from-gaming-yellow/30 to-gaming-purple/30 border border-gaming-yellow/50 shadow-lg animate-glow' 
                    : 'bg-gaming-black/50 hover:bg-gaming-black border border-transparent hover:border-gaming-purple/30'
                  }
                `}
              >
                <FileText size={20} className={selectedPage === "scans" ? "text-gaming-yellow" : "text-gaming-purple"} />
                <span className={selectedPage === "scans" ? "text-gaming-yellow font-bold" : "text-gaming-purple"}>
                  {t('nav.recentScans')}
                </span>
              </button>
            </li>
            <li>
              <button
                onClick={() => handlePageChange("sales")}
                className={`
                  flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200
                  ${selectedPage === "sales" 
                    ? 'bg-gradient-to-r from-gaming-yellow/30 to-gaming-purple/30 border border-gaming-yellow/50 shadow-lg animate-glow' 
                    : 'bg-gaming-black/50 hover:bg-gaming-black border border-transparent hover:border-gaming-purple/30'
                  }
                `}
              >
                <ShoppingCart size={20} className={selectedPage === "sales" ? "text-gaming-yellow" : "text-gaming-purple"} />
                <span className={selectedPage === "sales" ? "text-gaming-yellow font-bold" : "text-gaming-purple"}>
                  {t('nav.recentSales')}
                </span>
              </button>
            </li>
            <li>
              <button
                disabled
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-gaming-black/30 text-gray-600 cursor-not-allowed"
              >
                <Settings size={20} />
                <span>{t('nav.settings')}</span>
              </button>
            </li>
          </ul>

        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gaming-black overflow-auto">
          {/* Connection Error Banner */}
          {error && connectionStatus === 'offline' && (
            <div className="bg-red-900/30 border-b border-red-500/50 px-4 py-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-red-400" size={16} />
                <span className="text-red-400 text-sm">{error}</span>
                <button 
                  onClick={() => window.location.reload()} 
                  className="ml-auto px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded hover:bg-red-500/30 transition-colors"
                >
                  {t('scans.tryAgain')}
                </button>
              </div>
            </div>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-32 h-32">
                <Lottie animationData={gamingLoaderAnimation} loop={true} />
              </div>
            </div>
          ) : (
            <>
              {selectedPage === "stats" && <StatsPage />}
              {selectedPage === "add" && <AddProductPage />}
              {selectedPage === "list" && <ProductListPage />}
              {selectedPage === "sales" && <RecentSalesPage />}
              {selectedPage === "debt" && <DebtPage />}
              {selectedPage === "scans" && <RecentScansPage />}
            </>
          )}
        </div>
      </div>

      {/* Quick Actions Modal */}
      <QuickActions 
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onNavigate={handlePageChange}
      />
    </div>
  );
}