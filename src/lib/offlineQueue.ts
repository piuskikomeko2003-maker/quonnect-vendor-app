'use client';

import { supabase } from '@/lib/supabaseClient';
import { Sale, SaleItem } from '@/types/database.types';

export interface OfflineSaleQueueItem {
  id: string;
  sale: Sale;
  items: SaleItem[];
  queuedAt: string;
}

const QUEUE_STORAGE_KEY = 'quonnect_offline_sales_queue';

/**
 * Returns all currently queued offline sales.
 */
export function getOfflineSalesQueue(): OfflineSaleQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Adds a completed sale to the offline queue when internet connection drops.
 */
export function enqueueOfflineSale(sale: Sale, items: SaleItem[]) {
  if (typeof window === 'undefined') return;
  const current = getOfflineSalesQueue();
  const item: OfflineSaleQueueItem = {
    id: sale.id,
    sale,
    items,
    queuedAt: new Date().toISOString(),
  };
  current.push(item);
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(current));
}

/**
 * Attempts to synchronize all queued offline sales to Supabase once connectivity returns.
 */
export async function syncOfflineSalesQueue(): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  if (typeof window === 'undefined') return { syncedCount: 0, failedCount: 0 };
  const queue = getOfflineSalesQueue();
  if (queue.length === 0) return { syncedCount: 0, failedCount: 0 };

  const remaining: OfflineSaleQueueItem[] = [];
  let syncedCount = 0;

  for (const item of queue) {
    try {
      // 1. Insert sale record
      const { error: saleErr } = await supabase.from('sales').insert({
        id: item.sale.id,
        vendor_id: item.sale.vendor_id,
        order_no: item.sale.order_no,
        customer_id: item.sale.customer_id,
        customer_name: item.sale.customer_name,
        subtotal: item.sale.subtotal,
        discount: item.sale.discount,
        tax: item.sale.tax,
        total: item.sale.total,
        paid_amount: item.sale.paid_amount,
        due_amount: item.sale.due_amount,
        profit: item.sale.profit,
        status: item.sale.status,
        payment_method: item.sale.payment_method,
        sold_by: item.sale.sold_by,
        notes: item.sale.notes,
        sale_date: item.sale.sale_date,
      });

      if (saleErr) throw saleErr;

      // 2. Insert sale line items
      if (item.items.length > 0) {
        await supabase.from('sale_items').insert(
          item.items.map((i) => ({
            sale_id: i.sale_id,
            vendor_id: i.vendor_id,
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            unit_cost: i.unit_cost,
            total: i.total,
            profit: i.profit,
          }))
        );
      }

      // 3. Insert cashflow entry
      await supabase.from('finance_entries').insert({
        vendor_id: item.sale.vendor_id,
        type: 'income',
        category: 'POS Stall Sale',
        amount: item.sale.paid_amount,
        source: 'manual',
        entry_date: item.sale.sale_date,
        notes: `Order #${item.sale.order_no} (Synced from offline)`,
      });

      syncedCount++;
    } catch (err) {
      console.warn(`Failed to sync queued sale #${item.sale.order_no}:`, err);
      remaining.push(item);
    }
  }

  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
  return { syncedCount, failedCount: remaining.length };
}
