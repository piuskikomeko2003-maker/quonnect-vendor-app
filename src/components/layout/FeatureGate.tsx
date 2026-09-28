'use client';

import React from 'react';
import { useFeature } from '@/lib/features';
import { FeatureKey } from '@/types/database.types';
import Link from 'next/link';
import { Sliders, Lock } from 'lucide-react';

interface FeatureGateProps {
  featureKey: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children if the feature is enabled.
 * If disabled and no custom fallback is provided, displays a friendly "Module not enabled" message
 * with a one-tap link to activate it in More Tools.
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  featureKey,
  children,
  fallback,
}) => {
  const { isEnabled, enable } = useFeature(featureKey);

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 mb-4 border border-teal-100">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">
        This tool is currently turned off
      </h3>
      <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
        This optional module is inactive to keep your daily app light and clean. You can turn it on anytime with your existing data preserved.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => enable()}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all"
        >
          Enable Module Now
        </button>
        <Link
          href="/settings/more-tools"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>More Tools</span>
        </Link>
      </div>
    </div>
  );
};
