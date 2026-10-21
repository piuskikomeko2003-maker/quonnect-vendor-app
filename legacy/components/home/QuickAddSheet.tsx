'use client';

import React from 'react';
import Link from 'next/link';
import { useFeature } from '@/lib/features';
import {
  X,
  ShoppingBag,
  Package,
  Users,
  Receipt,
  Wallet,
  Truck,
  AlertOctagon,
  FileText,
} from 'lucide-react';

interface QuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewProduct: () => void;
  onOpenNewTransaction: () => void;
}

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({
  isOpen,
  onClose,
  onOpenNewProduct,
  onOpenNewTransaction,
}) => {
  const { isEnabled: hasExpense } = useFeature('expense');
  const { isEnabled: hasIncome } = useFeature('income');
  const { isEnabled: hasSuppliers } = useFeature('suppliers');
  const { isEnabled: hasDamaged } = useFeature('damaged_items');
  const { isEnabled: hasQuotations } = useFeature('quotations');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label="Close sheet overlay"
      />

      <div className="relative bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl p-5 pb-safe z-10 max-w-lg mx-auto w-full animate-in slide-in-from-bottom duration-300">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-900">
            Quick Add & Record
          </h3>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. New Sale (POS) */}
          <Link
            href="/pos"
            onClick={onClose}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 hover:bg-teal-100 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">New Sale</p>
              <p className="text-[10px] text-teal-700">Quick POS sell</p>
            </div>
          </Link>

          {/* 2. New Product */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewProduct();
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">New Product</p>
              <p className="text-[10px] text-slate-500">Add to inventory</p>
            </div>
          </button>

          {/* 3. New Customer */}
          <Link
            href="/customers?action=new"
            onClick={onClose}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">New Customer</p>
              <p className="text-[10px] text-slate-500">Contact & balance</p>
            </div>
          </Link>

          {/* 4. New Expense (if enabled) or legacy Add Entry */}
          {hasExpense ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNewTransaction();
              }}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 hover:bg-rose-100 transition-colors text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shrink-0">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">New Expense</p>
                <p className="text-[10px] text-rose-700">Cost & bills</p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNewTransaction();
              }}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">Cash Entry</p>
                <p className="text-[10px] text-slate-500">Manual log</p>
              </div>
            </button>
          )}

          {/* Conditional Tier 2: New Quotation */}
          {hasQuotations && (
            <Link
              href="/quotations?action=new"
              onClick={onClose}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">Quotation</p>
                <p className="text-[10px] text-slate-500">Price estimate</p>
              </div>
            </Link>
          )}

          {/* Conditional Tier 2: Damaged item log */}
          {hasDamaged && (
            <Link
              href="/damaged-items?action=new"
              onClick={onClose}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700 shrink-0">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">Record Loss</p>
                <p className="text-[10px] text-slate-500">Spoilage / damage</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
