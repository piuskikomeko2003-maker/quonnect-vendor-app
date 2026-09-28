'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAllFeatures } from '@/lib/features';
import { FeatureKey } from '@/types/database.types';
import Link from 'next/link';
import {
  ArrowLeft,
  Sliders,
  Receipt,
  Wallet,
  Truck,
  PackagePlus,
  AlertOctagon,
  History,
  FileText,
  BarChart3,
  Users,
  Store,
  ArrowLeftRight,
  Info,
  CheckCircle2,
  Lock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Receipt,
  Wallet,
  Truck,
  PackagePlus,
  AlertOctagon,
  History,
  FileText,
  BarChart3,
  Users,
  Store,
  ArrowLeftRight,
};

export default function MoreToolsPage() {
  const { vendor, isDemo } = useAuth();
  const { features, toggleFeature, metadataList } = useAllFeatures();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const tier2Tools = metadataList.filter((m) => m.tier === 2);
  const tier3Tools = metadataList.filter((m) => m.tier === 3);

  const handleToggle = async (key: FeatureKey, currentStatus: boolean) => {
    setUpdatingKey(key);
    setFeedbackMsg(null);
    const newStatus = !currentStatus;
    const ok = await toggleFeature(key, newStatus);
    setUpdatingKey(null);

    if (ok) {
      setFeedbackMsg({
        text: `${newStatus ? 'Enabled' : 'Disabled'} module. Your existing data is always preserved safely.`,
        type: 'success',
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center h-10 w-10 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                More Tools & Add-ons
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Customize your app by turning modules on or off
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/80">
            <Sliders className="h-3.5 w-3.5 text-teal-600" />
            <span>Modular</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 sm:pt-6 space-y-6">
        {/* Informative Banner */}
        <div className="rounded-2xl p-4 bg-white border border-teal-100 shadow-xs flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Info className="h-5 w-5" />
          </div>
          <div className="text-xs leading-relaxed text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">
              Only see what you need — keep your app light and fast
            </p>
            <p>
              Enabling a tool adds it to your navigation, forms, and quick actions. Disabling a tool simply hides it from view; <strong>it never deletes your recorded data</strong>.
            </p>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Tier 2: Growing Business Add-ons */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white text-[11px] font-bold">
                2
              </span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Growing Business Tools
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Opt-in modules
            </span>
          </div>

          <div className="space-y-2.5">
            {tier2Tools.map((tool) => {
              const isEnabled = Boolean(features[tool.key]);
              const IconComp = ICON_MAP[tool.iconName] || HelpCircle;
              const isBusy = updatingKey === tool.key;

              return (
                <div
                  key={tool.key}
                  className={`rounded-2xl p-4 border transition-all ${
                    isEnabled
                      ? 'bg-white border-teal-300 shadow-xs'
                      : 'bg-white/70 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isEnabled
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {tool.title}
                          </h3>
                          {isEnabled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {tool.shortDescription}
                        </p>
                        <p className="text-[11px] text-slate-400 italic">
                          {tool.exampleUseCase}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      disabled={isBusy}
                      onClick={() => handleToggle(tool.key, isEnabled)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                        isEnabled ? 'bg-teal-600' : 'bg-slate-200'
                      } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="sr-only">Toggle {tool.title}</span>
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tier 3: Multi-staff & Multi-branch */}
        <section className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white text-[11px] font-bold">
                3
              </span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Multi-Staff & Branches
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              For teams & multiple locations
            </span>
          </div>

          <div className="space-y-2.5">
            {tier3Tools.map((tool) => {
              const isEnabled = Boolean(features[tool.key]);
              const IconComp = ICON_MAP[tool.iconName] || HelpCircle;
              const isBusy = updatingKey === tool.key;

              return (
                <div
                  key={tool.key}
                  className={`rounded-2xl p-4 border transition-all ${
                    isEnabled
                      ? 'bg-white border-teal-300 shadow-xs'
                      : 'bg-white/70 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isEnabled
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {tool.title}
                          </h3>
                          {isEnabled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {tool.shortDescription}
                        </p>
                        <p className="text-[11px] text-slate-400 italic">
                          {tool.exampleUseCase}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      disabled={isBusy}
                      onClick={() => handleToggle(tool.key, isEnabled)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                        isEnabled ? 'bg-teal-600' : 'bg-slate-200'
                      } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="sr-only">Toggle {tool.title}</span>
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Safe Backing Note */}
        <div className="pt-2 text-center text-xs text-slate-400">
          Quonnect Business Engine • UGX default • Mobile-optimized
        </div>
      </main>
    </div>
  );
}
