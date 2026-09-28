'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { FinanceEntry } from '@/types/database.types';
import { formatUGX, formatDate } from '@/lib/formatters';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { FeatureGate } from '@/components/layout/FeatureGate';
import {
  Plus,
  Receipt,
  Search,
  Calendar,
  X,
  Check,
  Trash2,
  Tag,
  DollarSign,
  AlertCircle,
  FileImage,
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Advertising & Promotion',
  'Transport & Boda Boda',
  'Rent or Lease (Market Stall)',
  'Supplies & Packaging',
  'Utilities (Water, Power, Airtime)',
  'Professional Services & Fees',
  'Personal Drawings',
  'Other Expenses',
];

export default function ExpensesPage() {
  const { vendor, isDemo } = useAuth();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add form fields
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[1]); // default Transport
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load expenses
  useEffect(() => {
    async function loadExpenses() {
      if (!vendor) return;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('quonnect_demo_entries');
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as FinanceEntry[];
              setEntries(parsed.filter((e) => e.type === 'expense'));
              return;
            } catch {}
          }
        }
        setEntries([]);
        return;
      }

      const { data } = await supabase
        .from('finance_entries')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('type', 'expense')
        .is('deleted_at', null)
        .order('entry_date', { ascending: false });

      if (data) setEntries(data as FinanceEntry[]);
    }

    loadExpenses();
  }, [vendor, isDemo]);

  // Filtered expenses
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          e.category.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [entries, selectedCategory, searchTerm]);

  const totalExpenseAmount = filteredEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter what this expense was for.');
      return;
    }

    setSaving(true);
    const newEntry: FinanceEntry = {
      id: crypto.randomUUID(),
      vendor_id: vendor?.id || 'demo-vendor-0001',
      type: 'expense',
      category: category.trim(),
      amount: numAmount,
      source: 'manual',
      entry_date: entryDate,
      notes: name.trim() + (notes.trim() ? ` — ${notes.trim()}` : ''),
      created_at: new Date().toISOString(),
    };

    if (isDemo) {
      setEntries((prev) => [newEntry, ...prev]);
      setIsAddOpen(false);
      setName('');
      setAmount('');
      setNotes('');
      setSaving(false);
      return;
    }

    try {
      const { data, error: insertErr } = await supabase
        .from('finance_entries')
        .insert({
          id: newEntry.id,
          vendor_id: newEntry.vendor_id,
          type: 'expense',
          category: newEntry.category,
          amount: newEntry.amount,
          source: 'manual',
          entry_date: newEntry.entry_date,
          notes: newEntry.notes,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      if (data) setEntries((prev) => [data as FinanceEntry, ...prev]);

      setIsAddOpen(false);
      setName('');
      setAmount('');
      setNotes('');
    } catch (err) {
      console.error('Error saving expense:', err);
      setError('Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Delete this expense entry?')) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (!isDemo && vendor) {
      await supabase.from('finance_entries').delete().eq('id', id);
    }
  };

  return (
    <FeatureGate featureKey="expense">
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
        {/* Top Navbar */}
        <Navbar
          title="Expenses Tracker"
          onOpenAddModal={() => setIsAddOpen(true)}
          actionButtonLabel="Add Expense"
        />

        <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          {/* Overview Header */}
          <div className="rounded-3xl p-5 bg-gradient-to-r from-rose-800 to-rose-600 text-white shadow-md flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-rose-100 uppercase tracking-wider">
                Total Expenses
              </span>
              <p className="text-2xl font-black mt-0.5">{formatUGX(totalExpenseAmount)}</p>
              <p className="text-xs text-rose-200 mt-1">
                {filteredEntries.length} recorded expense transactions
              </p>
            </div>

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white text-rose-900 font-extrabold text-xs shadow-sm hover:bg-rose-50 transition-colors"
            >
              <Plus className="h-4 w-4 text-rose-600" />
              <span>New Expense</span>
            </button>
          </div>

          {/* Search & Categories */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search expenses by note or category..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Categories
              </button>
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Expenses List */}
          <div className="space-y-2.5">
            {filteredEntries.map((e) => (
              <div
                key={e.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-rose-300 transition-all flex items-center justify-between"
              >
                <div className="space-y-0.5 max-w-[65%]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 truncate">
                      {e.notes || e.category}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-rose-700">{e.category}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(e.entry_date)}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-rose-600">
                    -{formatUGX(e.amount)}
                  </span>
                  <button
                    onClick={() => handleDeleteExpense(e.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {filteredEntries.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-1" />
                <p>No expenses found.</p>
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="mt-3 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold"
                >
                  Record First Expense
                </button>
              </div>
            )}
          </div>
        </main>

        {/* 4-Item Bottom Nav */}
        <BottomNav />

        {/* ================= ADD EXPENSE MODAL ================= */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="fixed inset-0" onClick={() => setIsAddOpen(false)} />

            <div className="relative bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md z-10 overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900">Record Expense</h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="p-5 space-y-3.5">
                {error && (
                  <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expense Description / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Boda delivery to Nakawa, Stall rent, Paper bags"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount (UGX) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="25,000"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-rose-500 font-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 outline-none bg-white text-slate-900"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md shadow-rose-600/20 active:scale-98 transition-all min-h-[44px]"
                  >
                    {saving ? 'Saving Expense...' : 'Save Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
