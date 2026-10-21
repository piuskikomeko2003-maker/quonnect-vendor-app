'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { clearSampleDataForVendor } from '@/lib/seedSampleData';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Package,
  ShoppingBag,
  BarChart2,
  Trash2,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface GettingStartedChecklistProps {
  hasProducts: boolean;
  hasSales: boolean;
  sampleCleared: boolean;
  onSampleCleared: () => void;
}

export const GettingStartedChecklist: React.FC<GettingStartedChecklistProps> = ({
  hasProducts,
  hasSales,
  sampleCleared,
  onSampleCleared,
}) => {
  const { vendor, isDemo } = useAuth();
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('quonnect_checklist_dismissed') === 'true';
    }
    return false;
  });
  const [clearing, setClearing] = useState(false);

  if (isDismissed) return null;

  // 4 steps driven by REAL data state
  const tasks = [
    {
      id: 'product',
      label: 'Add your first real product',
      done: hasProducts,
      href: '/stall',
      actionText: 'Add Product',
    },
    {
      id: 'sale',
      label: 'Record your first real sale',
      done: hasSales,
      href: '/pos',
      actionText: 'Open POS',
    },
    {
      id: 'report',
      label: "View today's sales report",
      done: hasSales,
      href: '/reports',
      actionText: 'View Report',
    },
    {
      id: 'sample',
      label: 'Clear sample starter data',
      done: sampleCleared,
      actionText: 'Clear Sample',
      isCustomAction: true,
    },
  ];

  const completedCount = tasks.filter((t) => t.done).length;
  const isAllDone = completedCount === tasks.length;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('quonnect_checklist_dismissed', 'true');
    }
  };

  const handleClearSample = async () => {
    if (!vendor) return;
    setClearing(true);
    await clearSampleDataForVendor(vendor.id, isDemo);
    onSampleCleared();
    setClearing(false);
  };

  return (
    <div className="rounded-3xl p-4 sm:p-5 bg-white border border-teal-200/90 shadow-sm relative overflow-hidden">
      {/* Background soft teal highlight */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50/60 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white">
              <Sparkles className="h-3 w-3" />
            </span>
            <h2 className="text-sm font-extrabold text-slate-900">
              Getting Started Checklist
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              {completedCount} of {tasks.length} done
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Set up your shop for fast daily sales and bookkeeping
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Dismiss checklist"
          aria-label="Dismiss checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-teal-600 rounded-full transition-all duration-300"
          style={{ width: `${(completedCount / tasks.length) * 100}%` }}
        />
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
              task.done
                ? 'bg-slate-50/70 border-slate-100 text-slate-400'
                : 'bg-white border-slate-200 text-slate-800 font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {task.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 shrink-0" />
              )}
              <span className={task.done ? 'line-through text-slate-400' : 'text-slate-800'}>
                {task.label}
              </span>
            </div>

            {!task.done && (
              <div>
                {task.isCustomAction ? (
                  <button
                    onClick={handleClearSample}
                    disabled={clearing}
                    className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold text-[11px] border border-teal-200 transition-colors"
                  >
                    {clearing ? 'Clearing...' : task.actionText}
                  </button>
                ) : (
                  <Link
                    href={task.href || '/'}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold text-[11px] border border-teal-200 transition-colors"
                  >
                    <span>{task.actionText}</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
