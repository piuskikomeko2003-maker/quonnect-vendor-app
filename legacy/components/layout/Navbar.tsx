'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Plus,
  Store,
  LogOut,
  Sparkles,
  Database,
  Sliders,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarProps {
  onOpenAddModal?: () => void;
  actionButtonLabel?: string;
  title?: string;
  showBack?: boolean;
  backHref?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenAddModal, 
  actionButtonLabel = 'Add Entry',
  title,
  showBack = false,
  backHref = '/',
}) => {
  const { isDemo, signOut, user, vendor } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-teal-100/90 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left Brand / Back navigation */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  href={backHref}
                  className="flex items-center justify-center h-10 w-10 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                {title && (
                  <span className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
                    {title}
                  </span>
                )}
              </div>
            ) : (
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-teal-500 text-white shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
                      {vendor?.business_name || 'Quonnect'}
                    </span>
                    <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80">
                      Vendor
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {!showBack && title && (
              <span className="text-sm font-bold text-slate-800 pl-2 border-l border-slate-200 hidden sm:inline-block">
                {title}
              </span>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Database or Demo badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-teal-200 bg-teal-50/70 text-teal-800">
              {isDemo ? (
                <>
                  <Sparkles className="h-3 w-3 text-teal-600" />
                  <span>Demo Mode</span>
                </>
              ) : (
                <>
                  <Database className="h-3 w-3 text-teal-600" />
                  <span>Live DB</span>
                </>
              )}
            </div>

            {/* More Tools Shortcut */}
            <Link
              href="/settings/more-tools"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-teal-700 hover:bg-teal-50/70 border border-slate-200 hover:border-teal-200 transition-all"
              title="More Tools & Modules"
            >
              <Sliders className="h-3.5 w-3.5 text-teal-600" />
              <span className="hidden sm:inline">More Tools</span>
            </Link>

            {/* Quick Action Button */}
            {onOpenAddModal && (
              <button
                onClick={onOpenAddModal}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-600/20 hover:shadow-md transition-all active:scale-95 min-h-[44px]"
              >
                <Plus className="h-4 w-4" />
                <span>{actionButtonLabel}</span>
              </button>
            )}

            {/* Settings link */}
            <Link
              href="/settings"
              className="flex items-center justify-center h-10 w-10 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Settings & Profile"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
