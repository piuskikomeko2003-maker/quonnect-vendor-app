'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Sale, SaleItem } from '@/types/database.types';
import { formatUGX, formatDate } from '@/lib/formatters';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { ReceiptModal } from '@/components/sales/ReceiptModal';
import Link from 'next/link';
import {
  Search,
  Calendar,
  Filter,
  Receipt,
  Plus,
  ArrowUpRight,
  TrendingUp,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Printer,
} from 'lucide-react';

export default function SalesHistoryPage() {
  const router = useRouter();
  const { vendor, isDemo } = useAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'lifetime' | '7days'>('today');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<{
    sale: Sale;
    items: SaleItem[];
  } | null>(null);

  // Load sales
  useEffect(() => {
    async function loadSales() {
      if (!vendor) return;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('quonnect_demo_sales');
          if (saved) {
            try {
              setSales(JSON.parse(saved) as Sale[]);
              return;
            } catch {}
          }
        }
        setSales([]);
        return;
      }

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('vendor_id', vendor.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (data) setSales(data as Sale[]);
    }

    loadSales();
  }, [vendor, isDemo]);

  // Filter sales
  const filteredSales = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    return sales.filter((s) => {
      if (dateFilter === 'today' && s.sale_date !== todayStr) return false;
      if (dateFilter === '7days' && s.sale_date < sevenDaysAgo) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          s.order_no.toLowerCase().includes(q) ||
          (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
          s.payment_method.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sales, dateFilter, searchTerm]);

  // Calculate totals
  const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + (s.profit || 0), 0);

  const handleOpenReceipt = async (sale: Sale) => {
    if (isDemo) {
      const demoItems: SaleItem[] = [
        {
          id: 'item-1',
          sale_id: sale.id,
          vendor_id: sale.vendor_id,
          product_id: null,
          product_name: 'Selected Stall Items',
          quantity: 1,
          unit_price: sale.total,
          unit_cost: sale.total - sale.profit,
          total: sale.total,
          profit: sale.profit,
          created_at: new Date().toISOString(),
        },
      ];
      setSelectedSaleForReceipt({ sale, items: demoItems });
      return;
    }

    const { data: items } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', sale.id);

    setSelectedSaleForReceipt({ sale, items: (items || []) as SaleItem[] });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Bar */}
      <Navbar title="Sales Ledger" />

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* KPI Summary Card */}
        <div className="rounded-3xl p-5 bg-gradient-to-r from-teal-800 to-teal-600 text-white shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-teal-100 uppercase tracking-wider">
              {dateFilter === 'today' ? "Today's Revenue" : 'Filtered Revenue'}
            </span>
            <p className="text-2xl font-black mt-0.5">{formatUGX(totalSalesRevenue)}</p>
            <p className="text-xs text-teal-200 mt-1 font-bold">
              +{formatUGX(totalProfit)} net profit
            </p>
          </div>

          <Link
            href="/pos"
            className="flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-white text-teal-900 font-extrabold text-xs shadow-sm hover:bg-teal-50 transition-colors"
          >
            <Plus className="h-4 w-4 text-teal-600" />
            <span>New Sale</span>
          </Link>
        </div>

        {/* Filters & Search */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order #, customer name, payment..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setDateFilter('today')}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                dateFilter === 'today'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('7days')}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                dateFilter === '7days'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateFilter('lifetime')}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                dateFilter === 'lifetime'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Sales List */}
        <div className="space-y-2.5">
          {filteredSales.map((sale) => (
            <div
              key={sale.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-teal-300 transition-all space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900">
                      #{sale.order_no}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sale.due_amount > 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {sale.due_amount > 0 ? `Due ${formatUGX(sale.due_amount)}` : 'Paid'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 mt-1">
                    {sale.customer_name || 'Walk-in Customer'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{formatUGX(sale.total)}</p>
                  <p className="text-[11px] font-bold text-teal-700">
                    +{formatUGX(sale.profit)} profit
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>{formatDate(sale.sale_date)} • {sale.payment_method}</span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenReceipt(sale)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-bold border border-teal-200 hover:bg-teal-100 transition-colors"
                  >
                    <Receipt className="h-3 w-3" />
                    <span>Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredSales.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500">
              <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-1" />
              <p>No sales recorded for this period.</p>
              <Link
                href="/pos"
                className="inline-block mt-3 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold"
              >
                Record First Sale
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* 4-Item Bottom Nav */}
      <BottomNav />

      {/* Printable Receipt Modal */}
      {selectedSaleForReceipt && (
        <ReceiptModal
          sale={selectedSaleForReceipt.sale}
          items={selectedSaleForReceipt.items}
          shopName={vendor?.business_name || 'My Market Shop'}
          shopPhone={vendor?.phone}
          shopLocation={vendor?.region}
          isOpen={Boolean(selectedSaleForReceipt)}
          onClose={() => setSelectedSaleForReceipt(null)}
        />
      )}
    </div>
  );
}
