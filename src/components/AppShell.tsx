import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BookMarked, Download, Home, Search, User, WifiOff } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAppData } from '../hooks/useAuthAndActivity';
import { useLanguage } from '../hooks/useLanguage';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { AudioPlayerBar } from './AudioPlayerBar';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang, toggleLang, t } = useLanguage();
  const { profile } = useAppData();
  const { currentEpisode } = useAudioPlayer();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/search', label: t('nav.search'), icon: Search, end: false },
    { to: '/library', label: t('nav.library'), icon: BookMarked, end: false },
    { to: '/profile', label: t('nav.profile'), icon: User, end: false },
  ];

  // Ensure scrollable content clears fixed mobile nav + optional mini-player
  const bottomPaddingClass = currentEpisode ? 'pb-40 md:pb-28' : 'pb-24 md:pb-14';

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F5F3EE] flex flex-col">
      {/* Desktop Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 bg-[#0B0B0E]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-13 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            className="font-display text-lg sm:text-xl font-semibold tracking-tight text-[#F5F3EE] hover:text-[#F3C669] transition-colors whitespace-nowrap shrink-0"
          >
            {t('brand.name')}
          </Link>

          {/* Zone 2: Clean single-line text nav links (Desktop) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#F5F3EE] border-[#E5A93C]'
                      : 'text-[#A39E93] border-transparent hover:text-[#F5F3EE]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Zone 3: Language Switcher & Primary Account Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={() => void install()}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-[#A39E93] hover:text-[#F5F3EE] hover:border-white/25 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Install App
              </button>
            )}

            {!isInstalled && !isInstallable && isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-[#A39E93] hover:text-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
              >
                Install on iOS
              </button>
            )}

            <button
              type="button"
              onClick={toggleLang}
              aria-label="Switch interface language between English and Hindi"
              className="min-h-[36px] px-3 rounded-lg border border-white/10 bg-[#141418] text-xs font-medium text-[#F5F3EE] hover:border-[#E5A93C]/50 transition-colors whitespace-nowrap shrink-0"
            >
              {lang === 'en' ? 'EN / हिंदी' : 'हिंदी / EN'}
            </button>

            <Link
              to="/profile"
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#E5A93C] text-[#0B0B0E] text-xs font-semibold hover:bg-[#F3C669] transition-colors inline-flex items-center justify-center whitespace-nowrap shrink-0"
            >
              {profile ? profile.avatarInitials : t('nav.signIn')}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 ${bottomPaddingClass}`}>{children}</main>

      {/* Offline Indicator */}
      {!isOnline && (
        <div
          role="status"
          className="fixed top-16 right-4 z-50 flex items-center gap-2 rounded-lg bg-[#1C1C22] border border-[#E5A93C]/40 px-3.5 py-2 text-xs text-[#F5F3EE] shadow-xl"
        >
          <WifiOff className="w-3.5 h-3.5 text-[#E5A93C]" aria-hidden="true" />
          <span>Offline Mode — cached catalog &amp; local audio available.</span>
        </div>
      )}

      {/* Persistent Audio Mini-Player & Full-Screen Player */}
      <AudioPlayerBar />

      {/* Mobile Bottom Navigation Bar (4 destinations, 64px height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0B0E]/95 backdrop-blur-md border-t border-white/10"
      >
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center min-h-[44px] text-[11px] font-medium transition-colors ${
                    isActive ? 'text-[#E5A93C]' : 'text-[#A39E93] hover:text-[#F5F3EE]'
                  }`
                }
              >
                <Icon className="w-5 h-5 mb-1" aria-hidden="true" />
                <span className="truncate max-w-[76px]">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* iOS Install Instructions Modal */}
      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install Dhruv Tales on iOS"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#141418] border border-white/10 p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#F5F3EE]">
              Install Dhruv Tales on iOS
            </h2>
            <p className="text-sm text-[#A39E93] leading-relaxed">
              1. Tap the <strong>Share</strong> icon in your Safari toolbar.
              <br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-lg bg-[#E5A93C] text-[#0B0B0E] text-sm font-semibold hover:bg-[#F3C669] transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
