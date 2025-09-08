import React from "react";
import { useTranslation } from 'react-i18next';
import Lottie from "lottie-react";
import { gamingLoaderAnimation } from "../assets/animations";
import { Gamepad2, Zap } from "lucide-react";

export default function SplashScreen() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-gaming-black flex items-center justify-center z-[100]">
      <div className="text-center">
        {/* Animated Logo */}
        <div className="mb-8 relative">
          <div className="w-32 h-32 mx-auto">
            <Lottie animationData={gamingLoaderAnimation} loop={true} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Gamepad2 className="text-gaming-yellow" size={48} />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-5xl font-bold mb-2 gradient-text">Revotec</h1>
        <p className="text-gaming-purple text-lg mb-8">{t('brand.tagline')}</p>

        {/* Loading Bar */}
        <div className="w-64 mx-auto mb-4">
          <div className="h-1 bg-gaming-gray rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gaming-yellow to-gaming-purple rounded-full animate-pulse"
                 style={{ width: '60%', animation: 'loading 2s ease-in-out infinite' }}>
            </div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="flex items-center justify-center space-x-2">
          <Zap className="text-gaming-yellow animate-pulse" size={16} />
          <span className="text-gaming-purple text-sm">{t('common.loading')}</span>
        </div>

        {/* Version */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-gaming-purple/50 text-xs">{t('brand.version')} • {t('welcome.poweredByAI')}</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
}