'use client';

import React from 'react';

interface StatusPillProps {
  status: 'ok' | 'low' | 'out' | 'custom';
  label: string;
  theme?: 'green' | 'amber' | 'red' | 'blue' | 'slate';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label, theme }) => {
  let styleClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (theme === 'green' || status === 'ok') {
    styleClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (theme === 'amber' || status === 'low') {
    styleClasses = 'bg-amber-50 text-amber-900 border-amber-200';
  } else if (theme === 'red' || status === 'out') {
    styleClasses = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (theme === 'blue') {
    styleClasses = 'bg-blue-50 text-blue-800 border-blue-200';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs whitespace-nowrap ${styleClasses}`}
    >
      {label}
    </span>
  );
};
