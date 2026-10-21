'use client';

import React, { useState } from 'react';
import { Booking } from '@/types/database.types';
import { formatUGX, formatDate } from '@/lib/formatters';
import { 
  Phone, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Trash2, 
  ArrowUpRight,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface BookingCardProps {
  booking: Booking;
  isDemo: boolean;
  onStatusChange: (id: string, newStatus: Booking['status']) => void;
  onDelete: (id: string) => void;
  onRecordIncome?: (booking: Booking) => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  isDemo,
  onStatusChange,
  onDelete,
  onRecordIncome,
}) => {
  const [loading, setLoading] = useState(false);

  // Clean phone number for WhatsApp link
  const cleanPhone = booking.customer_phone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(booking.customer_name)}%2C%20regarding%20your%20order%20for%20${encodeURIComponent(booking.service_or_product)}%20at%20our%20stall...`;

  const handleUpdateStatus = async (newStatus: Booking['status']) => {
    setLoading(true);
    try {
      if (!isDemo) {
        const { error } = await supabase
          .from('bookings')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', booking.id);

        if (error) throw error;
      }
      onStatusChange(booking.id, newStatus);
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAndRecord = async () => {
    setLoading(true);
    try {
      if (!isDemo) {
        // 1. Update booking to completed
        const { error: bookingError } = await supabase
          .from('bookings')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', booking.id);

        if (bookingError) throw bookingError;

        // 2. Automatically record income entry in finance_entries
        await supabase.from('finance_entries').insert({
          vendor_id: booking.vendor_id,
          type: 'income',
          category: 'Marketplace Order',
          amount: booking.total_price,
          source: 'auto_order',
          entry_date: new Date().toISOString().split('T')[0],
          notes: `Auto-recorded from booking: ${booking.service_or_product} (${booking.customer_name})`,
        });
      }

      onStatusChange(booking.id, 'completed');
      if (onRecordIncome) onRecordIncome(booking);
    } catch (err: any) {
      alert('Error finalizing booking: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (booking.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed & Paid</span>
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="h-3 w-3" />
            <span>Confirmed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="h-3 w-3" />
            <span>Cancelled</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            <AlertCircle className="h-3 w-3" />
            <span>Pending Action</span>
          </span>
        );
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-base text-slate-900">
                {booking.customer_name}
              </h4>
            </div>
            {/* Phone & Contacts */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <a
                href={`tel:${booking.customer_phone}`}
                className="text-xs font-semibold text-teal-700 hover:underline flex items-center gap-1"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{booking.customer_phone}</span>
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                title="Chat with customer on WhatsApp"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          <div>{getStatusBadge()}</div>
        </div>

        {/* Order Items & Price */}
        <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                {booking.service_or_product}
              </span>
              <span className="text-[11px] text-slate-500">
                Quantity: <b className="text-slate-700">{booking.quantity} unit(s)</b>
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm sm:text-base font-extrabold text-teal-700 block">
                {formatUGX(booking.total_price)}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">Total UGX</span>
            </div>
          </div>

          {booking.notes && (
            <p className="mt-2 pt-2 border-t border-slate-200/60 text-xs text-slate-500 italic">
              &ldquo;{booking.notes}&rdquo;
            </p>
          )}
        </div>

        {/* Schedule & Location */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-teal-600 shrink-0" />
            <span className="truncate">{formatDate(booking.booking_date)} {booking.booking_time ? `• ${booking.booking_time}` : ''}</span>
          </div>

          {booking.delivery_location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
              <span className="truncate">{booking.delivery_location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {booking.status === 'pending' && (
            <button
              onClick={() => handleUpdateStatus('confirmed')}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Confirm Order</span>
            </button>
          )}

          {booking.status === 'confirmed' && (
            <button
              onClick={handleCompleteAndRecord}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
              title="Mark as completed and auto-record income into financial ledger"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Complete & Record Income</span>
            </button>
          )}

          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <button
              onClick={() => handleUpdateStatus('cancelled')}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(booking.id)}
          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-auto"
          title="Delete booking"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
