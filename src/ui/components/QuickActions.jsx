import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { 
  Command, Search, Plus, CreditCard, BarChart3, Package, 
  FileText, X, Keyboard, ArrowRight 
} from "lucide-react";

export default function QuickActions({ isOpen, onClose, onNavigate }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");

  const actions = [
    { id: "dashboard", label: t('nav.dashboard'), icon: BarChart3, shortcut: "⌘1", page: "stats" },
    { id: "add-product", label: t('nav.addProduct'), icon: Plus, shortcut: "⌘N", page: "add" },
    { id: "inventory", label: t('common.viewInventory'), icon: Package, shortcut: "⌘2", page: "list" },
    { id: "add-debt", label: t('debts.addNewDebt'), icon: CreditCard, shortcut: "⌘D", page: "debt" },
    { id: "scans", label: t('nav.recentScans'), icon: FileText, shortcut: "⌘3", page: "scans" },
  ];

  const filteredActions = actions.filter(action =>
    action.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gaming-gray border border-gaming-yellow/50 rounded-xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gaming-purple/30">
          <div className="flex items-center space-x-3">
            <Command className="text-gaming-yellow" size={24} />
            <h2 className="text-gaming-yellow font-bold text-lg">{t('common.quickActions')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gaming-purple hover:text-gaming-yellow transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gaming-purple/30">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gaming-purple" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('common.searchActions')}
              className="w-full pl-10 pr-4 py-3 bg-gaming-black border border-gaming-purple/50 rounded-lg text-gaming-yellow placeholder-gray-600 focus:border-gaming-yellow focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Actions List */}
        <div className="max-h-96 overflow-y-auto p-4">
          {filteredActions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gaming-purple">{t('common.noActionsFound')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    onNavigate(action.page);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 bg-gaming-black border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow hover:bg-gaming-black/50 transition-all group"
                >
                  <div className="flex items-center space-x-3">
                    <action.icon className="text-gaming-purple group-hover:text-gaming-yellow" size={20} />
                    <span className="text-gaming-yellow font-medium">{action.label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gaming-purple text-sm">{action.shortcut}</span>
                    <ArrowRight className="text-gaming-purple group-hover:text-gaming-yellow" size={16} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with shortcuts help */}
        <div className="p-4 border-t border-gaming-purple/30 bg-gaming-black/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Keyboard className="text-gaming-purple" size={16} />
                <span className="text-gaming-purple">{t('common.pressToOpen')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gaming-purple">{t('common.escToClose')}</span>
              </div>
            </div>
            <span className="text-gaming-purple/50">{t('common.enterToSelect')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}