'use client';

import React, { useState } from 'react';
import { FinanceEntry } from '@/types/database.types';
import { formatUGX } from '@/lib/formatters';
import { BarChart3, TrendingUp } from 'lucide-react';

interface GrowthChartProps {
  entries: FinanceEntry[];
}

interface MonthData {
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export const GrowthChart: React.FC<GrowthChartProps> = ({ entries }) => {
  const [activeMonth, setActiveMonth] = useState<MonthData | null>(null);

  // Generate last 6 months keys (e.g. YYYY-MM)
  const months: MonthData[] = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short' });
    
    // Aggregate entries for this month
    const monthEntries = entries.filter((e) => e.entry_date.startsWith(monthKey));
    const income = monthEntries
      .filter((e) => e.type === 'income')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
    const expenses = monthEntries
      .filter((e) => e.type === 'expense')
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    months.push({
      monthKey,
      label,
      income,
      expenses,
      net: income - expenses,
    });
  }

  const maxVal = Math.max(
    ...months.map((m) => Math.max(m.income, m.expenses)),
    100000 // default minimum scale
  );

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-teal-600" />
              Cashflow & Growth Trend
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            6-month income vs. expenses comparison and auto-calculated net margins
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-teal-500 inline-block" />
            <span className="text-slate-700">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-rose-400 inline-block" />
            <span className="text-slate-700">Expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-teal-600 inline-block" />
            <span className="text-slate-700">Net Growth</span>
          </div>
        </div>
      </div>

      {/* Interactive Active Month Display */}
      {activeMonth && (
        <div className="mb-4 p-3.5 rounded-2xl bg-teal-50/60 border border-teal-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="font-bold text-slate-800">
            Selected Month: <span className="text-teal-700">{activeMonth.label} ({activeMonth.monthKey})</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Income: <b className="text-teal-700">{formatUGX(activeMonth.income)}</b></span>
            <span>Expenses: <b className="text-rose-600">{formatUGX(activeMonth.expenses)}</b></span>
            <span>Net: <b className={activeMonth.net >= 0 ? 'text-teal-700 font-extrabold' : 'text-rose-600 font-extrabold'}>{formatUGX(activeMonth.net)}</b></span>
          </div>
        </div>
      )}

      {/* Chart visualization */}
      <div className="h-56 sm:h-64 flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 border-b border-slate-100">
        {months.map((m, idx) => {
          const incomeHeightPercent = Math.min(100, Math.round((m.income / maxVal) * 100));
          const expenseHeightPercent = Math.min(100, Math.round((m.expenses / maxVal) * 100));

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              onMouseEnter={() => setActiveMonth(m)}
              onClick={() => setActiveMonth(m)}
            >
              <div className="w-full max-w-[48px] flex items-end justify-center gap-1 sm:gap-2 h-full pb-1">
                {/* Income Bar */}
                <div
                  className="w-1/2 rounded-t-lg bg-teal-500 group-hover:bg-teal-600 transition-all duration-300 relative shadow-xs"
                  style={{ height: `${Math.max(incomeHeightPercent, 4)}%` }}
                  title={`Income: ${formatUGX(m.income)}`}
                />
                {/* Expense Bar */}
                <div
                  className="w-1/2 rounded-t-lg bg-rose-400 group-hover:bg-rose-500 transition-all duration-300 relative shadow-xs"
                  style={{ height: `${Math.max(expenseHeightPercent, 4)}%` }}
                  title={`Expenses: ${formatUGX(m.expenses)}`}
                />
              </div>

              {/* Month Label */}
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-2 group-hover:text-teal-700 transition-colors">
                {m.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>Hover or tap any month to inspect details</span>
        <span className="flex items-center gap-1 font-medium text-teal-700">
          <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
          Auto-computed ledger analytics
        </span>
      </div>
    </div>
  );
};
