'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useFeature } from '@/lib/features';
import { formatUGX } from '@/lib/formatters';
import { Navbar } from '@/components/layout/Navbar';
import { PeriodPickerModal } from '@/components/reports/PeriodPickerModal';
import Link from 'next/link';
import {
  BarChart2,
  TrendingUp,
  Package,
  Layers,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  FileText,
  Boxes,
  Truck,
  Users,
  Award,
  AlertOctagon,
  Store,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react';

interface ReportDirectoryItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  tier: 1 | 2 | 3;
  featureKey?: 'damaged_items' | 'purchases' | 'representatives' | 'online_store';
}

const REPORT_DIRECTORY: ReportDirectoryItem[] = [
  // Tier 1: Always visible
  {
    id: 'business',
    name: 'Business Report',
    description: 'Overview of sales, margins, orders, discounts, and payment methods.',
    icon: BarChart2,
    tier: 1,
  },
  {
    id: 'stock',
    name: 'Stock Report',
    description: 'Current stock value, inventory costs, units sold, and expected profits.',
    icon: Boxes,
    tier: 1,
  },
  {
    id: 'low-stock',
    name: 'Low Stock Report',
    description: 'Snapshot of items below threshold, estimated days left, and reorder plan.',
    icon: AlertTriangle,
    tier: 1,
  },
  {
    id: 'new-products',
    name: 'New Products Report',
    description: 'Performance of recently launched inventory and margin tracking.',
    icon: Package,
    tier: 1,
  },

  // Tier 2: Add-ons (Gated)
  {
    id: 'loss',
    name: 'Loss Report',
    description: 'Stock lost without sale due to damage, spoilage, or theft.',
    icon: AlertOctagon,
    tier: 2,
    featureKey: 'damaged_items',
  },
  {
    id: 'purchases',
    name: 'Purchase Report',
    description: 'Procurement costs, supplier order volumes, and restocking trends.',
    icon: Truck,
    tier: 2,
    featureKey: 'purchases',
  },

  // Tier 3: Teams & Multi-staff (Gated)
  {
    id: 'staff',
    name: 'Staff Performance Report',
    description: 'Sales leaderboard, cashier orders, and commission rankings.',
    icon: Users,
    tier: 3,
    featureKey: 'representatives',
  },
  {
    id: 'commissions',
    name: 'Commission Management',
    description: 'Commission payouts, outstanding balances, and staff settlement history.',
    icon: Award,
    tier: 3,
    featureKey: 'representatives',
  },
];

export default function ReportsLandingPage() {
  const router = useRouter();
  const { vendor, isDemo } = useAuth();

  // Feature gates for Tier 2 and Tier 3 reports
  const { isEnabled: hasLoss } = useFeature('damaged_items');
  const { isEnabled: hasPurchases } = useFeature('purchases');
  const { isEnabled: hasReps } = useFeature('representatives');

  // Stats state
  const [todaySales, setTodaySales] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [stockValue, setStockValue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [topSellers, setTopSellers] = useState<Array<{ name: string; sales: number }>>([]);

  // Period Picker modal target
  const [selectedReportForPicker, setSelectedReportForPicker] = useState<ReportDirectoryItem | null>(null);

  useEffect(() => {
    async function loadLandingStats() {
      if (!vendor) return;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const demoProds = localStorage.getItem('quonnect_demo_products');
          const prods: any[] = demoProds ? JSON.parse(demoProds) : [];
          setProductCount(prods.length);
          const totalVal = prods.reduce((sum, p) => sum + (p.stock || 0) * (p.price || 0), 0);
          setStockValue(totalVal);
          const low = prods.filter((p) => !p.is_service && p.stock !== null && p.stock <= (p.min_stock_alert || 3)).length;
          setLowStockCount(low);

          const demoSales = localStorage.getItem('quonnect_demo_sales');
          const sales: any[] = demoSales ? JSON.parse(demoSales) : [];
          const todayStr = new Date().toISOString().split('T')[0];
          const todaySum = sales
            .filter((s) => s.sale_date === todayStr)
            .reduce((acc, s) => acc + (s.total || 0), 0);
          setTodaySales(todaySum);
          setTopSellers([]);
        } else {
          setProductCount(0);
          setStockValue(0);
          setLowStockCount(0);
          setTodaySales(0);
          setTopSellers([]);
        }
        return;
      }

      // 1. Products & Stock Value
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .is('deleted_at', null);

      if (prods) {
        setProductCount(prods.length);
        const totalVal = prods.reduce(
          (sum, p) => sum + (p.stock || 0) * (p.price || 0),
          0
        );
        setStockValue(totalVal);
        const low = prods.filter(
          (p) => !p.is_service && p.stock !== null && p.stock <= (p.min_stock_alert || 3)
        ).length;
        setLowStockCount(low);
      }

      // 2. Today's Sales
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: salesData } = await supabase
        .from('sales')
        .select('total, customer_name')
        .eq('vendor_id', vendor.id)
        .eq('sale_date', todayStr)
        .is('deleted_at', null);

      if (salesData) {
        const sum = salesData.reduce((acc, s) => acc + (s.total || 0), 0);
        setTodaySales(sum);
      }
    }

    loadLandingStats();
  }, [vendor, isDemo]);

  // Filter accessible reports (Section 5: locked reports are absent, not greyed out)
  const accessibleReports = useMemo(() => {
    return REPORT_DIRECTORY.filter((r) => {
      if (r.tier === 1) return true;
      if (r.featureKey === 'damaged_items') return hasLoss;
      if (r.featureKey === 'purchases') return hasPurchases;
      if (r.featureKey === 'representatives') return hasReps;
      return false;
    });
  }, [hasLoss, hasPurchases, hasReps]);

  const handleTapReport = (report: ReportDirectoryItem) => {
    setSelectedReportForPicker(report);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Bar */}
      <Navbar title="Reports & Analytics" />

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* ================= 1. TOP 4 STAT CARDS ================= */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Card 1: Stores */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Active Branches
            </span>
            <p className="text-base sm:text-xl font-black text-slate-900 mt-1">1 Store</p>
            <span className="text-[10px] text-teal-700 font-semibold">Main Market Stall</span>
          </div>

          {/* Card 2: Products */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Product Catalog
            </span>
            <p className="text-base sm:text-xl font-black text-slate-900 mt-1">
              {productCount} Items
            </p>
            <span className="text-[10px] text-slate-400">In physical catalog</span>
          </div>

          {/* Card 3: Today's Sales */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-teal-50/70 border border-teal-200 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-teal-800">
              Today's Sales
            </span>
            <p className="text-base sm:text-xl font-black text-teal-950 mt-1">
              {formatUGX(todaySales)}
            </p>
            <span className="text-[10px] text-teal-700 font-bold">Real-time ledger</span>
          </div>

          {/* Card 4: Total Stock Value */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-xs">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
              Stock Retail Value
            </span>
            <p className="text-base sm:text-xl font-black text-emerald-950 mt-1">
              {formatUGX(stockValue)}
            </p>
            <span className="text-[10px] text-emerald-700 font-bold">Based on sell price</span>
          </div>
        </div>

        {/* ================= 2. ALERTS BOX ================= */}
        {lowStockCount > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs flex items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="font-extrabold">{lowStockCount} Products Need Restocking</p>
                <p className="text-[11px] text-amber-800">
                  Items are at or below their alert threshold
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/reports/low-stock?preset=today')}
              className="px-2.5 py-1.5 rounded-xl bg-amber-200/80 hover:bg-amber-300 font-black text-[11px] whitespace-nowrap transition-colors"
            >
              View List
            </button>
          </div>
        )}

        {/* ================= 3. TOP 3 SELLERS ================= */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              <span>Top 3 Sellers</span>
            </h3>
            <span className="text-[10px] font-semibold text-slate-400">By revenue volume</span>
          </div>

          <div className="space-y-1.5 divide-y divide-slate-100">
            {topSellers.map((item, idx) => (
              <div key={idx} className="pt-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-teal-800 text-[10px] font-black border border-teal-200">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-slate-800">{item.name}</span>
                </div>
                <span className="font-extrabold text-slate-900">{formatUGX(item.sales)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ================= 4. QUICK TIP ================= */}
        <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-100 flex items-start gap-2.5 text-xs text-teal-950">
          <Lightbulb className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Quick Tip:</strong> Tap any report below to choose between predefined quick periods or custom date ranges. You can also print or share clean PDF summaries anytime.
          </p>
        </div>

        {/* ================= 5. REPORT DIRECTORY LIST ================= */}
        <div className="space-y-2 pt-1">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Available Business Reports ({accessibleReports.length})
          </h2>

          <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {accessibleReports.map((report) => {
              const IconComp = report.icon;

              return (
                <button
                  key={report.id}
                  onClick={() => handleTapReport(report)}
                  className="w-full flex items-center justify-between p-4 hover:bg-teal-50/50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 group-hover:bg-teal-600 group-hover:text-white transition-colors shadow-2xs">
                      <IconComp className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                          {report.name}
                        </h3>
                        {report.tier > 1 && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            Tier {report.tier}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 leading-relaxed">
                        {report.description}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Period Picker Screen / Modal (Section 1 Step 2) */}
      {selectedReportForPicker && (
        <PeriodPickerModal
          isOpen={Boolean(selectedReportForPicker)}
          onClose={() => setSelectedReportForPicker(null)}
          reportType={selectedReportForPicker.id}
          reportTitle={selectedReportForPicker.name}
        />
      )}
    </div>
  );
}
