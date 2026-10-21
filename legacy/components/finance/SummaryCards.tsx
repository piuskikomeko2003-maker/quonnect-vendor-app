'use client';

import React from 'react';
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { formatUGX } from '@/lib/formatters';

interface SummaryCardsProps {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  entryCount: number;
  periodLabel: string;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalIncome,
  totalExpenses,
  netBalance,
  entryCount,
  periodLabel,
}) => {
  const isProfitable = netBalance >= 0;
  const savingsRate = totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {/* Total Income Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-teal-100 p-6 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-teal-700 uppercase">
            Total Income
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-100">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {formatUGX(totalIncome)}
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span className="inline-flex items-center font-semibold text-teal-700 mr-1">
              +{totalIncome > 0 ? '100%' : '0%'}
            </span>
            <span>cash inflows ({periodLabel.toLowerCase()})</span>
          </div>
        </div>
      </div>

      {/* Total Expenses Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-rose-100 p-6 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-rose-600 uppercase">
            Total Expenses
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <ArrowDownRight className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {formatUGX(totalExpenses)}
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span className="inline-flex items-center font-semibold text-rose-600 mr-1">
              {totalIncome > 0 ? `${Math.round((totalExpenses / totalIncome) * 100)}%` : '0%'}
            </span>
            <span>of gross revenue spent</span>
          </div>
        </div>
      </div>

      {/* Net Balance / Growth Card */}
      <div className={`relative overflow-hidden rounded-3xl sm:col-span-2 lg:col-span-1 p-6 shadow-sm hover:shadow-md transition-all border ${
        isProfitable
          ? 'bg-gradient-to-br from-teal-50/70 via-teal-50/30 to-white border-teal-200'
          : 'bg-gradient-to-br from-rose-50/70 via-rose-50/30 to-white border-rose-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              Net Balance
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
              isProfitable 
                ? 'bg-teal-100 text-teal-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {isProfitable ? 'Positive Margin' : 'Deficit'}
            </span>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
            isProfitable ? 'bg-teal-100/80 text-teal-700 border-teal-200' : 'bg-rose-100/80 text-rose-700 border-rose-200'
          }`}>
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
            isProfitable ? 'text-teal-700' : 'text-rose-600'
          }`}>
            {formatUGX(netBalance)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{entryCount} recorded {entryCount === 1 ? 'entry' : 'entries'}</span>
            <span className="font-semibold text-slate-700">
              {savingsRate}% Margin
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
