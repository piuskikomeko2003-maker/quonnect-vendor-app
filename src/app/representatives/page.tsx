'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { ShopMember } from '@/types/database.types';
import { formatUGX } from '@/lib/formatters';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { FeatureGate } from '@/components/layout/FeatureGate';
import {
  Users,
  Plus,
  Search,
  Shield,
  X,
  Lock,
  Eye,
  Check,
  Percent,
  Banknote,
  AlertCircle,
} from 'lucide-react';

export default function RepresentativesPage() {
  const { vendor, isDemo } = useAuth();
  const [members, setMembers] = useState<ShopMember[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'cashier' | 'manager' | 'custom'>('cashier');
  const [commissionType, setCommissionType] = useState<'percent' | 'flat'>('percent');
  const [commissionRate, setCommissionRate] = useState('2');

  // Permission toggles
  const [canSeeReport, setCanSeeReport] = useState(false);
  const [canSeeProfit, setCanSeeProfit] = useState(false);
  const [canSeeCost, setCanSeeCost] = useState(false);
  const [canEditPrice, setCanEditPrice] = useState(false);

  useEffect(() => {
    async function loadMembers() {
      if (!vendor) return;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('quonnect_demo_shop_members');
          if (saved) {
            try {
              setMembers(JSON.parse(saved) as ShopMember[]);
              return;
            } catch {}
          }
        }
        setMembers([]);
        return;
      }

      const { data } = await supabase
        .from('shop_members')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at');
      if (data) setMembers(data as ShopMember[]);
    }

    loadMembers();
  }, [vendor, isDemo]);

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !vendor) return;

    const newMember: ShopMember = {
      id: crypto.randomUUID(),
      vendor_id: vendor.id,
      user_id: null,
      username: username.trim(),
      email: email.trim() || null,
      role,
      permissions: {
        can_see_profit: role === 'manager' ? true : canSeeProfit,
        can_see_cost: role === 'manager' ? true : canSeeCost,
        can_see_report: role === 'manager' ? true : canSeeReport,
        can_edit_price: role === 'manager' ? true : canEditPrice,
      },
      commission_type: commissionType,
      commission_rate: parseFloat(commissionRate) || 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isDemo) {
      setMembers((prev) => [newMember, ...prev]);
      setIsAddOpen(false);
      setUsername('');
      setEmail('');
      return;
    }

    try {
      const { data } = await supabase
        .from('shop_members')
        .insert({
          id: newMember.id,
          vendor_id: newMember.vendor_id,
          username: newMember.username,
          email: newMember.email,
          role: newMember.role,
          permissions: newMember.permissions,
          commission_type: newMember.commission_type,
          commission_rate: newMember.commission_rate,
        })
        .select()
        .single();

      if (data) setMembers((prev) => [data as ShopMember, ...prev]);
      setIsAddOpen(false);
      setUsername('');
      setEmail('');
    } catch (err) {
      console.error('Error adding staff member:', err);
    }
  };

  return (
    <FeatureGate featureKey="representatives">
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
        <Navbar
          title="Staff & Representatives"
          onOpenAddModal={() => setIsAddOpen(true)}
          actionButtonLabel="Add Staff"
        />

        <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Staff Accounts ({members.length})
              </h2>
              <p className="text-[11px] text-slate-400">
                Profit and cost prices are strictly hidden from cashiers
              </p>
            </div>
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>New Staff Account</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {members.map((m) => {
              const perms = (m.permissions || {}) as any;

              return (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{m.username}</h3>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                          {m.role}
                        </span>
                      </div>
                      {m.email && <p className="text-xs text-slate-400 mt-0.5">{m.email}</p>}
                    </div>

                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {m.commission_rate}% commission
                    </span>
                  </div>

                  {/* Privacy Matrix Indicator */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex items-center gap-1 ${
                          perms.can_see_profit ? 'text-teal-700 font-bold' : 'text-slate-400'
                        }`}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        <span>Profit: {perms.can_see_profit ? 'Visible' : 'Hidden'}</span>
                      </span>

                      <span
                        className={`flex items-center gap-1 ${
                          perms.can_see_cost ? 'text-teal-700 font-bold' : 'text-slate-400'
                        }`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Cost: {perms.can_see_cost ? 'Visible' : 'Hidden'}</span>
                      </span>
                    </div>

                    <span className="text-emerald-700 font-semibold">Active</span>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        <BottomNav />

        {/* Add Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
            <div className="fixed inset-0" onClick={() => setIsAddOpen(false)} />
            <div className="relative bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md z-10 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900">Add Staff Account</h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMember} className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Staff Name / Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Moses Kato"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Staff Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="cashier">Cashier (Sales only, profit hidden)</option>
                    <option value="manager">Manager (Full store access)</option>
                    <option value="custom">Custom Permissions</option>
                  </select>
                </div>

                {role === 'custom' && (
                  <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={canSeeProfit}
                        onChange={(e) => setCanSeeProfit(e.target.checked)}
                      />
                      <span>Can see profit margins</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={canSeeCost}
                        onChange={(e) => setCanSeeCost(e.target.checked)}
                      />
                      <span>Can see buying/cost prices</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={canSeeReport}
                        onChange={(e) => setCanSeeReport(e.target.checked)}
                      />
                      <span>Can view reports</span>
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Commission Type
                    </label>
                    <select
                      value={commissionType}
                      onChange={(e) => setCommissionType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="percent">Percentage (%)</option>
                      <option value="flat">Flat amount (UGX)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Rate {commissionType === 'percent' ? '(%)' : '(UGX)'}
                    </label>
                    <input
                      type="number"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md"
                >
                  Create Staff Account
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
