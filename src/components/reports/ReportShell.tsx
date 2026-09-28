'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Share2, Printer, Download, Sparkles, Sliders } from 'lucide-react';

interface ReportShellProps {
  title: string;
  subtitle?: string;
  onOpenExport?: () => void;
  backHref?: string;
  hasSampleData?: boolean;
  children: React.ReactNode;
}

export const ReportShell: React.FC<ReportShellProps> = ({
  title,
  subtitle,
  onOpenExport,
  backHref = '/reports',
  hasSampleData = false,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-teal-100 shadow-xs print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="flex items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {title}
              </h1>
              {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
            </div>
          </div>

          {onOpenExport && (
            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 text-xs font-bold transition-colors min-h-[44px]"
              aria-label="Export Report"
            >
              <Share2 className="h-4 w-4 text-teal-600" />
              <span>Export</span>
            </button>
          )}
        </div>
      </header>

      {/* Thin Sample Data Banner if applicable */}
      {hasSampleData && (
        <div className="bg-amber-500 text-amber-950 px-4 py-1.5 text-[11px] font-bold text-center flex items-center justify-center gap-1.5 shadow-xs print:hidden">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Includes sample starter data</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">{children}</main>
    </div>
  );
};
