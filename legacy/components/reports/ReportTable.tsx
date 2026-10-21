'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  align?: 'left' | 'right' | 'center';
  cell?: (row: T) => React.ReactNode;
}

interface ReportTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  renderMobileCard: (item: T) => React.ReactNode;
  footerRow?: React.ReactNode;
  emptyState?: React.ReactNode;
  pageSize?: number;
}

export function ReportTable<T extends { id?: string | number }>({
  data,
  columns,
  searchPlaceholder = 'Search items...',
  searchValue,
  onSearchChange,
  renderMobileCard,
  footerRow,
  emptyState,
  pageSize = 25,
}: ReportTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const visibleData = data.slice(0, currentPage * pageSize);
  const hasMore = visibleData.length < data.length;

  return (
    <div className="space-y-3">
      {/* Search Input if enabled */}
      {onSearchChange && (
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      )}

      {/* ================= MOBILE VIEW (< 640px): Cards Layout ================= */}
      <div className="sm:hidden space-y-2.5">
        {visibleData.map((item, idx) => (
          <React.Fragment key={item.id ?? idx}>{renderMobileCard(item)}</React.Fragment>
        ))}

        {visibleData.length === 0 && emptyState}

        {/* Footer row on mobile */}
        {footerRow && visibleData.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-100/90 border border-slate-200 font-bold text-xs text-slate-800">
            {footerRow}
          </div>
        )}
      </div>

      {/* ================= DESKTOP VIEW (>= 640px): Full Table ================= */}
      <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-extrabold text-[10px]">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={`px-4 py-3 ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleData.map((item, rowIdx) => (
                <tr key={item.id ?? rowIdx} className="hover:bg-slate-50/60 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-4 py-3 text-slate-800 font-medium ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.cell
                        ? col.cell(item)
                        : col.accessorKey
                        ? String(item[col.accessorKey] ?? '')
                        : ''}
                    </td>
                  ))}
                </tr>
              ))}

              {visibleData.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-slate-400">
                    {emptyState || 'No items found.'}
                  </td>
                </tr>
              )}
            </tbody>

            {/* Desktop Table Footer */}
            {footerRow && visibleData.length > 0 && (
              <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-slate-900">
                <tr>
                  <td colSpan={columns.length} className="px-4 py-3">
                    {footerRow}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Pagination "Load More" */}
      {hasMore && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-4 py-2 min-h-[44px] inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-bold text-xs text-slate-700 shadow-xs transition-colors"
          >
            Load More ({data.length - visibleData.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
