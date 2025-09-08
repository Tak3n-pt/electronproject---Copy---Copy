import React from "react";
import { useTranslation } from 'react-i18next';
import Lottie from "lottie-react";
import { gamingLoaderAnimation } from "../assets/animations";
import { Gamepad2, Rocket, Package, BarChart3, Shield, Zap } from "lucide-react";

export default function WelcomeScreen() {
  const { t } = useTranslation();
  
  const features = [
    { icon: Package, title: t('welcome.smartInventory'), desc: t('welcome.aiPowered'), color: "text-gaming-yellow" },
    { icon: BarChart3, title: t('welcome.realtimeAnalytics'), desc: t('welcome.trackPerformance'), color: "text-gaming-purple" },
    { icon: Shield, title: t('welcome.secureFast'), desc: t('welcome.enterpriseSecurity'), color: "text-gaming-yellow" },
    { icon: Zap, title: t('welcome.lightningFast'), desc: t('welcome.optimizedSpeed'), color: "text-gaming-purple" }
  ];

  return (
    <div className="min-h-screen bg-gaming-black flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Logo Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center space-x-4 mb-6">
            <div className="w-20 h-20">
              <Lottie animationData={gamingLoaderAnimation} loop={true} />
            </div>
            <div>
              <h1 className="text-6xl font-bold gradient-text">Revotec</h1>
              <p className="text-gaming-purple text-lg">{t('brand.tagline')}</p>
            </div>
          </div>
          
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gaming-gray border border-gaming-purple/30 rounded-full">
            <Rocket className="text-gaming-yellow" size={16} />
            <span className="text-gaming-purple text-sm">{t('brand.version')} - {t('welcome.poweredByAI')}</span>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="bg-gaming-gray border border-gaming-purple/30 rounded-xl p-6 hover:border-gaming-yellow/50 hover:animate-glow transition-all group"
            >
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gaming-black rounded-lg group-hover:scale-110 transition-transform">
                  <feature.icon className={feature.color} size={24} />
                </div>
                <div>
                  <h3 className="text-gaming-yellow font-bold mb-1">{feature.title}</h3>
                  <p className="text-gaming-purple text-sm">{feature.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="bg-gradient-to-r from-gaming-gray via-gaming-dark to-gaming-gray border border-gaming-purple/30 rounded-xl p-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-gaming-yellow">1000+</p>
              <p className="text-gaming-purple text-sm">{t('dashboard.productsManaged')}</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gaming-yellow">99.9%</p>
              <p className="text-gaming-purple text-sm">{t('dashboard.uptime')}</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gaming-yellow">24/7</p>
              <p className="text-gaming-purple text-sm">{t('dashboard.support')}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-gaming-purple mb-4">{t('dashboard.selectSection')}</p>
          <div className="flex justify-center space-x-4">
            <div className="px-4 py-2 bg-gaming-yellow/20 border border-gaming-yellow/50 rounded-lg">
              <span className="text-gaming-yellow text-sm">⌘ + K</span>
              <span className="text-gaming-purple text-sm ml-2">{t('dashboard.quickActions')}</span>
            </div>
            <div className="px-4 py-2 bg-gaming-purple/20 border border-gaming-purple/50 rounded-lg">
              <span className="text-gaming-purple text-sm">ESC</span>
              <span className="text-gaming-purple text-sm ml-2">{t('dashboard.closeModals')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}