'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Home, ShoppingBag, BarChart2, Package } from 'lucide-react';

interface BottomNavProps {
  onOpenQuickAdd?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = () => {
  const pathname = usePathname();
  const { vendor, isDemo, user, loading } = useAuth();

  // Hide on auth / onboarding screens or when not logged in
  if (loading) return null;
  if (pathname === '/login' || pathname === '/onboarding') return null;
  if (!user && !vendor && !isDemo) return null;

  const isHome = pathname === '/';
  const isPos = pathname === '/pos' || pathname === '/sales/new';
  const isReports = pathname.startsWith('/reports');
  const isProducts = pathname.startsWith('/stall') || pathname.startsWith('/products');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg px-2 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        {/* 1. Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
            isHome ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Home className="h-5 w-5 mb-1" />
          <span className="text-[11px]">Home</span>
        </Link>

        {/* 2. POS Sell */}
        <Link
          href="/pos"
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
            isPos ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="h-5 w-5 mb-1" />
          <span className="text-[11px]">POS Sell</span>
        </Link>

        {/* 3. Reports */}
        <Link
          href="/reports"
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
            isReports ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <BarChart2 className="h-5 w-5 mb-1" />
          <span className="text-[11px]">Reports</span>
        </Link>

        {/* 4. Products */}
        <Link
          href="/stall"
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors ${
            isProducts ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Package className="h-5 w-5 mb-1" />
          <span className="text-[11px]">Products</span>
        </Link>
      </div>
    </nav>
  );
};
