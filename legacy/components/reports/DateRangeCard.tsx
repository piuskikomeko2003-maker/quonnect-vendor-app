'use client';

import React from 'react';
import { Calendar, ArrowRight, ChevronRight } from 'lucide-react';
import { formatSingleDate } from '@/lib/reportDateUtils';

interface DateRangeCardProps {
  from: string;
  to: string;
  onOpenPeriodPicker: () => void;
  note?: string;
}

export const DateRangeCard: React.FC<DateRangeCardProps> = ({
  from,
  to,
  onOpenPeriodPicker,
  note,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          DATE RANGE
        </span>
        <button
          type="button"
          onClick={onOpenPeriodPicker}
          className="text-xs font-bold text-teal-700 hover:text-teal-900 transition-colors flex items-center gap-1 min-h-[36px] px-2 -mr-2"
        >
          <span>Change</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenPeriodPicker}
        className="w-full flex items-center justify-between gap-1.5 sm:gap-2 text-left group min-h-[44px]"
        aria-label="Change period date range"
      >
        {/* Pill 1: FROM */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50/70 border border-teal-200/70 group-hover:border-teal-400 transition-all min-w-0">
          <Calendar className="h-3.5 w-3.5 text-teal-600 shrink-0" />
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-bold text-teal-600 block leading-none">From</span>
            <span className="text-xs font-black text-slate-800 truncate block">
              {formatSingleDate(from)}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />

        {/* Pill 2: TO */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50/70 border border-teal-200/70 group-hover:border-teal-400 transition-all min-w-0">
          <Calendar className="h-3.5 w-3.5 text-teal-600 shrink-0" />
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-bold text-teal-600 block leading-none">To</span>
            <span className="text-xs font-black text-slate-800 truncate block">
              {formatSingleDate(to)}
            </span>
          </div>
        </div>
      </button>

      {note && <p className="text-[11px] text-slate-400 italic pt-0.5">{note}</p>}
    </div>
  );
};
