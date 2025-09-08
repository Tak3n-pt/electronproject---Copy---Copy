import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', dir: 'ltr' }
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(
    languages.find(lang => lang.code === i18n.language) || languages[0]
  );

  useEffect(() => {
    // Update document direction when language changes
    document.documentElement.dir = currentLang.dir;
    document.documentElement.lang = currentLang.code;
    
    // Add specific font class for Arabic
    if (currentLang.code === 'ar') {
      document.body.classList.add('arabic-font');
    } else {
      document.body.classList.remove('arabic-font');
    }
  }, [currentLang]);

  const handleLanguageChange = (lang) => {
    console.log('🌐 Changing language to:', lang.code);
    i18n.changeLanguage(lang.code);
    setCurrentLang(lang);
    setIsOpen(false);
    
    // Store preference
    localStorage.setItem('preferredLanguage', lang.code);
  };

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔄 Language switcher toggle clicked');
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="flex items-center space-x-2 px-3 py-2 bg-gaming-black border border-gaming-purple/30 rounded-lg hover:border-gaming-yellow transition-colors relative z-10"
        style={{ pointerEvents: 'auto' }}
      >
        <Globe className="text-gaming-purple" size={18} />
        <span className="text-gaming-yellow text-sm font-medium">
          {currentLang.flag} {currentLang.name}
        </span>
        <ChevronDown 
          className={`text-gaming-purple transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          size={16} 
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-48 bg-gaming-gray border border-gaming-purple/30 rounded-lg shadow-xl z-[9999] overflow-hidden">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLanguageChange(lang);
              }}
              className={`
                w-full px-4 py-3 flex items-center justify-between
                hover:bg-gaming-black/50 transition-colors
                ${currentLang.code === lang.code ? 'bg-gaming-black/30' : ''}
              `}
              style={{ pointerEvents: 'auto' }}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{lang.flag}</span>
                <span className={`
                  ${currentLang.code === lang.code ? 'text-gaming-yellow' : 'text-gaming-purple'}
                  ${lang.code === 'ar' ? 'font-arabic' : ''}
                `}>
                  {lang.name}
                </span>
              </div>
              {currentLang.code === lang.code && (
                <Check className="text-gaming-yellow" size={16} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}