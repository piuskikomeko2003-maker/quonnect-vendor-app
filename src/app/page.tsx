'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { FinanceEntry, Product } from '@/types/database.types';
import { formatUGX } from '@/lib/formatters';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { GettingStartedChecklist } from '@/components/home/GettingStartedChecklist';
import { ContextualSuggestionCard } from '@/components/home/ContextualSuggestionCard';
import { QuickActionGrid } from '@/components/home/QuickActionGrid';
import { QuickAddSheet } from '@/components/home/QuickAddSheet';
import { GrowthChart } from '@/components/finance/GrowthChart';
import { TransactionsList } from '@/components/finance/TransactionsList';
import { AddTransactionModal } from '@/components/finance/AddTransactionModal';
import { AddEditProductModal } from '@/components/stall/AddEditProductModal';
import { useFeature } from '@/lib/features';
import {
  TrendingUp,
  Plus,
  ShoppingBag,
  Package,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { vendor, loading: authLoading, isDemo } = useAuth();
  const { isEnabled: deepAnalyticsEnabled } = useFeature('deep_analytics');

  // Ledger & metrics state
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [heroPeriod, setHeroPeriod] = useState<'today' | 'week' | 'month'>('today');

  // Modal / Sheet states
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [sampleCleared, setSampleCleared] = useState(false);

  // Fetch entries
  const fetchEntries = useCallback(async (): Promise<FinanceEntry[] | null> => {
    if (!vendor) return null;

    if (isDemo) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('quonnect_demo_entries') : null;
      if (saved) {
        try {
          return JSON.parse(saved) as FinanceEntry[];
        } catch {
          return [];
        }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('finance_entries')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('entry_date', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        return null;
      }
      return data as FinanceEntry[];
    } catch (err) {
      console.error('Fetch error:', err);
      return null;
    }
  }, [vendor, isDemo]);

  // Fetch product count
  const fetchProductCount = useCallback(async () => {
    if (!vendor) return;
    if (isDemo) {
      if (typeof window !== 'undefined') {
        const demoProds = localStorage.getItem('quonnect_demo_products');
        if (demoProds) {
          try {
            setProductCount(JSON.parse(demoProds).length);
            return;
          } catch {}
        }
      }
      setProductCount(0);
      return;
    }

    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id);
    setProductCount(count || 0);
  }, [vendor, isDemo]);

  useEffect(() => {
    let isMounted = true;
    fetchEntries().then((res) => {
      if (isMounted && res) setEntries(res);
    });
    fetchProductCount();
    return () => {
      isMounted = false;
    };
  }, [fetchEntries, fetchProductCount]);

  // Hero calculation based on period dropdown
  const heroMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const filtered = entries.filter((e) => {
      if (heroPeriod === 'today') return e.entry_date === todayStr;
      if (heroPeriod === 'week') return e.entry_date >= sevenDaysAgo;
      return e.entry_date >= monthStart;
    });

    const income = filtered
      .filter((e) => e.type === 'income')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const expense = filtered
      .filter((e) => e.type === 'expense')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = income - expense;

    return { income, profit, count: filtered.length };
  }, [entries, heroPeriod]);

  const hasSales = entries.some((e) => e.type === 'income');
  const hasProducts = productCount > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Bar per Section 7 */}
      <Navbar
        onOpenAddModal={() => setIsQuickAddOpen(true)}
        actionButtonLabel="Add New"
      />

      <main className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6 space-y-5">
        {/* ================= HERO CARD (Teal-to-Green Gradient) ================= */}
        <div className="rounded-3xl p-5 bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-900/15 relative overflow-hidden">
          {/* Background subtle rings */}
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          {/* Period selector dropdown */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-100 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Sales Performance</span>
            </span>

            <div className="relative inline-block">
              <select
                value={heroPeriod}
                onChange={(e) => setHeroPeriod(e.target.value as 'today' | 'week' | 'month')}
                className="appearance-none bg-white/15 hover:bg-white/20 backdrop-blur-md text-white font-bold text-xs pl-3 pr-7 py-1 rounded-xl border border-white/20 outline-none cursor-pointer"
              >
                <option value="today" className="text-slate-900">Today</option>
                <option value="week" className="text-slate-900">Last 7 Days</option>
                <option value="month" className="text-slate-900">This Month</option>
              </select>
              <ChevronDown className="h-3.5 w-3.5 absolute right-2 top-2 pointer-events-none text-white/80" />
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <p className="text-xs font-medium text-teal-100">
                {heroPeriod === 'today' ? "Today's Sales" : heroPeriod === 'week' ? '7-Day Sales' : "Month's Sales"}
              </p>
              <p className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
                {formatUGX(heroMetrics.income)}
              </p>
            </div>

            <div className="border-l border-white/20 pl-4">
              <p className="text-xs font-medium text-teal-100">
                Estimated Profit
              </p>
              <p className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5 text-emerald-200">
                {formatUGX(heroMetrics.profit)}
              </p>
            </div>
          </div>

          {/* Footer bar */}
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-teal-100">
            <span>{heroMetrics.count} recorded transactions</span>
            <button
              onClick={() => router.push('/reports')}
              className="font-bold text-white hover:underline flex items-center gap-1"
            >
              <span>View Breakdown</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* ================= GETTING STARTED CHECKLIST (New shops) ================= */}
        <GettingStartedChecklist
          hasProducts={hasProducts}
          hasSales={hasSales}
          sampleCleared={sampleCleared}
          onSampleCleared={() => {
            setSampleCleared(true);
            fetchEntries().then((res) => res && setEntries(res));
          }}
        />

        {/* ================= CONTEXTUAL SUGGESTION CARD ================= */}
        <ContextualSuggestionCard
          salesCount={entries.filter((e) => e.type === 'income').length}
          daysActive={10}
          productCount={productCount}
        />

        {/* ================= QUICK-ACTION GRID ================= */}
        <QuickActionGrid />

        {/* ================= RECENT TRANSACTIONS LEDGER ================= */}
        <div className="pt-2">
          <TransactionsList
            entries={entries}
            isDemo={isDemo}
            onEntryDeleted={(id: string) => {
              setEntries((prev) => prev.filter((e) => e.id !== id));
            }}
          />
        </div>
      </main>

      {/* Floating Action Button (+) centered and raised */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsQuickAddOpen(true)}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/35 border-2 border-white transition-all transform active:scale-95"
          aria-label="Quick Add Menu"
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>

      {/* Bottom Nav (4 items: Home, POS Sell, Reports, Products) */}
      <BottomNav />

      {/* Quick Add Sheet */}
      <QuickAddSheet
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onOpenNewProduct={() => setIsAddProductOpen(true)}
        onOpenNewTransaction={() => setIsAddTransactionOpen(true)}
      />

      {/* Add Transaction Modal / Sheet */}
      <AddTransactionModal
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
        vendorId={vendor?.id || 'demo-vendor-0001'}
        isDemo={isDemo}
        onEntryAdded={(newEntry) => {
          setEntries((prev) => [newEntry, ...prev]);
        }}
      />

      {/* Add Product Modal */}
      <AddEditProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        vendorId={vendor?.id || 'demo-vendor-0001'}
        isDemo={isDemo}
        onProductSaved={(prod, isNew) => {
          setProductCount((prev) => prev + 1);
          if (isNew) router.push(`/stall/${prod.id}`);
        }}
      />
    </div>
  );
}
