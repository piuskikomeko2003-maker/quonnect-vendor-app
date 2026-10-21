'use client';

import React from 'react';
import { X, FileText, FileSpreadsheet, Printer, Share2, Download } from 'lucide-react';

interface ExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  onExportPDF: () => void;
  onExportCSV: () => void;
}

export const ExportSheet: React.FC<ExportSheetProps> = ({
  isOpen,
  onClose,
  reportTitle,
  onExportPDF,
  onExportCSV,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:hidden">
      <div className="fixed inset-0" onClick={onClose} aria-label="Close export sheet" />

      <div className="relative bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl max-w-lg mx-auto w-full p-5 pb-safe z-10 animate-in slide-in-from-bottom duration-300 space-y-4">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />

        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Export Report</h3>
            <p className="text-xs text-slate-500 truncate max-w-xs">{reportTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {/* Option 1: PDF */}
          <button
            onClick={() => {
              onClose();
              onExportPDF();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-950 hover:bg-teal-100 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold">Printable PDF Report</p>
                <p className="text-[11px] text-teal-800">Clean landscape layout, view, print & share</p>
              </div>
            </div>
            <Printer className="h-4 w-4 text-teal-600" />
          </button>

          {/* Option 2: CSV / Excel */}
          <button
            onClick={() => {
              onClose();
              onExportCSV();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold">CSV / Excel Spreadsheet</p>
                <p className="text-[11px] text-slate-500">Download raw filtered rows for spreadsheet analysis</p>
              </div>
            </div>
            <Download className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
