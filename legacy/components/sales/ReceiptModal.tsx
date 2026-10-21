'use client';

import React, { useState } from 'react';
import { Sale, SaleItem } from '@/types/database.types';
import { formatUGX, formatDate } from '@/lib/formatters';
import {
  Printer,
  Share2,
  X,
  CheckCircle2,
  Building2,
  Calendar,
  User,
  Phone,
  MessageCircle,
} from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  items: SaleItem[];
  shopName: string;
  shopPhone?: string | null;
  shopLocation?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  items,
  shopName,
  shopPhone,
  shopLocation,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const lines = [
      `*RECEIPT — ${shopName.toUpperCase()}*`,
      `Order No: #${sale.order_no}`,
      `Date: ${formatDate(sale.sale_date)}`,
      `Customer: ${sale.customer_name || 'Walk-in'}`,
      `--------------------------`,
      ...items.map(
        (i) => `${i.product_name} x${i.quantity} = ${formatUGX(i.total)}`
      ),
      `--------------------------`,
      `*Total: ${formatUGX(sale.total)}*`,
      `Paid (${sale.payment_method}): ${formatUGX(sale.paid_amount)}`,
      sale.due_amount > 0 ? `*Balance Due: ${formatUGX(sale.due_amount)}*` : `Status: Fully Paid`,
      `\nThank you for supporting ${shopName}!`,
    ];

    const message = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 print:p-0 print:bg-white">
      <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 print:shadow-none print:border-none">
        {/* Header toolbar (Hidden in print) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 print:hidden">
          <span className="text-xs font-bold text-slate-700">Official Receipt</span>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Receipt Slip Body */}
        <div className="p-6 font-mono text-xs space-y-4 text-slate-800" id="receipt-print-area">
          <div className="text-center pb-3 border-b border-dashed border-slate-300">
            <h2 className="text-base font-black tracking-tight font-sans text-slate-900">
              {shopName}
            </h2>
            {shopLocation && <p className="text-[11px] text-slate-500 mt-0.5">{shopLocation}</p>}
            {shopPhone && <p className="text-[11px] text-slate-500">{shopPhone}</p>}
          </div>

          <div className="flex justify-between text-[11px] text-slate-600">
            <span>Order #{sale.order_no}</span>
            <span>{formatDate(sale.sale_date)}</span>
          </div>

          <div className="text-[11px] text-slate-600">
            <span>Customer: {sale.customer_name || 'Walk-in'}</span>
          </div>

          {/* Line items table */}
          <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <div className="max-w-[70%]">
                  <p className="font-bold text-slate-900 truncate">{item.product_name}</p>
                  <p className="text-[10px] text-slate-500">
                    {item.quantity} x {formatUGX(item.unit_price)}
                  </p>
                </div>
                <span className="font-bold text-slate-900">{formatUGX(item.total)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 pt-1 text-[11px]">
            <div className="flex justify-between font-bold text-slate-900 text-xs">
              <span>Total Amount:</span>
              <span>{formatUGX(sale.total)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Paid ({sale.payment_method}):</span>
              <span>{formatUGX(sale.paid_amount)}</span>
            </div>
            {sale.due_amount > 0 && (
              <div className="flex justify-between font-bold text-rose-600">
                <span>Balance Due:</span>
                <span>{formatUGX(sale.due_amount)}</span>
              </div>
            )}
          </div>

          <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
            <p>Thank you for your business!</p>
            <p className="mt-0.5">Powered by Quonnect Vendor</p>
          </div>
        </div>

        {/* Action Buttons (Hidden in print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 print:hidden">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Share WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
};
