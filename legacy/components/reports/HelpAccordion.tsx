'use client';

import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

export interface CalculationFormula {
  label: string;
  formula: string;
  description?: string;
}

interface HelpAccordionProps {
  title?: string;
  formulas: CalculationFormula[];
}

export const HelpAccordion: React.FC<HelpAccordionProps> = ({
  title = 'How values are calculated',
  formulas,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-teal-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 space-y-2.5 bg-white border-t border-slate-200 divide-y divide-slate-100 text-xs">
          {formulas.map((item, idx) => (
            <div key={idx} className={idx > 0 ? 'pt-2' : ''}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-extrabold text-slate-900">{item.label}:</span>
                <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  {item.formula}
                </span>
              </div>
              {item.description && (
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
