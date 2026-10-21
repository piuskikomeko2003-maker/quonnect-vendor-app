'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { ONBOARDING_CATEGORIES } from '@/lib/sampleData';
import { seedSampleDataForVendor } from '@/lib/seedSampleData';
import { formatUGX } from '@/lib/formatters';
import {
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Shirt,
  Utensils,
  Pill,
  Smartphone,
  Apple,
  Truck,
  Scissors,
  Store,
  CheckCircle2,
  Sparkles,
  Building2,
  User,
  MapPin,
  Check,
  Receipt,
  Plus,
  Minus,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingBag,
  Shirt,
  Utensils,
  Pill,
  Smartphone,
  Apple,
  Truck,
  Scissors,
  Store,
};

export default function OnboardingPage() {
  const router = useRouter();
  const { vendor, isDemo, refreshVendor } = useAuth();

  // 4 Steps: 1 = Category, 2 = Country/Currency, 3 = Shop Profile, 4 = First Sale & Done
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Category
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Step 2: Country & Currency
  const [country, setCountry] = useState('Uganda');
  const [currency, setCurrency] = useState('UGX');

  // Step 3: Owner Name & Shop Name
  const [ownerName, setOwnerName] = useState(vendor?.owner_name || '');
  const [businessName, setBusinessName] = useState(vendor?.business_name || '');
  const [region, setRegion] = useState(vendor?.region || 'Central Kampala');
  const [phone, setPhone] = useState(vendor?.phone || '');

  // Step 4: First Sale recording
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [firstSaleQty, setFirstSaleQty] = useState(1);
  const [firstSaleCompleted, setFirstSaleCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeCategory =
    ONBOARDING_CATEGORIES.find((c) => c.id === selectedCategory) || ONBOARDING_CATEGORIES[0];
  const sampleProducts = activeCategory.sampleProducts;
  const currentProduct = sampleProducts[selectedSampleIndex] || sampleProducts[0];

  const handleNext = () => {
    if (step < 4) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    } else {
      router.push('/');
    }
  };

  const handleRecordFirstSale = () => {
    setFirstSaleCompleted(true);
  };

  const handleFinishOnboarding = async () => {
    setIsSaving(true);

    try {
      if (vendor && !isDemo) {
        // Save vendor profile updates
        await supabase
          .from('vendors')
          .update({
            business_name: businessName.trim() || 'My Market Shop',
            owner_name: ownerName.trim() || null,
            category: activeCategory.name,
            region: region.trim(),
            phone: phone.trim() || null,
            currency,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vendor.id);

        // Seed category-appropriate sample products & sample customers
        await seedSampleDataForVendor(vendor.id, selectedCategory || 'fresh_produce', false);
        await refreshVendor();
      } else {
        // Demo mode: seed in local storage
        await seedSampleDataForVendor('demo-vendor-0001', selectedCategory || 'fresh_produce', true);
      }

      // Mark onboarding as completed in local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('quonnect_onboarding_completed', 'true');
        localStorage.setItem('quonnect_first_sale_done', 'true');
      }

      router.push('/?welcome=true');
    } catch (err) {
      console.error('Error completing onboarding:', err);
      router.push('/');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-lg mx-auto pb-6">
      {/* Top Header & 5-Segment Progress Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center justify-center h-10 w-10 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Previous step"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Step {step} of 4
          </span>
          <div className="w-10" />
        </div>

        {/* 5-segment bar per spec */}
        <div className="grid grid-cols-4 gap-1.5 px-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-teal-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Form Content */}
      <main className="flex-1 px-4 py-5">
        {/* ================= STEP 1: WHAT DO YOU SELL? ================= */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                What do you sell?
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Choose a category to set up pre-configured sample products for your stall.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              {ONBOARDING_CATEGORIES.map((cat) => {
                const IconComp = ICON_MAP[cat.iconName] || Store;
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all min-h-[100px] justify-between ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-600 ring-2 ring-teal-600 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl mb-2 ${
                        isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <IconComp className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 leading-snug">
                        {cat.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {cat.sampleProducts.length} sample items
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= STEP 2: COUNTRY & CURRENCY ================= */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                Confirm country & currency
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                We auto-detected Uganda and Uganda Shillings (UGX).
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Country
                </label>
                <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-900">
                  <MapPin className="h-4 w-4 text-teal-600" />
                  <span>{country}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full p-3 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="UGX">UGX — Ugandan Shilling (Default)</option>
                  <option value="KES">KES — Kenyan Shilling</option>
                  <option value="TZS">TZS — Tanzanian Shilling</option>
                  <option value="RWF">RWF — Rwandan Franc</option>
                  <option value="USD">USD — US Dollar</option>
                </select>
              </div>

              {/* Receipt Preview Card */}
              <div className="mt-4 p-4 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  Receipt Price Preview
                </span>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-slate-600">Sample Item Total:</span>
                  <span className="text-lg font-black text-teal-900">
                    {formatUGX(25000)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  Note: You can easily change this anytime later in Settings.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: TELL US ABOUT YOUR SHOP ================= */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                Tell us about your shop
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                This appears on your receipts, invoices, and online stall catalog.
              </p>
            </div>

            <div className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-teal-600" />
                  Shop / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Kampala Fresh Organics"
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-teal-600" />
                  Owner / Manager Name
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. David Mukasa"
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-teal-600" />
                  Market Location / Region
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Nakasero Market, Stall B-12"
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              {/* Live Mini Receipt Preview */}
              <div className="mt-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                <div className="text-center pb-2 border-b border-dashed border-slate-200">
                  <p className="text-xs font-extrabold text-slate-900">
                    {businessName || 'Your Shop Name'}
                  </p>
                  <p className="text-[10px] text-slate-500">{region || 'Kampala, Uganda'}</p>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                  <span>Customer: Walk-in</span>
                  <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: RECORD YOUR FIRST SALE ================= */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {!firstSaleCompleted ? (
              <>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                    Record your first sale
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Tap a sample item from your category and test how fast you can record a sale.
                  </p>
                </div>

                {/* 3 Sample product cards */}
                <div className="space-y-2 pt-1">
                  {sampleProducts.slice(0, 3).map((prod, idx) => {
                    const isSelected = selectedSampleIndex === idx;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedSampleIndex(idx)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-teal-50/80 border-teal-600 shadow-xs ring-1 ring-teal-600'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-900">
                              {prod.name}
                            </span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                              SAMPLE
                            </span>
                          </div>
                          <p className="text-xs font-bold text-teal-700 mt-0.5">
                            {formatUGX(prod.price)}
                          </p>
                        </div>

                        {isSelected && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quantity stepper */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Quantity Sold</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={firstSaleQty <= 1}
                      onClick={() => setFirstSaleQty((q) => Math.max(1, q - 1))}
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-base font-extrabold text-slate-900 w-6 text-center">
                      {firstSaleQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFirstSaleQty((q) => q + 1)}
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sale Calculation Box */}
                <div className="p-3.5 bg-slate-100/80 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-600">Total Sale Amount:</span>
                  <span className="text-sm font-black text-slate-900">
                    {formatUGX(currentProduct.price * firstSaleQty)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRecordFirstSale}
                  className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md shadow-teal-600/20 active:scale-95 transition-all min-h-[44px]"
                >
                  Record Sale
                </button>
              </>
            ) : (
              /* Success Screen */
              <div className="space-y-4 pt-2 text-center animate-in zoom-in-95 duration-200">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    First Sale Recorded!
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Your sales ledger and inventory balance just updated in real time.
                  </p>
                </div>

                {/* Today's Sales & Profit KPI */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-left">
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Today's Sales
                    </span>
                    <p className="text-base font-black text-slate-900 mt-0.5">
                      {formatUGX(currentProduct.price * firstSaleQty)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] font-semibold text-emerald-800">
                      Today's Profit
                    </span>
                    <p className="text-base font-black text-emerald-900 mt-0.5">
                      {formatUGX((currentProduct.price - currentProduct.cost) * firstSaleQty)}
                    </p>
                  </div>
                </div>

                {/* Next Quick Action Chips */}
                <div className="pt-2 text-left space-y-2">
                  <span className="text-xs font-bold text-slate-700">Quick Next Actions:</span>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200">
                      <Sparkles className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>5 sample products and 3 sample customers were seeded</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200">
                      <Receipt className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>Ready to share instant receipts on WhatsApp</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Sticky Bottom Actions */}
      <footer className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-4">
        {step < 4 && (
          <button
            type="button"
            disabled={step === 1 && !selectedCategory}
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md shadow-teal-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[44px]"
          >
            <span>Continue</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {step === 4 && firstSaleCompleted && (
          <button
            type="button"
            disabled={isSaving}
            onClick={handleFinishOnboarding}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md shadow-teal-600/20 active:scale-95 transition-all min-h-[44px]"
          >
            <span>{isSaving ? 'Setting Up Your Shop...' : 'Save My Shop'}</span>
            <Check className="h-4 w-4" />
          </button>
        )}
      </footer>
    </div>
  );
}
