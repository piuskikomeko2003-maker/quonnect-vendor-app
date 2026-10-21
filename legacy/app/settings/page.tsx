'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAllFeatures } from '@/lib/features';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Sliders,
  DollarSign,
  ShoppingCart,
  Boxes,
  Users,
  BarChart,
  Settings as SettingsIcon,
  HelpCircle,
  ShieldAlert,
  LogOut,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Mail,
  Sparkles,
  Trash2,
} from 'lucide-react';

export default function SettingsPage() {
  const { vendor, isDemo, signOut } = useAuth();
  const { features } = useAllFeatures();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
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
                Settings & Business Profile
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {vendor?.business_name || 'My Shop'}
              </p>
            </div>
          </div>

          <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {vendor?.currency || 'UGX'}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6 space-y-6">
        {/* Featured Card: More Tools & Add-on modules */}
        <Link
          href="/settings/more-tools"
          className="group block rounded-2xl p-4 bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md shadow-teal-700/20 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                <Sliders className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold">More Tools & Modules</h2>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/25">
                    Customize
                  </span>
                </div>
                <p className="text-xs text-teal-100 mt-0.5">
                  Turn on Expenses, Suppliers, POs, Quotations, Staff accounts & Branches
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-teal-200 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Group 1: Business Profile & Receipts */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Business Profile & Receipts
            </h3>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Business Name</span>
              <span className="font-semibold text-slate-900">{vendor?.business_name || 'Market Stall'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500">Operating Region</span>
              <span className="font-semibold text-slate-900">{vendor?.region || 'Central Kampala'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500">Phone Number</span>
              <span className="font-semibold text-slate-900">{vendor?.phone || '+256 701 234 567'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500">Default Currency</span>
              <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md text-xs border border-teal-200">
                {vendor?.currency || 'UGX (Uganda Shilling)'}
              </span>
            </div>
          </div>
        </section>

        {/* Group 2: Enabled Business Modules */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Add-on Modules
            </h3>
            <Link
              href="/settings/more-tools"
              className="text-xs font-bold text-teal-700 hover:text-teal-800"
            >
              Manage
            </Link>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {features.expense && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">Expenses Tracker</span>
                <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            )}
            {features.income && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">Other Income</span>
                <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            )}
            {features.suppliers && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">Suppliers Directory</span>
                <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            )}
            {features.purchases && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">Purchases & Purchase Orders</span>
                <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            )}
            {features.damaged_items && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">Damaged & Lost Items Log</span>
                <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            )}
            {features.deep_analytics && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">Deep Analytics</span>
                <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            )}
            {features.representatives && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">Staff & Representatives</span>
                <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            )}
            {features.multi_store && (
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-slate-700">Multi-Store Branches</span>
                <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">Enabled</span>
              </div>
            )}
            {!features.expense &&
              !features.income &&
              !features.suppliers &&
              !features.purchases &&
              !features.damaged_items &&
              !features.deep_analytics &&
              !features.representatives &&
              !features.multi_store && (
                <div className="px-4 py-6 text-center text-xs text-slate-500">
                  <p>No optional add-on modules currently enabled.</p>
                  <p className="mt-1">
                    Your app is in lightweight Core mode (Products, Sales POS, Customers, Reports).
                  </p>
                  <Link
                    href="/settings/more-tools"
                    className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 font-semibold border border-teal-200"
                  >
                    Browse More Tools
                  </Link>
                </div>
              )}
          </div>
        </section>

        {/* Group 3: Help & Support */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Help & Support
            </h3>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            <a
              href="https://wa.me/256701234567?text=Hello%20Quonnect%20Vendor%20Support"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-slate-800">WhatsApp Vendor Help</span>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </a>
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-teal-600" />
                <span className="font-medium text-slate-800">Email Support</span>
              </div>
              <span className="text-xs text-slate-500">support@quonnect.app</span>
            </div>
          </div>
        </section>

        {/* Group 4: Danger Zone & Sign Out */}
        <section className="bg-white rounded-2xl border border-rose-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-rose-100 bg-rose-50/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Danger Zone
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <button
              onClick={() => {
                if (confirm('Clear sample demo data? Your real products, customers, and sales will not be affected.')) {
                  localStorage.removeItem('quonnect_demo_entries');
                  alert('Sample data cleared.');
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
            >
              <Trash2 className="h-4 w-4 text-slate-500" />
              <span>Clear Sample Demo Data</span>
            </button>

            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out of Quonnect</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
