'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { formatUGX } from '@/lib/formatters';
import {
  ReportPeriodPreset,
  getPresetDateRange,
  formatInclusiveDateRange,
  toKampalaDateString,
  getNowInKampala,
} from '@/lib/reportDateUtils';

// Components
import { ReportShell } from '@/components/reports/ReportShell';
import { DateRangeCard } from '@/components/reports/DateRangeCard';
import { KpiGrid, KpiItem } from '@/components/reports/KpiGrid';
import { HelpAccordion, CalculationFormula } from '@/components/reports/HelpAccordion';
import { ToggleRow } from '@/components/reports/ToggleRow';
import { ReportTable, ColumnDef } from '@/components/reports/ReportTable';
import { StatusPill } from '@/components/reports/StatusPill';
import { ExportSheet } from '@/components/reports/ExportSheet';
import { PeriodPickerModal } from '@/components/reports/PeriodPickerModal';
import { EmptyState } from '@/components/reports/EmptyState';

import {
  Boxes,
  HelpCircle,
  Filter,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';

interface StockReportItem {
  id: string;
  name: string;
  sku: string | null;
  photo_url: string | null;
  price: number;
  cost: number | null;
  stock: number | null;
  quantity_unit: string;
  min_stock_alert: number;
  is_sample: boolean;
  sold_qty: number;
  sold_revenue?: number;
  stock_value?: number;
  stock_cost_value?: number | null;
}

const STOCK_FORMULAS: CalculationFormula[] = [
  {
    label: 'Stock Cost',
    formula: 'Sum of (Current Stock × Unit Purchase Cost)',
    description: 'The total capital currently invested in holding inventory on hand.',
  },
  {
    label: 'Expected Sale Value',
    formula: 'Sum of (Current Stock × Unit Selling Price)',
    description: 'The gross cash expected if all current stock on hand is sold at marked prices.',
  },
  {
    label: 'Sell Profit',
    formula: 'Expected Sale Value − Stock Cost',
    description: 'The expected net gross profit locked inside your current available stock.',
  },
  {
    label: 'Total Stock',
    formula: 'Sum of all physical product units currently available',
    description: 'Excludes service listings which have no physical inventory count.',
  },
];

export default function StockReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { vendor, isDemo, user } = useAuth();

  // 1. Read URL parameters
  const presetParam = searchParams.get('preset') as ReportPeriodPreset | null;
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  // Compute active dates from URL
  const { from, to, periodName } = useMemo(() => {
    if (presetParam) {
      const r = getPresetDateRange(presetParam);
      return { from: r.from, to: r.to, periodName: r.label };
    }
    if (fromParam && toParam) {
      return {
        from: fromParam,
        to: toParam,
        periodName: formatInclusiveDateRange(fromParam, toParam),
      };
    }
    // Default fallback: Last 30 Days
    const def = getPresetDateRange('last-30-days');
    return { from: def.from, to: def.to, periodName: def.label };
  }, [presetParam, fromParam, toParam]);

  // If no date params exist at all, trigger period picker
  const [isPeriodPickerOpen, setIsPeriodPickerOpen] = useState(
    !presetParam && (!fromParam || !toParam)
  );

  // Filters & State
  const [excludeZeroStock, setExcludeZeroStock] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Search states for Table A and Table B
  const [searchTableA, setSearchTableA] = useState('');
  const [searchTableB, setSearchTableB] = useState('');

  // Data State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<{
    total_stock: number;
    expected_sale_value: number;
    stock_cost: number | null;
    sell_profit: number | null;
    can_see_cost: boolean;
    can_see_profit: boolean;
    has_sample: boolean;
  }>({
    total_stock: 0,
    expected_sale_value: 0,
    stock_cost: null,
    sell_profit: null,
    can_see_cost: true,
    can_see_profit: true,
    has_sample: false,
  });

  const [tableAItems, setTableAItems] = useState<StockReportItem[]>([]);
  const [tableBItems, setTableBItems] = useState<StockReportItem[]>([]);
  const [soldStockValue, setSoldStockValue] = useState(0);

  // Load Stock Report Data
  const loadStockReport = useCallback(async () => {
    if (!vendor) return;
    setLoading(true);
    setError(null);

    // 1. DEMO MODE DATA SIMULATION
    if (isDemo) {
      setTimeout(() => {
        let rawProducts: any[] = [];
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('quonnect_demo_products');
          if (saved) {
            try {
              rawProducts = JSON.parse(saved);
            } catch {}
          }
        }

        const validProds = rawProducts.filter((p) => !p.is_service && !p.deleted_at);
        const filteredProds = validProds.filter((p) => (excludeZeroStock ? (p.stock || 0) > 0 : true));

        const expVal = filteredProds.reduce((sum, i) => sum + (i.stock || 0) * (i.price || 0), 0);
        const costVal = filteredProds.reduce((sum, i) => sum + (i.stock || 0) * (i.cost || 0), 0);
        const totalUnits = filteredProds.reduce((sum, i) => sum + (i.stock || 0), 0);

        setKpis({
          total_stock: totalUnits,
          expected_sale_value: expVal,
          stock_cost: costVal,
          sell_profit: expVal - costVal,
          can_see_cost: true,
          can_see_profit: true,
          has_sample: validProds.some((p) => p.is_sample),
        });

        const bItems: StockReportItem[] = filteredProds.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku ?? null,
          photo_url: p.photo_url ?? null,
          price: p.price,
          cost: p.cost ?? 0,
          stock: p.stock ?? 0,
          quantity_unit: p.quantity_unit || 'unit',
          min_stock_alert: p.min_stock_alert || 3,
          is_sample: Boolean(p.is_sample),
          sold_qty: 0,
          stock_value: (p.stock || 0) * (p.price || 0),
          stock_cost_value: (p.stock || 0) * (p.cost || 0),
        }));

        setTableBItems(bItems);
        setTableAItems([]);
        setSoldStockValue(0);

        const cats = Array.from(new Set(validProds.map((p) => p.category).filter(Boolean)));
        setCategories(cats as string[]);
        setLoading(false);
      }, 150);
      return;
    }

    // 2. LIVE SUPABASE RPC EXECUTION
    try {
      const { data, error: rpcError } = await (supabase.rpc as any)('report_stock', {
        p_vendor_id: vendor.id,
        p_from: from,
        p_to: to,
        p_category: selectedCategory === 'all' ? null : selectedCategory,
        p_exclude_zero: excludeZeroStock,
        p_viewer_user_id: user?.id || null,
      });

      if (rpcError) {
        // Fallback: If RPC not yet applied, calculate securely via client query
        console.warn('RPC report_stock not found or returned error:', rpcError.message);
        await loadStockFallback();
        return;
      }

      if (data) {
        const payload = data as {
          kpis: any;
          table_a: StockReportItem[];
          table_b: StockReportItem[];
          sold_stock_value: number;
        };
        setKpis(payload.kpis);
        setTableAItems((payload.table_a || []) as StockReportItem[]);
        setTableBItems((payload.table_b || []) as StockReportItem[]);
        setSoldStockValue(payload.sold_stock_value || 0);
      }
    } catch (err) {
      console.error('Error fetching stock report:', err);
      setError('Unable to load stock report. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [vendor, isDemo, user, from, to, selectedCategory, excludeZeroStock]);

  // Fallback query if RPC isn't deployed yet
  const loadStockFallback = async () => {
    if (!vendor) return;
    try {
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('is_service', false)
        .is('deleted_at', null);

      if (!prods) return;

      const filteredProds = prods.filter((p) =>
        excludeZeroStock ? (p.stock || 0) > 0 : true
      );

      const expVal = filteredProds.reduce((sum, p) => sum + (p.stock || 0) * (p.price || 0), 0);
      const costVal = filteredProds.reduce((sum, p) => sum + (p.stock || 0) * (p.cost || 0), 0);
      const totalUnits = filteredProds.reduce((sum, p) => sum + (p.stock || 0), 0);

      setKpis({
        total_stock: totalUnits,
        expected_sale_value: expVal,
        stock_cost: costVal,
        sell_profit: expVal - costVal,
        can_see_cost: true,
        can_see_profit: true,
        has_sample: prods.some((p) => p.is_sample),
      });

      const bItems: StockReportItem[] = filteredProds.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        photo_url: p.photo_url ?? null,
        price: p.price,
        cost: p.cost ?? 0,
        stock: p.stock ?? 0,
        quantity_unit: p.quantity_unit || 'unit',
        min_stock_alert: p.min_stock_alert || 3,
        is_sample: Boolean(p.is_sample),
        sold_qty: 0,
        stock_value: (p.stock || 0) * p.price,
        stock_cost_value: (p.stock || 0) * (p.cost || 0),
      }));

      setTableBItems(bItems);
      setTableAItems([]);
      setSoldStockValue(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStockReport();
  }, [loadStockReport]);

  // Filter Table A by search query
  const filteredTableA = useMemo(() => {
    if (!searchTableA.trim()) return tableAItems;
    const q = searchTableA.toLowerCase();
    return tableAItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q))
    );
  }, [tableAItems, searchTableA]);

  // Filter Table B by search query
  const filteredTableB = useMemo(() => {
    if (!searchTableB.trim()) return tableBItems;
    const q = searchTableB.toLowerCase();
    return tableBItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q))
    );
  }, [tableBItems, searchTableB]);

  // Calculate Table B real footers
  const tableBCurrentStockValue = useMemo(() => {
    return filteredTableB.reduce((sum, item) => sum + (item.stock_value || 0), 0);
  }, [filteredTableB]);

  const tableBCurrentStockCost = useMemo(() => {
    return filteredTableB.reduce((sum, item) => sum + (item.stock_cost_value || 0), 0);
  }, [filteredTableB]);

  // Prepare KPI Grid Items
  const kpiItems: KpiItem[] = useMemo(() => {
    const list: KpiItem[] = [];

    // 1. Stock Cost (Green) - Hidden if unauthorized
    if (kpis.can_see_cost && kpis.stock_cost !== null) {
      list.push({
        label: 'Stock Cost',
        value: formatUGX(kpis.stock_cost),
        caption: 'Based on purchase price',
        theme: 'green',
      });
    }

    // 2. Expected Sale Value (Teal)
    list.push({
      label: 'Expected Sale Value',
      value: formatUGX(kpis.expected_sale_value),
      caption: 'Based on selling price',
      theme: 'teal',
    });

    // 3. Sell Profit (Green) - Hidden if unauthorized
    if (kpis.can_see_profit && kpis.sell_profit !== null) {
      list.push({
        label: 'Sell Profit',
        value: formatUGX(kpis.sell_profit),
        caption: 'Expected sale value minus stock cost',
        theme: 'green',
      });
    }

    // 4. Total Stock (Amber)
    list.push({
      label: 'Total Stock',
      value: `${kpis.total_stock} units`,
      caption: 'Available stock quantity now',
      theme: 'amber',
    });

    return list;
  }, [kpis]);

  // Export handlers
  const handleExportCSV = () => {
    const headers = ['No', 'Product', 'SKU', 'Sold Qty', 'Current Stock', 'Sell Price', 'Total Stock Value'];
    if (kpis.can_see_cost) headers.push('Unit Cost');

    const rows = filteredTableB.map((item, idx) => {
      const r = [
        idx + 1,
        `"${item.name}"`,
        item.sku || 'N/A',
        item.sold_qty,
        item.stock || 0,
        item.price,
        item.stock_value || 0,
      ];
      if (kpis.can_see_cost) r.push(item.cost || 0);
      return r;
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Report_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Columns for Table A (Sold during period)
  const columnsTableA: ColumnDef<StockReportItem>[] = [
    {
      header: 'No',
      cell: (_, idx?: number) => <span className="text-slate-400 font-bold">{idx !== undefined ? idx + 1 : ''}</span>,
    },
    {
      header: 'Product',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
            {item.photo_url ? (
              <img src={item.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900">{item.name}</span>
              {item.is_sample && (
                <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                  SAMPLE
                </span>
              )}
            </div>
            {item.sku && <span className="text-[10px] text-slate-400">SKU: {item.sku}</span>}
          </div>
        </div>
      ),
    },
    {
      header: 'Sold',
      accessorKey: 'sold_qty',
      align: 'right',
      cell: (item) => (
        <span className="font-black text-teal-800">
          {item.sold_qty} {item.quantity_unit}
        </span>
      ),
    },
    {
      header: 'Stock',
      accessorKey: 'stock',
      align: 'right',
      cell: (item) => {
        const isOut = item.stock !== null && item.stock <= 0;
        const isLow = item.stock !== null && item.stock > 0 && item.stock <= item.min_stock_alert;
        return (
          <StatusPill
            status={isOut ? 'out' : isLow ? 'low' : 'ok'}
            label={`${item.stock || 0} left`}
          />
        );
      },
    },
    {
      header: 'Price',
      align: 'right',
      cell: (item) => formatUGX(item.price),
    },
    {
      header: 'Revenue',
      align: 'right',
      cell: (item) => (
        <span className="font-black text-slate-900">
          {formatUGX(item.sold_revenue || 0)}
        </span>
      ),
    },
  ];

  // Columns for Table B (Current inventory)
  const columnsTableB: ColumnDef<StockReportItem>[] = [
    {
      header: 'No',
      cell: (_, idx?: number) => <span className="text-slate-400 font-bold">{idx !== undefined ? idx + 1 : ''}</span>,
    },
    {
      header: 'Product',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
            {item.photo_url ? (
              <img src={item.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900">{item.name}</span>
              {item.is_sample && (
                <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                  SAMPLE
                </span>
              )}
            </div>
            {item.sku && <span className="text-[10px] text-slate-400">SKU: {item.sku}</span>}
          </div>
        </div>
      ),
    },
    {
      header: 'Sold',
      accessorKey: 'sold_qty',
      align: 'right',
      cell: (item) => (
        <span className="font-bold text-slate-600">
          {item.sold_qty} {item.quantity_unit}
        </span>
      ),
    },
    {
      header: 'Stock',
      align: 'right',
      cell: (item) => {
        const isOut = item.stock !== null && item.stock <= 0;
        const isLow = item.stock !== null && item.stock > 0 && item.stock <= item.min_stock_alert;
        return (
          <StatusPill
            status={isOut ? 'out' : isLow ? 'low' : 'ok'}
            label={`${item.stock || 0} ${item.quantity_unit}`}
          />
        );
      },
    },
    {
      header: 'Price',
      align: 'right',
      cell: (item) => formatUGX(item.price),
    },
    {
      header: 'Stock Value',
      align: 'right',
      cell: (item) => (
        <span className="font-black text-slate-900">
          {formatUGX(item.stock_value || 0)}
        </span>
      ),
    },
  ];

  return (
    <ReportShell
      title={`Report (${periodName})`}
      subtitle="Stock & Inventory Valuation"
      onOpenExport={() => setIsExportOpen(true)}
      backHref="/reports"
      hasSampleData={kpis.has_sample}
    >
      {/* 1. DateRangeCard */}
      <DateRangeCard
        from={from}
        to={to}
        onOpenPeriodPicker={() => setIsPeriodPickerOpen(true)}
      />

      {/* 2. Header Card: Stock Report Overview with Category filter and Help button */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Stock Report
            </h2>
            {selectedCategory !== 'all' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                {selectedCategory}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Current stock value overview
          </p>
        </div>

        <div className="flex items-center gap-2">
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 outline-none text-slate-700"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <a
            href="#calculation-formulas"
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors"
            title="How calculations work"
            aria-label="How calculations work"
          >
            <HelpCircle className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* 3. ToggleRow: Exclude 0 Stock */}
      <ToggleRow
        icon={<Boxes className="h-5 w-5" />}
        title="Exclude 0 Stock"
        helperText="Hide items with 0 or negative stock from report"
        statusChip={excludeZeroStock ? 'Hiding empty' : 'Showing All Items'}
        checked={excludeZeroStock}
        onChange={setExcludeZeroStock}
      />

      {/* Loading Skeleton / Error State */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-teal-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">
            Computing stock valuation and period sales...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
          <p className="text-xs text-rose-800 font-bold">{error}</p>
          <button
            onClick={loadStockReport}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-rose-600 text-white font-bold text-xs"
          >
            Retry Loading
          </button>
        </div>
      ) : (
        <>
          {/* 4. KpiGrid 2x2 */}
          <KpiGrid items={kpiItems} />

          {/* 5. HelpAccordion: Plain-language formulas */}
          <div id="calculation-formulas">
            <HelpAccordion
              title="How values are calculated"
              formulas={STOCK_FORMULAS}
            />
          </div>

          {/* ================= 6. TABLE A: PRODUCTS SOLD IN PERIOD ================= */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {periodName} - Products sold during the period
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                In-Stock Only
              </span>
            </div>

            <ReportTable
              data={filteredTableA}
              columns={columnsTableA}
              searchPlaceholder="Search sold products by name or SKU..."
              searchValue={searchTableA}
              onSearchChange={setSearchTableA}
              renderMobileCard={(item) => {
                const isOut = item.stock !== null && item.stock <= 0;
                const isLow = item.stock !== null && item.stock > 0 && item.stock <= item.min_stock_alert;
                return (
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.photo_url ? (
                            <img src={item.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {item.name}
                            </h4>
                            {item.is_sample && (
                              <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                                SAMPLE
                              </span>
                            )}
                          </div>
                          {item.sku && <p className="text-[10px] text-slate-400">SKU: {item.sku}</p>}
                        </div>
                      </div>

                      <StatusPill
                        status={isOut ? 'out' : isLow ? 'low' : 'ok'}
                        label={isOut ? 'Out of stock' : `${item.stock || 0} in stock`}
                      />
                    </div>

                    <p className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
                      Sold <span className="font-bold text-slate-900">{item.sold_qty}</span>
                      {' · '}
                      Price <span className="font-bold text-slate-900">{formatUGX(item.price)}</span>
                      {' · '}
                      Revenue <span className="font-bold text-slate-900">{formatUGX(item.sold_revenue || 0)}</span>
                    </p>
                  </div>
                );
              }}
              footerRow={
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Sold Products Stock Value:</span>
                  <span className="text-sm font-black text-slate-900">
                    {formatUGX(soldStockValue)}
                  </span>
                </div>
              }
              emptyState={
                <EmptyState
                  title="No items sold in this period"
                  description="No sales recorded for the selected date range. Try expanding your date range or recording a new sale."
                  actionText="Record a Sale"
                  onAction={() => router.push('/pos')}
                />
              }
            />
          </div>

          {/* ================= 7. TABLE B: CURRENT INVENTORY ================= */}
          <div className="space-y-3 pt-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Current Inventory - Current stock only
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                This section shows your current stock on hand and current stock value. Only the Sold column changes based on the selected date range.
              </p>
            </div>

            <ReportTable
              data={filteredTableB}
              columns={columnsTableB}
              searchPlaceholder="Search current inventory by name or SKU..."
              searchValue={searchTableB}
              onSearchChange={setSearchTableB}
              renderMobileCard={(item) => {
                const isOut = item.stock !== null && item.stock <= 0;
                const isLow = item.stock !== null && item.stock > 0 && item.stock <= item.min_stock_alert;
                return (
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.photo_url ? (
                            <img src={item.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {item.name}
                            </h4>
                            {item.is_sample && (
                              <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                                SAMPLE
                              </span>
                            )}
                          </div>
                          {item.sku && <p className="text-[10px] text-slate-400">SKU: {item.sku}</p>}
                        </div>
                      </div>

                      <StatusPill
                        status={isOut ? 'out' : isLow ? 'low' : 'ok'}
                        label={`${item.stock || 0} ${item.quantity_unit}`}
                      />
                    </div>

                    <p className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
                      Sold <span className="font-bold text-slate-900">{item.sold_qty}</span>
                      {' · '}
                      Price <span className="font-bold text-slate-900">{formatUGX(item.price)}</span>
                      {' · '}
                      Value <span className="font-bold text-slate-900">{formatUGX(item.stock_value || 0)}</span>
                    </p>
                  </div>
                );
              }}
              footerRow={
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Current Stock Value:</span>
                    <span className="text-sm font-black text-slate-900">
                      {formatUGX(tableBCurrentStockValue)}
                    </span>
                  </div>
                  {kpis.can_see_cost && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                      <span className="text-slate-600">Stock Cost:</span>
                      <span className="font-extrabold text-emerald-800">
                        {formatUGX(tableBCurrentStockCost)}
                      </span>
                    </div>
                  )}
                </div>
              }
              emptyState={
                <EmptyState
                  title="No products yet. Add your first product"
                  description="No physical products found in inventory. Add your first product to start tracking stock."
                  actionText="Add Product"
                  onAction={() => router.push('/stall')}
                />
              }
            />
          </div>
        </>
      )}

      {/* Period Picker Modal */}
      <PeriodPickerModal
        isOpen={isPeriodPickerOpen}
        onClose={() => {
          setIsPeriodPickerOpen(false);
          if (!presetParam && (!fromParam || !toParam)) {
            router.push('/reports');
          }
        }}
        reportType="stock"
        reportTitle="Stock Report"
      />

      {/* Export Sheet */}
      <ExportSheet
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        reportTitle={`Stock Report (${periodName})`}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />
    </ReportShell>
  );
}
