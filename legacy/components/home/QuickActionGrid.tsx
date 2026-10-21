'use client';

import React from 'react';
import Link from 'next/link';
import { useFeature } from '@/lib/features';
import {
  ShoppingBag,
  Package,
  Users,
  BarChart2,
  Receipt,
  Wallet,
  Truck,
  PackagePlus,
  AlertOctagon,
  FileText,
  Sliders,
  ChevronRight,
  TrendingUp,
  Store,
} from 'lucide-react';

export const QuickActionGrid: React.FC = () => {
  // Check active features
  const { isEnabled: hasExpense } = useFeature('expense');
  const { isEnabled: hasIncome } = useFeature('income');
  const { isEnabled: hasSuppliers } = useFeature('suppliers');
  const { isEnabled: hasPurchases } = useFeature('purchases');
  const { isEnabled: hasDamaged } = useFeature('damaged_items');
  const { isEnabled: hasQuotations } = useFeature('quotations');
  const { isEnabled: hasDeepAnalytics } = useFeature('deep_analytics');
  const { isEnabled: hasMultiStore } = useFeature('multi_store');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Quick Actions & Operations
        </h2>
        <Link
          href="/settings/more-tools"
          className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
        >
          <span>More Tools</span>
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* 1. POS Quick Sale (Core) */}
        <Link
          href="/pos"
          className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-300 hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 group-hover:scale-105 transition-transform mb-1.5">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-900 leading-tight">
            POS Sell
          </span>
          <span className="text-[10px] text-slate-400">Quick checkout</span>
        </Link>

        {/* 2. Products Catalog (Core) */}
        <Link
          href="/stall"
          className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-300 hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 group-hover:scale-105 transition-transform mb-1.5">
            <Package className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-900 leading-tight">
            Products
          </span>
          <span className="text-[10px] text-slate-400">Stock & catalog</span>
        </Link>

        {/* 3. Customers (Core) */}
        <Link
          href="/customers"
          className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-300 hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 group-hover:scale-105 transition-transform mb-1.5">
            <Users className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-900 leading-tight">
            Customers
          </span>
          <span className="text-[10px] text-slate-400">Due & contacts</span>
        </Link>

        {/* 4. Reports (Core) */}
        <Link
          href="/reports"
          className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-300 hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 group-hover:scale-105 transition-transform mb-1.5">
            <BarChart2 className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-slate-900 leading-tight">
            Reports
          </span>
          <span className="text-[10px] text-slate-400">Daily summaries</span>
        </Link>

        {/* Conditional Tier 2: Expenses */}
        {hasExpense && (
          <Link
            href="/expenses"
            className="p-3 sm:p-4 rounded-2xl bg-white border border-teal-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700 group-hover:scale-105 transition-transform mb-1.5">
              <Receipt className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Expenses
            </span>
            <span className="text-[10px] text-slate-400">Log costs</span>
          </Link>
        )}

        {/* Conditional Tier 2: Income */}
        {hasIncome && (
          <Link
            href="/income"
            className="p-3 sm:p-4 rounded-2xl bg-white border border-teal-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 group-hover:scale-105 transition-transform mb-1.5">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Other Income
            </span>
            <span className="text-[10px] text-slate-400">Extra revenue</span>
          </Link>
        )}

        {/* Conditional Tier 2: Suppliers */}
        {hasSuppliers && (
          <Link
            href="/suppliers"
            className="p-3 sm:p-4 rounded-2xl bg-white border border-teal-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 group-hover:scale-105 transition-transform mb-1.5">
              <Truck className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Suppliers
            </span>
            <span className="text-[10px] text-slate-400">Vendor contacts</span>
          </Link>
        )}

        {/* Conditional Tier 2: Purchases */}
        {hasPurchases && (
          <Link
            href="/purchases"
            className="p-3 sm:p-4 rounded-2xl bg-white border border-teal-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 group-hover:scale-105 transition-transform mb-1.5">
              <PackagePlus className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Purchases
            </span>
            <span className="text-[10px] text-slate-400">Stock in & POs</span>
          </Link>
        )}

        {/* Conditional Tier 2: Damaged Items */}
        {hasDamaged && (
          <Link
            href="/damaged-items"
            className="p-3 sm:p-4 rounded-2xl bg-white border border-teal-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700 group-hover:scale-105 transition-transform mb-1.5">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Damaged
            </span>
            <span className="text-[10px] text-slate-400">Stock losses</span>
          </Link>
        )}

        {/* Conditional Tier 2: Quotations */}
        {hasQuotations && (
          <Link
            href="/quotations"
            className="p-3 sm:p-4 rounded-2xl bg-white border border-teal-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 group-hover:scale-105 transition-transform mb-1.5">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Quotations
            </span>
            <span className="text-[10px] text-slate-400">Price estimates</span>
          </Link>
        )}

        {/* Conditional Tier 2: Deep Analytics */}
        {hasDeepAnalytics && (
          <Link
            href="/analytics"
            className="p-3 sm:p-4 rounded-2xl bg-white border border-teal-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 group-hover:scale-105 transition-transform mb-1.5">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Analytics
            </span>
            <span className="text-[10px] text-slate-400">Deep trends</span>
          </Link>
        )}

        {/* Conditional Tier 3: Multi-Store */}
        {hasMultiStore && (
          <Link
            href="/stores"
            className="p-3 sm:p-4 rounded-2xl bg-white border border-teal-200 shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center justify-center min-h-[90px] group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800 group-hover:scale-105 transition-transform mb-1.5">
              <Store className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 leading-tight">
              Branches
            </span>
            <span className="text-[10px] text-slate-400">Multi-location</span>
          </Link>
        )}
      </div>
    </div>
  );
};
