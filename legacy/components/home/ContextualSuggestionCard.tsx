'use client';

import React from 'react';
import { useFeature } from '@/lib/features';
import { FeatureKey } from '@/types/database.types';
import { Sparkles, ArrowRight, X } from 'lucide-react';

export interface SuggestionRule {
  key: FeatureKey;
  title: string;
  reason: string;
  actionText: string;
}

interface ContextualSuggestionCardProps {
  salesCount: number;
  daysActive: number;
  productCount: number;
}

export const ContextualSuggestionCard: React.FC<ContextualSuggestionCardProps> = ({
  salesCount,
  daysActive,
  productCount,
}) => {
  const { isEnabled: analyticsEnabled, enable: enableAnalytics } = useFeature('deep_analytics');
  const { isEnabled: expenseEnabled, enable: enableExpense } = useFeature('expense');
  const { isEnabled: repsEnabled, enable: enableReps } = useFeature('representatives');

  const [dismissedKey, setDismissedKey] = React.useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('quonnect_suggestion_snoozed_key');
    }
    return null;
  });

  // Determine top suggestion based on Section 5 rules
  let suggestion: SuggestionRule | null = null;

  // 1. Deep Analytics suggestion (20+ sales OR 14+ days)
  if (!analyticsEnabled && (salesCount >= 20 || daysActive >= 14)) {
    suggestion = {
      key: 'deep_analytics',
      title: 'Ready for Deep Analytics?',
      reason: 'You have enough sales data now. See trends, margins, and top sellers.',
      actionText: 'Enable Analytics',
    };
  }
  // 2. Representatives suggestion (30+ sales)
  else if (!repsEnabled && salesCount >= 30) {
    suggestion = {
      key: 'representatives',
      title: 'Growing your shop team?',
      reason: 'Add staff accounts with commission tracking and profit privacy controls.',
      actionText: 'Enable Staff Tools',
    };
  }
  // 3. Expense suggestion (after first week or 5+ sales)
  else if (!expenseEnabled && (daysActive >= 7 || salesCount >= 5)) {
    suggestion = {
      key: 'expense',
      title: 'Track Daily Stall Expenses',
      reason: 'Track rent, transport, boda fees, and supplies to see your true net profit.',
      actionText: 'Enable Expenses',
    };
  }

  if (!suggestion || dismissedKey === suggestion.key) {
    return null;
  }

  const handleEnable = async () => {
    if (!suggestion) return;
    if (suggestion.key === 'deep_analytics') await enableAnalytics();
    if (suggestion.key === 'expense') await enableExpense();
    if (suggestion.key === 'representatives') await enableReps();
  };

  const handleSnooze = () => {
    if (!suggestion) return;
    setDismissedKey(suggestion.key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('quonnect_suggestion_snoozed_key', suggestion.key);
    }
  };

  return (
    <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-teal-900 to-slate-900 text-white shadow-md relative overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-300">
            Smart Suggestion
          </span>
        </div>

        <button
          onClick={handleSnooze}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white transition-colors"
          title="Not now (snooze 14 days)"
          aria-label="Dismiss suggestion"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <h3 className="text-sm font-extrabold text-white mb-1">
        {suggestion.title}
      </h3>
      <p className="text-xs text-slate-300 leading-relaxed mb-4">
        {suggestion.reason}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={handleEnable}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs shadow-sm transition-all"
        >
          <span>{suggestion.actionText}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleSnooze}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
};
