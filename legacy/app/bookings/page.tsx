'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Booking, Product } from '@/types/database.types';
import { Navbar } from '@/components/layout/Navbar';
import { BookingCard } from '@/components/bookings/BookingCard';
import { NewBookingModal } from '@/components/bookings/NewBookingModal';
import { formatUGX } from '@/lib/formatters';
import { 
  Building2, 
  MapPin, 
  Tag, 
  Plus, 
  Search, 
  CalendarCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  ShoppingBag
} from 'lucide-react';

export default function BookingsPage() {
  const router = useRouter();
  const { vendor, loading: authLoading, isDemo } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch bookings and stall products
  const fetchData = useCallback(async () => {
    if (!vendor) return;

    if (isDemo) {
      const savedBookings = typeof window !== 'undefined' ? localStorage.getItem('quonnect_demo_bookings') : null;
      if (savedBookings) {
        try {
          setBookings(JSON.parse(savedBookings));
        } catch {
          setBookings([]);
        }
      } else {
        setBookings([]);
      }

      const savedProducts = typeof window !== 'undefined' ? localStorage.getItem('quonnect_demo_products') : null;
      if (savedProducts) {
        try {
          setProducts(JSON.parse(savedProducts));
        } catch {
          setProducts([]);
        }
      }
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('booking_date', { ascending: false });

      if (bookingsError) console.error('Error fetching bookings:', bookingsError);
      if (bookingsData) setBookings(bookingsData as Booking[]);

      // 2. Fetch products for product dropdown
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('is_active', true);

      if (prodData) setProducts(prodData as Product[]);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [vendor, isDemo]);

  useEffect(() => {
    if (!authLoading && !vendor && !isDemo) {
      router.push('/login');
    } else if (vendor) {
      fetchData();
    }
  }, [vendor, authLoading, isDemo, router, fetchData]);

  const persistDemoBookings = (updated: Booking[]) => {
    if (isDemo && typeof window !== 'undefined') {
      localStorage.setItem('quonnect_demo_bookings', JSON.stringify(updated));
    }
  };

  const handleBookingCreated = (newBooking: Booking) => {
    setBookings((prev) => {
      const updated = [newBooking, ...prev];
      persistDemoBookings(updated);
      return updated;
    });
  };

  const handleStatusChange = (id: string, newStatus: Booking['status']) => {
    setBookings((prev) => {
      const updated = prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b));
      persistDemoBookings(updated);
      return updated;
    });
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Are you sure you want to remove this booking?')) return;

    try {
      if (isDemo) {
        setBookings((prev) => {
          const updated = prev.filter((b) => b.id !== id);
          persistDemoBookings(updated);
          return updated;
        });
      } else {
        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) throw error;
        setBookings((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (err: any) {
      alert('Failed to delete booking: ' + err.message);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const completed = bookings.filter((b) => b.status === 'completed');
    const completedRevenue = completed.reduce((sum, b) => sum + Number(b.total_price), 0);

    return { total, pending, confirmed, completedCount: completed.length, completedRevenue };
  }, [bookings]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (filterTab !== 'all' && b.status !== filterTab) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = b.customer_name.toLowerCase().includes(q);
        const matchesPhone = b.customer_phone.toLowerCase().includes(q);
        const matchesService = b.service_or_product.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesService) return false;
      }

      return true;
    });
  }, [bookings, filterTab, searchTerm]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Customer Bookings...
          </p>
        </div>
      </div>
    );
  }

  if (!vendor && !isDemo) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-28">
      <Navbar
        onOpenAddModal={() => setIsModalOpen(true)}
        actionButtonLabel="New Booking"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Banner with Background Image & Dark Gradient Overlay */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 shadow-md p-6 sm:p-8 min-h-[190px] flex items-center">
          {/* Background Image */}
          <img
            src="/images/Customer%20Bookings%20%26%20Pre-orders.png"
            alt="Customer Bookings & Pre-orders Banner"
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          />

          {/* Dark Gradient Overlay for Contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-900/65 pointer-events-none" />

          <div className="relative z-10 w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-200 border border-teal-400/30 backdrop-blur-md">
                  <Building2 className="h-3.5 w-3.5 text-teal-400" />
                  {vendor?.business_name || 'Vendor Stall'}
                </span>
                {vendor?.category && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-md border border-white/10">
                    <Tag className="h-3 w-3 text-slate-300" />
                    {vendor.category}
                  </span>
                )}
                {vendor?.region && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-md border border-white/10">
                    <MapPin className="h-3 w-3 text-slate-300" />
                    {vendor.region}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                Customer Bookings & Pre-orders
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 max-w-xl leading-relaxed drop-shadow-xs">
                Manage appointment slots, customer collections, and bulk pre-orders. Completing an order automatically registers revenue in your financial ledger.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold rounded-2xl bg-teal-500 hover:bg-teal-400 text-white shadow-md shadow-teal-950/40 hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap border border-teal-400/30"
              >
                <Plus className="h-4 w-4" />
                <span>+ New Booking</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Total Orders</span>
              <CalendarCheck className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {metrics.total}
            </div>
            <span className="text-[11px] text-slate-400">customer requests</span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-amber-200/80 shadow-xs">
            <div className="flex items-center justify-between text-amber-600 text-xs font-bold uppercase tracking-wider">
              <span>Action Required</span>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-600">
              {metrics.pending}
            </div>
            <span className="text-[11px] text-slate-400">pending confirmation</span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-blue-200/80 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 text-xs font-bold uppercase tracking-wider">
              <span>Scheduled</span>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-blue-600">
              {metrics.confirmed}
            </div>
            <span className="text-[11px] text-slate-400">confirmed orders</span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-teal-200/80 shadow-xs">
            <div className="flex items-center justify-between text-teal-700 text-xs font-bold uppercase tracking-wider">
              <span>Completed Value</span>
              <TrendingUp className="h-4 w-4 text-teal-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-teal-700">
              {formatUGX(metrics.completedRevenue)}
            </div>
            <span className="text-[11px] text-slate-400">{metrics.completedCount} fulfilled orders</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({metrics.total})
            </button>
            <button
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Pending ({metrics.pending})
            </button>
            <button
              onClick={() => setFilterTab('confirmed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'confirmed'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              Confirmed ({metrics.confirmed})
            </button>
            <button
              onClick={() => setFilterTab('completed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'completed'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-teal-700'
              }`}
            >
              Completed ({metrics.completedCount})
            </button>
          </div>

          {/* Search */}
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer, phone, item..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Bookings Grid */}
        {filteredBookings.length === 0 ? (
          <div className="py-20 px-6 text-center rounded-3xl border border-dashed border-slate-300 bg-white">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No bookings found
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || filterTab !== 'all'
                ? 'Try adjusting your search or tab filters.'
                : 'Take your first customer pre-order or stall appointment.'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Record New Booking</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isDemo={isDemo}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteBooking}
              />
            ))}
          </div>
        )}
      </main>

      {/* New Booking Modal */}
      {vendor && (
        <NewBookingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          vendorId={vendor.id}
          isDemo={isDemo}
          products={products}
          onBookingCreated={handleBookingCreated}
        />
      )}
    </div>
  );
}
