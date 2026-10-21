'use client';

import React, { useState, useMemo } from 'react';
import { FinanceEntry } from '@/types/database.types';
import { formatUGX, formatDate } from '@/lib/formatters';
import { Search, Trash2, ArrowUpRight, ArrowDownRight, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface TransactionsListProps {
  entries: FinanceEntry[];
  isDemo: boolean;
  onEntryDeleted: (id: string) => void;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({
  entries,
  isDemo,
  onEntryDeleted,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'this_month' | 'last_month'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter logic
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Type filter
      if (selectedType !== 'all' && entry.type !== selectedType) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesCategory = entry.category.toLowerCase().includes(query);
        const matchesNotes = entry.notes?.toLowerCase().includes(query);
        if (!matchesCategory && !matchesNotes) return false;
      }

      // Period filter
      if (selectedPeriod !== 'all') {
        const entryDate = new Date(entry.entry_date);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        if (selectedPeriod === 'this_month') {
          if (entryDate.getFullYear() !== currentYear || entryDate.getMonth() !== currentMonth) {
            return false;
          }
        } else if (selectedPeriod === 'last_month') {
          const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          if (entryDate.getFullYear() !== lastMonthYear || entryDate.getMonth() !== lastMonth) {
            return false;
          }
        }
      }

      return true;
    });
  }, [entries, selectedType, searchTerm, selectedPeriod]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    setDeletingId(id);
    try {
      if (isDemo) {
        onEntryDeleted(id);
      } else {
        const { error } = await supabase.from('finance_entries').delete().eq('id', id);
        if (error) throw error;
        onEntryDeleted(id);
      }
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      alert('Could not delete transaction: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      {/* List Header & Controls */}
      <div className="p-6 border-b border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-slate-900">
              Transactions Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredEntries.length} of {entries.length} recorded entries
            </p>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                selectedType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedType('income')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                selectedType === 'income'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-teal-700'
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setSelectedType('expense')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                selectedType === 'expense'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              Expenses
            </button>
          </div>
        </div>

        {/* Search and Period Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-8 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by category or notes..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            />
          </div>

          <div className="sm:col-span-4 relative">
            <select
              value={selectedPeriod}
              onChange={(e) =>
                setSelectedPeriod(e.target.value as 'all' | 'this_month' | 'last_month')
              }
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
            >
              <option value="all">All Dates</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="py-16 px-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            No transactions found
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedType !== 'all' || selectedPeriod !== 'all'
              ? 'Try clearing your filters or search query.'
              : 'Add your first transaction using the button above.'}
          </p>
        </div>
      ) : (
        <div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-100 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6">Type & Category</th>
                  <th className="py-3.5 px-6">Notes / Reference</th>
                  <th className="py-3.5 px-6">Source</th>
                  <th className="py-3.5 px-6 text-right">Amount (UGX)</th>
                  <th className="py-3.5 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredEntries.map((entry) => {
                  const isIncome = entry.type === 'income';
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-teal-50/20 transition-colors"
                    >
                      <td className="py-3.5 px-6 text-slate-600 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(entry.entry_date)}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-xl ${
                              isIncome
                                ? 'bg-teal-50 text-teal-700 border border-teal-100'
                                : 'bg-rose-50 text-rose-600 border border-rose-100'
                            }`}
                          >
                            {isIncome ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">
                              {entry.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-500 max-w-xs truncate">
                        {entry.notes || '—'}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
                          {entry.source || 'manual'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <span
                          className={`font-extrabold text-sm ${
                            isIncome
                              ? 'text-teal-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {isIncome ? '+' : '−'} {formatUGX(entry.amount)}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredEntries.map((entry) => {
              const isIncome = entry.type === 'income';
              return (
                <div key={entry.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl mt-0.5 ${
                        isIncome
                          ? 'bg-teal-50 text-teal-700 border border-teal-100'
                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {entry.category}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span>{formatDate(entry.entry_date)}</span>
                        {entry.notes && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{entry.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div
                      className={`font-bold text-xs sm:text-sm ${
                        isIncome
                          ? 'text-teal-700'
                          : 'text-rose-600'
                      }`}
                    >
                      {isIncome ? '+' : '−'} {formatUGX(entry.amount)}
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
