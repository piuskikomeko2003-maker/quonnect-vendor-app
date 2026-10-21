'use client';

import React, { useState } from 'react';
import { X, Check, Calendar, Clock, MapPin, User, Phone, Tag, AlertCircle, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Booking, Product } from '@/types/database.types';
import { formatUGX } from '@/lib/formatters';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  isDemo: boolean;
  products: Product[];
  onBookingCreated: (booking: Booking) => void;
}

export const NewBookingModal: React.FC<NewBookingModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  isDemo,
  products,
  onBookingCreated,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+256 ');
  const [customerEmail, setCustomerEmail] = useState('');
  
  // Product or custom order
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [totalPrice, setTotalPrice] = useState('');
  
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('10:00 AM');
  const [deliveryLocation, setDeliveryLocation] = useState('Market Stall Pickup');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    if (prodId === 'custom') {
      setCustomServiceName('');
      setTotalPrice('');
    } else {
      const prod = products.find((p) => p.id === prodId);
      if (prod) {
        setCustomServiceName(prod.name);
        const qty = parseInt(quantity, 10) || 1;
        setTotalPrice(String(prod.price * qty));
      }
    }
  };

  const handleQuantityChange = (newQtyStr: string) => {
    setQuantity(newQtyStr);
    const qty = parseInt(newQtyStr, 10) || 1;
    if (selectedProductId && selectedProductId !== 'custom') {
      const prod = products.find((p) => p.id === selectedProductId);
      if (prod) {
        setTotalPrice(String(prod.price * qty));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Please provide the customer name.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim() === '+256') {
      setError('Please provide a valid phone number.');
      return;
    }

    const serviceName = selectedProductId && selectedProductId !== 'custom'
      ? products.find((p) => p.id === selectedProductId)?.name || customServiceName
      : customServiceName.trim();

    if (!serviceName) {
      setError('Please specify the product or service being booked.');
      return;
    }

    const numericPrice = parseFloat(totalPrice);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setError('Please enter a valid price in UGX.');
      return;
    }

    const numericQty = parseInt(quantity, 10) || 1;

    setLoading(true);

    try {
      const bookingId = isDemo ? `demo-book-${Date.now()}` : crypto.randomUUID();

      if (isDemo) {
        const demoBooking: Booking = {
          id: bookingId,
          vendor_id: vendorId,
          product_id: selectedProductId && selectedProductId !== 'custom' ? selectedProductId : null,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim() || null,
          service_or_product: serviceName,
          quantity: numericQty,
          total_price: numericPrice,
          status: 'pending',
          booking_date: bookingDate,
          booking_time: bookingTime.trim() || null,
          delivery_location: deliveryLocation.trim() || null,
          notes: notes.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        onBookingCreated(demoBooking);
        onClose();
        resetForm();
      } else {
        const { data, error: insertError } = await supabase
          .from('bookings')
          .insert({
            id: bookingId,
            vendor_id: vendorId,
            product_id: selectedProductId && selectedProductId !== 'custom' ? selectedProductId : null,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            customer_email: customerEmail.trim() || null,
            service_or_product: serviceName,
            quantity: numericQty,
            total_price: numericPrice,
            status: 'pending',
            booking_date: bookingDate,
            booking_time: bookingTime.trim() || null,
            delivery_location: deliveryLocation.trim() || null,
            notes: notes.trim() || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (data) {
          onBookingCreated(data as Booking);
          onClose();
          resetForm();
        }
      }
    } catch (err: any) {
      console.error('Error saving booking:', err);
      setError(err.message || 'Failed to save booking.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('+256 ');
    setCustomerEmail('');
    setSelectedProductId('');
    setCustomServiceName('');
    setQuantity('1');
    setTotalPrice('');
    setNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              New Customer Booking / Order
            </h2>
            <p className="text-xs text-slate-500">
              Record a scheduled appointment, pre-order, or pickup
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 rounded-xl border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-teal-600" />
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Grace Namubiru"
                className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-teal-600" />
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+256 701 234 567"
                className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Select From Stall Products or Custom Service */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5 text-teal-600" />
              Item / Service
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none mb-2"
            >
              <option value="">-- Choose from Stall Catalog --</option>
              {products.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.name} ({formatUGX(prod.price)})
                </option>
              ))}
              <option value="custom">-- Custom Product or Consultation Service --</option>
            </select>

            {(!selectedProductId || selectedProductId === 'custom') && (
              <input
                type="text"
                required
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                placeholder="e.g. Special Bulk Produce Hamper"
                className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            )}
          </div>

          {/* Quantity & Total Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Total Price (UGX) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="25000"
                className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>
          {totalPrice && parseFloat(totalPrice) >= 0 && (
            <p className="text-xs font-bold text-teal-700">
              Total Amount: {formatUGX(totalPrice)}
            </p>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-teal-600" />
                Scheduled Date
              </label>
              <input
                type="date"
                required
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-teal-600" />
                Time / Slot
              </label>
              <input
                type="text"
                value={bookingTime}
                onChange={(e) => setBookingTime(e.target.value)}
                placeholder="10:00 AM or Morning"
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Delivery / Pickup Location */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-teal-600" />
              Pickup / Delivery Location
            </label>
            <input
              type="text"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              placeholder="e.g. Market Stall 14B or Boda to Kololo"
              className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Notes / Instructions (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer will pay cash upon arrival."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Create Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
