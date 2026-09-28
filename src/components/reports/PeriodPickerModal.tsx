'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import {
  ReportPeriodPreset,
  getPresetDateRange,
  toKampalaDateString,
  getNowInKampala,
} from '@/lib/reportDateUtils';

interface PeriodPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  reportTitle?: string;
}

const PRESET_OPTIONS: Array<{
  id: ReportPeriodPreset;
  label: string;
  iconName?: string;
}> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last-7-days', label: 'Last 7 Days' },
  { id: 'last-30-days', label: 'Last 30 Days' },
  { id: 'this-month', label: 'Current Month' },
  { id: 'previous-month', label: 'Previous Month' },
  { id: 'this-year', label: 'Current Year' },
  { id: 'grand-report', label: 'Grand Report (All time)' },
];

export const PeriodPickerModal: React.FC<PeriodPickerModalProps> = ({
  isOpen,
  onClose,
  reportType,
  reportTitle = 'Report',
}) => {
  const router = useRouter();

  // Custom date range state
  const now = getNowInKampala();
  const todayStr = toKampalaDateString(now);
  const yesterdayStr = toKampalaDateString(new Date(now.getTime() - 86400000));

  const [customFrom, setCustomFrom] = useState(yesterdayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [customError, setCustomError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: ReportPeriodPreset) => {
    onClose();
    router.push(`/reports/${reportType}?preset=${preset}`);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);

    if (customFrom > customTo) {
      setCustomError('FROM date cannot be later than TO date.');
      return;
    }

    onClose();
    router.push(`/reports/${reportType}?from=${customFrom}&to=${customTo}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-label="Close modal overlay" />

      <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-base font-black text-slate-900 leading-tight">
              Select Period
            </h2>
            <p className="text-xs text-slate-500 font-medium">{reportTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* ================= CARD 1: QUICK REPORTS ================= */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-600" />
              <div>
                <h3 className="text-xs font-bold text-slate-900">Quick Reports</h3>
                <p className="text-[10px] text-slate-400">Select a predefined period</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectPreset(opt.id)}
                  className="w-full flex items-center justify-between p-3.5 hover:bg-teal-50/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                    <span className="text-xs font-bold text-slate-800 group-hover:text-teal-900 transition-colors">
                      {opt.label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-teal-600 transition-all" />
                </button>
              ))}
            </div>
          </div>

          {/* ================= CARD 2: CUSTOM DATE RANGE ================= */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-600" />
              <div>
                <h3 className="text-xs font-bold text-slate-900">Custom Date Range</h3>
                <p className="text-[10px] text-slate-400">Select your own date range</p>
              </div>
            </div>

            <form onSubmit={handleCustomSearch} className="p-4 space-y-3">
              {customError && (
                <div className="p-2.5 text-[11px] bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{customError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    FROM
                  </label>
                  <input
                    type="date"
                    required
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    TO
                  </label>
                  <input
                    type="date"
                    required
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-md shadow-teal-600/20 active:scale-98 transition-all min-h-[44px] flex items-center justify-center gap-2"
              >
                <span>Search Report</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
