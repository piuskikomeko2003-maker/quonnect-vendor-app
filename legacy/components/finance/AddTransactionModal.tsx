'use client';

import React, { useState } from 'react';
import { X, Plus, Check, Calendar, Tag, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { FinanceEntry } from '@/types/database.types';
import { formatUGX } from '@/lib/formatters';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  isDemo: boolean;
  onEntryAdded: (entry: FinanceEntry) => void;
}

const INCOME_CATEGORIES = [
  'Stall Sales',
  'Wholesale Order',
  'Marketplace Order',
  'Advance / Deposit',
  'Delivery Fee Collected',
  'Other Income',
];

const EXPENSE_CATEGORIES = [
  'Stock / Goods Purchase',
  'Transport & Boda',
  'Stall Rent',
  'Staff Wages',
  'Packaging & Bags',
  'Utilities / Airtime / Power',
  'Market Fees & Levies',
  'Other Expense',
];

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  isDemo,
  onEntryAdded,
}) => {
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('Stall Sales');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    if (newType === 'income') {
      setCategory(INCOME_CATEGORIES[0]);
    } else {
      setCategory(EXPENSE_CATEGORIES[0]);
    }
    setIsCustomCategory(false);
  };

  const handleQuickAdd = (increment: number) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(current + increment));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0 UGX.');
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      setError('Please specify a category.');
      return;
    }

    setLoading(true);

    try {
      if (isDemo) {
        const demoEntry: FinanceEntry = {
          id: 'demo-entry-' + crypto.randomUUID(),
          vendor_id: vendorId,
          type,
          category: finalCategory,
          amount: numericAmount,
          source: 'manual',
          entry_date: entryDate,
          notes: notes.trim() || null,
          created_at: new Date().toISOString(),
        };
        onEntryAdded(demoEntry);
        onClose();
        resetForm();
      } else {
        const { data, error: insertError } = await supabase
          .from('finance_entries')
          .insert({
            vendor_id: vendorId,
            type,
            category: finalCategory,
            amount: numericAmount,
            source: 'manual',
            entry_date: entryDate,
            notes: notes.trim() || null,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        if (data) {
          onEntryAdded(data);
          onClose();
          resetForm();
        }
      }
    } catch (err) {
      console.error('Error saving transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to save transaction.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setNotes('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setIsCustomCategory(false);
    setCustomCategory('');
  };

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              New Transaction
            </h2>
            <p className="text-xs text-slate-500">
              Record an income or operational expense entry
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 rounded-xl border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2.5 px-4 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                type === 'income'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="h-4 w-4" />
              Income (+)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2.5 px-4 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="font-bold text-lg leading-none">−</span>
              Expense (−)
            </button>
          </div>

          {/* Amount Input with Live UGX Formatting */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Amount (UGX) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                UGX
              </div>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-14 pr-4 py-3 text-lg font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-300"
              />
            </div>

            {/* Quick Increment Chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[11px] text-slate-400 mr-1">Quick add:</span>
              {[10000, 50000, 100000, 500000].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handleQuickAdd(inc)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 transition-colors border border-slate-200/60"
                >
                  +{inc >= 1000 ? `${inc / 1000}k` : inc}
                </button>
              ))}
            </div>

            {amount && parseFloat(amount) > 0 && (
              <p className="mt-1.5 text-xs font-bold text-teal-700">
                Preview: {formatUGX(amount)}
              </p>
            )}
          </div>

          {/* Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-teal-600" />
                Category
              </label>
              <button
                type="button"
                onClick={() => setIsCustomCategory(!isCustomCategory)}
                className="text-xs text-teal-700 hover:underline font-semibold"
              >
                {isCustomCategory ? 'Choose Preset' : '+ Custom Category'}
              </button>
            </div>

            {isCustomCategory ? (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. Generator Fuel, Solar Battery..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`p-2.5 text-left text-xs rounded-xl font-semibold border transition-all truncate flex items-center justify-between ${
                        isSelected
                          ? type === 'income'
                            ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-xs'
                            : 'bg-rose-50 border-rose-500 text-rose-800 shadow-xs'
                          : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300'
                      }`}
                      title={cat}
                    >
                      <span className="truncate">{cat}</span>
                      {isSelected && <Check className="h-3 w-3 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-teal-600" />
              Date
            </label>
            <input
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-teal-600" />
              Notes / Memo (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Receipt #402, paid via Airtel Money"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl text-white shadow-md transition-all flex items-center gap-2 ${
                type === 'income'
                  ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save {type === 'income' ? 'Income' : 'Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
