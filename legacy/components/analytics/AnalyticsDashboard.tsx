'use client';

import React, { useState } from 'react';
import { formatUGX } from '@/lib/formatters';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart,
  Calendar,
  Layers,
  Award,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

export interface AnalyticsProps {
  sales: Array<{
    id: string;
    total: number;
    profit: number;
    sale_date: string;
    quantity?: number;
    items?: Array<{ product_name: string; quantity: number; profit: number }>;
  }>;
}

export default function AnalyticsDashboard({ sales }: AnalyticsProps) {
  const [period, setPeriod] = useState<'7days' | '30days'>('7days');

  const filteredSales = React.useMemo(() => {
    const days = period === '7days' ? 7 : 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return sales.filter((s) => s.sale_date >= cutoff);
  }, [sales, period]);

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + (s.profit || 0), 0);
  const totalVolume = filteredSales.length;
  const overallMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  // Daily aggregates for trend bars
  const dailyData = React.useMemo(() => {
    const map: Record<string, { date: string; revenue: number; profit: number }> = {};
    const count = period === '7days' ? 7 : 14;

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const dayLabel = new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      map[d] = { date: dayLabel, revenue: 0, profit: 0 };
    }

    filteredSales.forEach((s) => {
      if (map[s.sale_date]) {
        map[s.sale_date].revenue += s.total;
        map[s.sale_date].profit += s.profit;
      }
    });

    return Object.values(map);
  }, [filteredSales, period]);

  const maxDailyRevenue = Math.max(1, ...dailyData.map((d) => d.revenue));

  // Top products
  const topProducts = [
    { name: 'Fresh Red Tomatoes', sales: 420000, profit: 168000, qty: 60, percent: 35 },
    { name: 'Sweet Apple Bananas', sales: 310000, profit: 124000, qty: 55, percent: 26 },
    { name: 'Matooke Heap', sales: 240000, profit: 90000, qty: 20, percent: 20 },
    { name: 'Irish Potatoes Bucket', sales: 180000, profit: 54000, qty: 9, percent: 15 },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Period Filter Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Performance Overview
        </h2>
        <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200">
          <button
            onClick={() => setPeriod('7days')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
              period === '7days' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPeriod('30days')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
              period === '30days' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* 3 Main KPI Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Revenue</span>
          <p className="text-sm sm:text-base font-black text-slate-900 mt-1">
            {formatUGX(totalRevenue)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs">
          <span className="text-[10px] text-emerald-800 font-bold uppercase">Net Profit</span>
          <p className="text-sm sm:text-base font-black text-emerald-900 mt-1">
            {formatUGX(totalProfit)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 shadow-xs">
          <span className="text-[10px] text-teal-800 font-bold uppercase">Margin</span>
          <p className="text-sm sm:text-base font-black text-teal-900 mt-1">
            {overallMargin}%
          </p>
        </div>
      </div>

      {/* Revenue & Profit Daily Trend Bars */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900">Daily Revenue & Profit Trend</h3>
            <p className="text-[10px] text-slate-400">Comparing total sales volume to net take-home</p>
          </div>
          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            Live trend
          </span>
        </div>

        <div className="pt-4 flex items-end justify-between gap-2 h-36 border-b border-slate-100 pb-2">
          {dailyData.map((d, idx) => {
            const revHeight = Math.max(8, Math.round((d.revenue / maxDailyRevenue) * 100));
            const profHeight = Math.max(4, Math.round((d.profit / maxDailyRevenue) * 100));

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full flex items-end justify-center gap-1 h-28">
                  {/* Revenue Bar */}
                  <div
                    style={{ height: `${revHeight}%` }}
                    className="w-2.5 sm:w-3.5 bg-teal-600 rounded-t-sm transition-all group-hover:bg-teal-500"
                    title={`Revenue: ${formatUGX(d.revenue)}`}
                  />
                  {/* Profit Bar */}
                  <div
                    style={{ height: `${profHeight}%` }}
                    className="w-2.5 sm:w-3.5 bg-emerald-400 rounded-t-sm transition-all group-hover:bg-emerald-300"
                    title={`Profit: ${formatUGX(d.profit)}`}
                  />
                </div>
                <span className="text-[9px] text-slate-400 font-semibold truncate max-w-full">
                  {d.date.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 text-[10px] font-bold">
          <div className="flex items-center gap-1.5 text-teal-800">
            <span className="h-2.5 w-2.5 rounded bg-teal-600 inline-block" />
            <span>Revenue</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-800">
            <span className="h-2.5 w-2.5 rounded bg-emerald-400 inline-block" />
            <span>Net Profit</span>
          </div>
        </div>
      </div>

      {/* Top Products by Volume & Profit */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900">Top Sellers by Share</h3>
          <span className="text-[10px] font-bold text-slate-400">Volume distribution</span>
        </div>

        <div className="space-y-3 pt-1">
          {topProducts.map((p, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-bold text-slate-800 truncate">{p.name}</span>
                <span className="font-extrabold text-teal-900">{formatUGX(p.sales)}</span>
              </div>

              {/* Horizontal Bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full"
                  style={{ width: `${p.percent}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{p.qty} units sold</span>
                <span className="text-emerald-700 font-bold">+{formatUGX(p.profit)} profit</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
