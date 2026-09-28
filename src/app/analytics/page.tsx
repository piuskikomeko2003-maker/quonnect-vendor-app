'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Sale } from '@/types/database.types';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { FeatureGate } from '@/components/layout/FeatureGate';
import { BarChart3, TrendingUp, Loader2 } from 'lucide-react';

// Lazy-load the heavy chart dashboard component so it never delays core screens
const AnalyticsDashboard = dynamic(
  () => import('@/components/analytics/AnalyticsDashboard'),
  {
    loading: () => (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
        <p className="text-xs text-slate-500 font-semibold">Loading deep analytics...</p>
      </div>
    ),
    ssr: false,
  }
);

export default function AnalyticsPage() {
  const { vendor, isDemo } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSales() {
      if (!vendor) return;

      if (isDemo) {
        setSales([
          {
            id: 's-1',
            vendor_id: vendor.id,
            order_no: 'POS-1001',
            customer_id: null,
            customer_name: 'David Mukasa',
            subtotal: 120000,
            discount: 0,
            tax: 0,
            shipping: 0,
            total: 120000,
            paid_amount: 120000,
            due_amount: 0,
            profit: 45000,
            status: 'completed',
            payment_method: 'Cash',
            sold_by: 'Owner',
            notes: null,
            sale_date: new Date().toISOString().split('T')[0],
            is_sample: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          },
          {
            id: 's-2',
            vendor_id: vendor.id,
            order_no: 'POS-1002',
            customer_id: null,
            customer_name: 'Sarah Namagembe',
            subtotal: 85000,
            discount: 0,
            tax: 0,
            shipping: 0,
            total: 85000,
            paid_amount: 85000,
            due_amount: 0,
            profit: 32000,
            status: 'completed',
            payment_method: 'Mobile money',
            sold_by: 'Owner',
            notes: null,
            sale_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
            is_sample: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          },
          {
            id: 's-3',
            vendor_id: vendor.id,
            order_no: 'POS-1003',
            customer_id: null,
            customer_name: 'Grace Achieng',
            subtotal: 160000,
            discount: 0,
            tax: 0,
            shipping: 0,
            total: 160000,
            paid_amount: 160000,
            due_amount: 0,
            profit: 58000,
            status: 'completed',
            payment_method: 'Cash',
            sold_by: 'Owner',
            notes: null,
            sale_date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
            is_sample: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          },
        ]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('sales')
        .select('*')
        .eq('vendor_id', vendor.id)
        .is('deleted_at', null)
        .order('sale_date', { ascending: false });

      if (data) setSales(data as Sale[]);
      setLoading(false);
    }

    loadSales();
  }, [vendor, isDemo]);

  return (
    <FeatureGate featureKey="deep_analytics">
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
        <Navbar title="Deep Analytics" />

        <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          <AnalyticsDashboard sales={sales} />
        </main>

        <BottomNav />
      </div>
    </FeatureGate>
  );
}
