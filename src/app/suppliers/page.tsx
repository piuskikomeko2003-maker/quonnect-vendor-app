'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Supplier } from '@/types/database.types';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { FeatureGate } from '@/components/layout/FeatureGate';
import {
  Truck,
  Plus,
  Search,
  Phone,
  MessageCircle,
  X,
  Building,
  User,
  MapPin,
  Mail,
} from 'lucide-react';

export default function SuppliersPage() {
  const { vendor, isDemo } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSuppliers() {
      if (!vendor) return;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('quonnect_demo_suppliers');
          if (saved) {
            try {
              setSuppliers(JSON.parse(saved) as Supplier[]);
              return;
            } catch {}
          }
        }
        setSuppliers([]);
        return;
      }

      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('vendor_id', vendor.id)
        .is('deleted_at', null)
        .order('name');
      if (data) setSuppliers(data as Supplier[]);
    }

    loadSuppliers();
  }, [vendor, isDemo]);

  const filtered = suppliers.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !vendor) return;
    setSaving(true);

    const newSup: Supplier = {
      id: crypto.randomUUID(),
      vendor_id: vendor.id,
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    if (isDemo) {
      setSuppliers((prev) => [newSup, ...prev]);
      setIsAddOpen(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setSaving(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('suppliers')
        .insert({
          id: newSup.id,
          vendor_id: newSup.vendor_id,
          name: newSup.name,
          contact_person: newSup.contact_person,
          phone: newSup.phone,
          email: newSup.email,
          address: newSup.address,
        })
        .select()
        .single();

      if (data) setSuppliers((prev) => [data as Supplier, ...prev]);
      setIsAddOpen(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
    } catch (err) {
      console.error('Error saving supplier:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeatureGate featureKey="suppliers">
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
        <Navbar
          title="Suppliers Directory"
          onOpenAddModal={() => setIsAddOpen(true)}
          actionButtonLabel="Add Supplier"
        />

        <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Registered Suppliers ({suppliers.length})
            </h2>
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1 text-xs font-bold text-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>New Supplier</span>
            </button>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by supplier name, contact, phone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="space-y-2.5">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
              >
                <div className="space-y-0.5 max-w-[70%]">
                  <h3 className="text-sm font-bold text-slate-900">{s.name}</h3>
                  {s.contact_person && (
                    <p className="text-xs text-slate-600">Contact: {s.contact_person}</p>
                  )}
                  {s.address && <p className="text-[11px] text-slate-400">{s.address}</p>}
                </div>

                {s.phone && (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://wa.me/${s.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                    <a
                      href={`tel:${s.phone}`}
                      className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">
                <Truck className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-1" />
                <p>No suppliers recorded.</p>
              </div>
            )}
          </div>
        </main>

        <BottomNav />

        {/* Add Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
            <div className="fixed inset-0" onClick={() => setIsAddOpen(false)} />
            <div className="relative bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md z-10 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900">Add Supplier</h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveSupplier} className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company / Supplier Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kalerwe Produce Ltd"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Mzee Juma"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+256 701 112 233"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Warehouse Location / Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Kalerwe Market Wholesale Lane"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md"
                >
                  {saving ? 'Saving...' : 'Save Supplier'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
