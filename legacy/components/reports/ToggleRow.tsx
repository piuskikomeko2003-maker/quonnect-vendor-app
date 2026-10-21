'use client';

import React from 'react';

interface ToggleRowProps {
  icon?: React.ReactNode;
  title: string;
  helperText?: string;
  statusChip: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

export const ToggleRow: React.FC<ToggleRowProps> = ({
  icon,
  title,
  helperText,
  statusChip,
  checked,
  onChange,
}) => {
  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            {icon}
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{title}</h4>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                checked
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {statusChip}
            </span>
          </div>
          {helperText && <p className="text-[11px] text-slate-400">{helperText}</p>}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-teal-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
