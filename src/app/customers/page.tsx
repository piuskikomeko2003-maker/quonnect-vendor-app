'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Customer, Sale } from '@/types/database.types';
import { formatUGX, formatDate } from '@/lib/formatters';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import Link from 'next/link';
import {
  Search,
  Plus,
  Users,
  Phone,
  MessageCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowRight,
  Printer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { vendor, isDemo } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(false);

  // Modal states
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedStatementCustomer, setSelectedStatementCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<Sale[]>([]);

  // Add customer form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsAddCustomerOpen(true);
    }
  }, [searchParams]);

  // Load customers
  useEffect(() => {
    async function loadCustomers() {
      if (!vendor) return;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const demoCusts = localStorage.getItem('quonnect_demo_customers');
          if (demoCusts) {
            try {
              setCustomers(JSON.parse(demoCusts));
              return;
            } catch {}
          }
        }
        setCustomers([]);
        return;
      }

      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('vendor_id', vendor.id)
        .is('deleted_at', null)
        .order('name');

      if (data) setCustomers(data as Customer[]);
    }

    loadCustomers();
  }, [vendor, isDemo]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterDueOnly && c.due_amount <= 0) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [customers, filterDueOnly, searchTerm]);

  // Metrics
  const totalCustomersCount = customers.length;
  const totalDueAmount = customers.reduce((sum, c) => sum + (c.due_amount || 0), 0);

  // Add customer handler
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !vendor) return;
    setSaving(true);

    const newCust: Customer = {
      id: crypto.randomUUID(),
      vendor_id: vendor.id,
      name: name.trim(),
      phone: phone.trim() || null,
      email: null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      total_orders: 0,
      total_spent: 0,
      due_amount: 0,
      is_sample: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    if (isDemo) {
      setCustomers((prev) => [newCust, ...prev]);
      setIsAddCustomerOpen(false);
      setName('');
      setPhone('');
      setAddress('');
      setNotes('');
      setSaving(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          id: newCust.id,
          vendor_id: newCust.vendor_id,
          name: newCust.name,
          phone: newCust.phone,
          address: newCust.address,
          notes: newCust.notes,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setCustomers((prev) => [data as Customer, ...prev]);

      setIsAddCustomerOpen(false);
      setName('');
      setPhone('');
      setAddress('');
      setNotes('');
    } catch (err) {
      console.error('Error creating customer:', err);
      alert('Failed to save customer.');
    } finally {
      setSaving(false);
    }
  };

  // Open statement modal
  const handleOpenStatement = async (cust: Customer) => {
    setSelectedStatementCustomer(cust);

    if (isDemo) {
      setCustomerSales([
        {
          id: 'demo-sale-1',
          vendor_id: 'demo-vendor-0001',
          order_no: 'POS-1042',
          customer_id: cust.id,
          customer_name: cust.name,
          subtotal: 55000,
          discount: 0,
          tax: 0,
          shipping: 0,
          total: 55000,
          paid_amount: cust.due_amount > 0 ? 20000 : 55000,
          due_amount: cust.due_amount,
          profit: 18000,
          status: cust.due_amount > 0 ? 'partial' : 'completed',
          payment_method: 'Mobile money',
          sold_by: 'Owner',
          notes: null,
          sale_date: new Date().toISOString().split('T')[0],
          is_sample: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ]);
      return;
    }

    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('customer_id', cust.id)
      .order('sale_date', { ascending: false });

    if (data) setCustomerSales(data as Sale[]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Navbar */}
      <Navbar
        title="Customer Directory"
        onOpenAddModal={() => setIsAddCustomerOpen(true)}
        actionButtonLabel="Add Customer"
      />

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Customer Due Summary Sheet Header */}
        <div className="rounded-3xl p-5 bg-gradient-to-r from-teal-800 to-teal-600 text-white shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-teal-100 uppercase tracking-wider">
              Customer Balances
            </span>
            <p className="text-2xl font-black mt-0.5">{formatUGX(totalDueAmount)}</p>
            <p className="text-xs text-teal-200 mt-1">
              {totalCustomersCount} active registered customers
            </p>
          </div>

          <button
            onClick={() => setFilterDueOnly(!filterDueOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              filterDueOnly
                ? 'bg-white text-teal-900 shadow-sm'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {filterDueOnly ? 'Show All' : 'Filter Due Only'}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customers by name, phone or address..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Customer Cards List */}
        <div className="space-y-2.5">
          {filteredCustomers.map((cust) => {
            const hasDue = cust.due_amount > 0;

            return (
              <div
                key={cust.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-teal-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {cust.name}
                      </h3>
                      {cust.is_sample && (
                        <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          SAMPLE
                        </span>
                      )}
                    </div>
                    {cust.phone && (
                      <p className="text-xs font-semibold text-slate-500">{cust.phone}</p>
                    )}
                    {cust.address && (
                      <p className="text-[11px] text-slate-400">{cust.address}</p>
                    )}
                  </div>

                  {/* No Due / Due Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      hasDue
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {hasDue ? `Due: ${formatUGX(cust.due_amount)}` : 'No Due (Cleared)'}
                  </span>
                </div>

                {/* Actions row: Statement, All Orders, WhatsApp, Call */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenStatement(cust)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 font-bold border border-teal-200 transition-colors min-h-[36px]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Statement</span>
                    </button>

                    <button
                      onClick={() => router.push(`/sales?customer=${cust.id}`)}
                      className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                    >
                      Orders ({cust.total_orders})
                    </button>
                  </div>

                  {cust.phone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <a
                        href={`tel:${cust.phone}`}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        title="Call Customer"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredCustomers.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500">
              <Users className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-1" />
              <p>No customers found.</p>
              <button
                onClick={() => setIsAddCustomerOpen(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-teal-600 text-white font-bold"
              >
                Add First Customer
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 4-Item Bottom Nav */}
      <BottomNav />

      {/* ================= ADD CUSTOMER MODAL ================= */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsAddCustomerOpen(false)} />

          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md z-10 overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Add New Customer</h3>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Namagembe"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+256 701 234 567"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Market Location / Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Nakasero, Bugolobi, Kampala"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prefers weekly payment on Friday..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 outline-none resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md shadow-teal-600/20 active:scale-98 transition-all min-h-[44px]"
                >
                  {saving ? 'Saving Customer...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CUSTOMER STATEMENT MODAL ================= */}
      {selectedStatementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 print:p-0 print:bg-white">
          <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 print:border-none print:shadow-none">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 print:hidden">
              <span className="text-xs font-bold text-slate-700">Account Statement</span>
              <button
                onClick={() => setSelectedStatementCustomer(null)}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Statement Printable Area */}
            <div className="p-6 font-mono text-xs space-y-4 text-slate-800">
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h2 className="text-base font-black font-sans text-slate-900">
                  {vendor?.business_name || 'Market Shop'}
                </h2>
                <p className="text-[11px] text-slate-500">Customer Account Statement</p>
                <p className="text-[11px] text-slate-500">Date: {new Date().toLocaleDateString('en-GB')}</p>
              </div>

              {/* Customer Profile Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-[11px]">
                <p className="font-bold text-slate-900">Client: {selectedStatementCustomer.name}</p>
                {selectedStatementCustomer.phone && <p className="text-slate-600">Phone: {selectedStatementCustomer.phone}</p>}
                {selectedStatementCustomer.address && <p className="text-slate-600">Address: {selectedStatementCustomer.address}</p>}
              </div>

              {/* Due Summary Alert */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900">
                <span className="font-bold">Total Balance Outstanding:</span>
                <span className="text-sm font-black">{formatUGX(selectedStatementCustomer.due_amount)}</span>
              </div>

              {/* Transactions Timeline */}
              <div className="space-y-2">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Recent Transaction Orders:
                </p>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {customerSales.map((s) => (
                    <div key={s.id} className="py-2 flex justify-between items-center text-[11px]">
                      <div>
                        <span className="font-bold text-slate-900">#{s.order_no}</span>
                        <span className="text-slate-400 ml-1.5">{formatDate(s.sale_date)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-900">{formatUGX(s.total)}</span>
                        {s.due_amount > 0 && (
                          <span className="text-rose-600 font-bold block text-[10px]">
                            Due: {formatUGX(s.due_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {customerSales.length === 0 && (
                    <p className="py-3 text-center text-slate-400 text-[11px]">
                      No previous orders recorded for this customer.
                    </p>
                  )}
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
                <p>Thank you for your trusted partnership!</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Print / Save PDF</span>
              </button>

              {selectedStatementCustomer.phone && (
                <a
                  href={`https://wa.me/${selectedStatementCustomer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello ${selectedStatementCustomer.name}, this is your statement from ${vendor?.business_name || 'our shop'}. Your current balance is ${formatUGX(selectedStatementCustomer.due_amount)}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
