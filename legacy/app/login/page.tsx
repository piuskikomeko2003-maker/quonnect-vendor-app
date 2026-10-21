'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { Store, Sparkles, ArrowRight, Lock, Mail, Phone, MapPin, Tag, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { enableDemoMode } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Vendor profile fields for signup
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Fresh Produce & Groceries');
  const [region, setRegion] = useState('Central Kampala');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        router.push('/');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to sign in. Please verify your email and password.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!businessName.trim()) {
      setMessage({ type: 'error', text: 'Please enter your business or stall name.' });
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            business_name: businessName.trim(),
            category: category.trim(),
            region: region.trim(),
            phone: phone.trim() || null,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Fallback manual upsert in case trigger didn't run
        try {
          await supabase.from('vendors').upsert({
            user_id: authData.user.id,
            business_name: businessName.trim(),
            category: category.trim(),
            region: region.trim(),
            phone: phone.trim() || null,
          }, { onConflict: 'user_id' });
        } catch {
          console.log('Trigger handled vendor row');
        }

        if (authData.session) {
          router.push('/onboarding');
        } else {
          setMessage({
            type: 'success',
            text: 'Account created successfully! If email verification is enabled on your project, please check your inbox to confirm.',
          });
        }
      }
    } catch (err) {
      console.error('Sign up error:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create account.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    enableDemoMode();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 via-white to-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-500 text-white shadow-lg shadow-teal-600/25">
            <Store className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Quonnect Vendor Portal
        </h2>
        <p className="mt-1 text-center text-xs sm:text-sm text-teal-700 font-medium">
          Financial Management, Online Stall & Marketplace
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl shadow-teal-900/5 rounded-3xl border border-teal-100">
          {/* Toggle between Login and Signup */}
          <div className="grid grid-cols-2 gap-2 p-1 mb-6 bg-slate-100/90 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setMessage(null);
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setMessage(null);
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                mode === 'signup'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Vendor Registration
            </button>
          </div>

          {message && (
            <div
              className={`mb-5 p-3.5 text-xs rounded-xl border flex items-start gap-2 ${
                message.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-teal-50 border-teal-200 text-teal-800'
              }`}
            >
              {message.type === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-teal-600" />
                    Business / Stall Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Kampala Fresh Organics"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-teal-600" />
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="Fresh Produce & Groceries">Fresh Produce & Groceries</option>
                      <option value="Fashion & Apparel">Fashion & Apparel</option>
                      <option value="Electronics & Hardware">Electronics & Hardware</option>
                      <option value="Food & Catering">Food & Catering</option>
                      <option value="General Retail">General Retail</option>
                      <option value="Crafts & Artisans">Crafts & Artisans</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-teal-600" />
                      Region / Market
                    </label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="e.g. Owino Market"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-teal-600" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+256 700 000 000"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@example.com"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-teal-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Vendor Portal' : 'Register Vendor Account'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Mode */}
          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 mb-3">
              Want to preview the dashboard instantly?
            </p>
            <button
              type="button"
              onClick={handleDemoMode}
              className="w-full py-2.5 px-4 rounded-xl border border-teal-200 bg-teal-50/70 text-teal-800 text-xs font-semibold hover:bg-teal-100 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>Continue in Quick Demo Mode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
