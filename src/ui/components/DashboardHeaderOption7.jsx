import { Gamepad2, Bell, Search, User, Settings, LogOut } from 'lucide-react';
import revotecLogo from '../assets/revotec-logo.png';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const DashboardHeaderOption7 = () => {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications] = useState(3);

  return (
    <div className="bg-gradient-to-br from-gaming-dark via-gaming-gray to-gaming-dark p-6 border-b border-gaming-purple/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gaming-black rounded-xl border border-gaming-yellow/30 shadow-lg">
            <img 
              src={revotecLogo} 
              alt="REVOTEC" 
              className="w-8 h-8 object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gaming-yellow tracking-tight">
              Revotec Manager
            </h1>
            <p className="text-sm text-gaming-purple">
              {t('brand.tagline')}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search Bar */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-2.5 text-gaming-purple" size={18} />
            <input
              type="text"
              placeholder={t('common.quickSearch')}
              className="pl-10 pr-4 py-2 bg-gaming-black border border-gaming-purple/30 rounded-lg text-gaming-yellow placeholder-gray-600 focus:border-gaming-yellow focus:outline-none text-sm w-64"
            />
          </div>

          {/* Notifications */}
          <button className="relative p-2 bg-gaming-black border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-colors">
            <Bell className="text-gaming-purple hover:text-gaming-yellow" size={20} />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gaming-yellow text-gaming-black text-xs font-bold rounded-full flex items-center justify-center">
                {notifications}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 p-2 bg-gaming-black border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-colors"
            >
              <User className="text-gaming-purple" size={20} />
              <span className="text-gaming-yellow text-sm hidden md:block">{t('dashboard.admin')}</span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-gaming-gray border border-gaming-purple/30 rounded-lg shadow-xl z-50">
                <button className="w-full px-4 py-2 text-left text-gaming-purple hover:text-gaming-yellow hover:bg-gaming-black/50 transition-colors flex items-center space-x-2">
                  <User size={16} />
                  <span>{t('common.profile')}</span>
                </button>
                <button className="w-full px-4 py-2 text-left text-gaming-purple hover:text-gaming-yellow hover:bg-gaming-black/50 transition-colors flex items-center space-x-2">
                  <Settings size={16} />
                  <span>{t('nav.settings')}</span>
                </button>
                <hr className="border-gaming-purple/30 my-2" />
                <button className="w-full px-4 py-2 text-left text-red-400 hover:text-red-300 hover:bg-gaming-black/50 transition-colors flex items-center space-x-2">
                  <LogOut size={16} />
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeaderOption7;