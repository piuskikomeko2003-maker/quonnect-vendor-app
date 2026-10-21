'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { DamagedItem, Product } from '@/types/database.types';
import { formatUGX, formatDate } from '@/lib/formatters';
import { Navbar } from '@/components/layout/Navbar';
import { FeatureGate } from '@/components/layout/FeatureGate';
import {
  AlertOctagon,
  Plus,
  Search,
  Calendar,
  X,
  Check,
  Package,
  AlertTriangle,
  Info,
} from 'lucide-react';

const LOSS_REASONS = [
  'Damaged / Broken',
  'Expired / Spoiled',
  'Lost / Missing',
  'Stolen',
  'Sample / Giveaway',
];

export default function DamagedItemsPage() {
  const { vendor, isDemo } = useAuth();
  const [items, setItems] = useState<DamagedItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState(LOSS_REASONS[0]);
  const [lossDate, setLossDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load damaged items & products
  useEffect(() => {
    async function loadData() {
      if (!vendor) return;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('quonnect_demo_damaged_items');
          if (saved) {
            try {
              setItems(JSON.parse(saved) as DamagedItem[]);
              return;
            } catch {}
          }
        }
        setItems([]);
        return;
      }

      const { data: lossData } = await supabase
        .from('damaged_items')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('loss_date', { ascending: false });
      if (lossData) setItems(lossData as DamagedItem[]);

      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('is_service', false);
      if (prodData) setProducts(prodData as Product[]);
    }

    loadData();
  }, [vendor, isDemo]);

  const totalLossValue = items.reduce((sum, i) => sum + (i.estimated_loss || 0), 0);

  const handleSaveLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !vendor) return;

    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const numQty = parseFloat(quantity) || 1;
    const estLoss = (prod.cost || prod.price || 0) * numQty;

    setSaving(true);

    const newLoss: DamagedItem = {
      id: crypto.randomUUID(),
      vendor_id: vendor.id,
      product_id: prod.id,
      product_name: prod.name,
      quantity: numQty,
      estimated_loss: estLoss,
      reason,
      loss_date: lossDate,
      notes: notes.trim() || null,
      created_at: new Date().toISOString(),
    };

    if (isDemo) {
      setItems((prev) => [newLoss, ...prev]);
      setIsAddOpen(false);
      setSaving(false);
      return;
    }

    try {
      await supabase.from('damaged_items').insert({
        id: newLoss.id,
        vendor_id: newLoss.vendor_id,
        product_id: newLoss.product_id,
        product_name: newLoss.product_name,
        quantity: newLoss.quantity,
        estimated_loss: newLoss.estimated_loss,
        reason: newLoss.reason,
        loss_date: newLoss.loss_date,
        notes: newLoss.notes,
      });

      // Deduct stock on the product
      if (prod.stock !== null) {
        const newStock = Math.max(0, prod.stock - numQty);
        await supabase.from('products').update({ stock: newStock }).eq('id', prod.id);
      }

      setItems((prev) => [newLoss, ...prev]);
      setIsAddOpen(false);
    } catch (err) {
      console.error('Error logging damaged items:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeatureGate featureKey="damaged_items">
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
        <Navbar
          title="Damaged & Lost Items"
          onOpenAddModal={() => setIsAddOpen(true)}
          actionButtonLabel="Record Loss"
        />

        <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          {/* Explanation Alert */}
          <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-xs flex items-start gap-3 text-xs text-slate-600">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700 shrink-0">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900">What is this log for?</p>
              <p className="mt-0.5">
                Record inventory lost <strong>without being sold</strong> (e.g. spoilage, breakages, lost in transit). This adjusts your stock without skewing your sales reports.
              </p>
            </div>
          </div>

          {/* KPI Header */}
          <div className="rounded-3xl p-5 bg-gradient-to-r from-orange-800 to-amber-700 text-white shadow-md flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-amber-100 uppercase tracking-wider">
                Total Recorded Loss
              </span>
              <p className="text-2xl font-black mt-0.5">{formatUGX(totalLossValue)}</p>
              <p className="text-xs text-amber-200 mt-1">{items.length} loss entries recorded</p>
            </div>

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white text-orange-900 font-extrabold text-xs shadow-sm hover:bg-amber-50 transition-colors"
            >
              <Plus className="h-4 w-4 text-orange-600" />
              <span>Record Loss</span>
            </button>
          </div>

          {/* List of Losses */}
          <div className="space-y-2.5">
            {items.map((i) => (
              <div
                key={i.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
              >
                <div className="space-y-0.5 max-w-[65%]">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{i.product_name}</h4>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-bold text-orange-700">{i.reason}</span>
                    <span className="text-slate-400">• Qty: {i.quantity}</span>
                  </div>
                  {i.notes && <p className="text-[10px] text-slate-400 italic">{i.notes}</p>}
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-rose-600">
                    -{formatUGX(i.estimated_loss)}
                  </span>
                  <span className="block text-[10px] text-slate-400">{formatDate(i.loss_date)}</span>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                <AlertOctagon className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-1" />
                <p>No inventory losses recorded.</p>
              </div>
            )}
          </div>
        </main>

        {/* Add Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
            <div className="fixed inset-0" onClick={() => setIsAddOpen(false)} />
            <div className="relative bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md z-10 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900">Record Stock Loss</h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveLoss} className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Product <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="">Choose item...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.stock || 0} left in stock)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quantity Lost <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white"
                    >
                      {LOSS_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 3 basins spoiled after sudden rain..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm shadow-md"
                >
                  {saving ? 'Recording...' : 'Record Loss & Deduct Stock'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
