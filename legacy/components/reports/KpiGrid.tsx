'use client';

import React from 'react';

export interface KpiItem {
  label: string;
  value: string;
  caption?: string;
  theme?: 'green' | 'teal' | 'amber' | 'red' | 'slate';
}

interface KpiGridProps {
  items: KpiItem[];
}

export const KpiGrid: React.FC<KpiGridProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      {items.map((kpi, idx) => {
        let themeClasses = 'bg-slate-50 border-slate-200 text-slate-900';
        let labelClasses = 'text-slate-500';
        let valClasses = 'text-slate-900';

        if (kpi.theme === 'green') {
          themeClasses = 'bg-emerald-50/70 border-emerald-200 text-emerald-950';
          labelClasses = 'text-emerald-800';
          valClasses = 'text-emerald-950';
        } else if (kpi.theme === 'teal') {
          themeClasses = 'bg-teal-50/70 border-teal-200 text-teal-950';
          labelClasses = 'text-teal-800';
          valClasses = 'text-teal-950';
        } else if (kpi.theme === 'amber') {
          themeClasses = 'bg-amber-50/70 border-amber-200 text-amber-950';
          labelClasses = 'text-amber-800';
          valClasses = 'text-amber-950';
        } else if (kpi.theme === 'red') {
          themeClasses = 'bg-rose-50/70 border-rose-200 text-rose-950';
          labelClasses = 'text-rose-800';
          valClasses = 'text-rose-950';
        }

        return (
          <div
            key={idx}
            className={`p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col justify-between min-h-[92px] ${themeClasses}`}
          >
            <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider block ${labelClasses}`}>
              {kpi.label}
            </span>

            <div className="my-1">
              <span className={`text-base sm:text-xl font-black tracking-tight leading-tight block truncate ${valClasses}`}>
                {kpi.value}
              </span>
            </div>

            {kpi.caption && (
              <span className="text-[10px] text-slate-500 block truncate font-medium">
                {kpi.caption}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
