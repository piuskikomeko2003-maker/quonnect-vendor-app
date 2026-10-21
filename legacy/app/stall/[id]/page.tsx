'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Product, ProductColor } from '@/types/database.types';
import { formatUGX, formatDate } from '@/lib/formatters';
import { normalizeColors } from '@/lib/productColors';
import { Navbar } from '@/components/layout/Navbar';
import { AddEditProductModal } from '@/components/stall/AddEditProductModal';
import { ColorPicker, swatchStyle } from '@/components/stall/ColorPicker';
import {
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Package,
  Layers,
  AlertTriangle,
  PaintBucket,
  Tag,
  CalendarDays,
  Hash,
  Ruler,
  Save,
  Loader2,
  ChevronLeft,
  TrendingUp,
  PackageX,
  Plus,
} from 'lucide-react';

const readDemoProducts = (): Product[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('quonnect_demo_products') || '[]') as Product[];
  } catch {
    return [];
  }
};

const writeDemoProducts = (list: Product[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('quonnect_demo_products', JSON.stringify(list));
  }
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;
  const router = useRouter();
  const { vendor, loading: authLoading, isDemo } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditingColors, setIsEditingColors] = useState(false);
  const [draftColors, setDraftColors] = useState<ProductColor[]>([]);
  const [savingColors, setSavingColors] = useState(false);

  const applyProduct = useCallback((next: Product) => {
    setProduct(next);
    setDraftColors(normalizeColors(next.colors));
  }, []);

  const persist = useCallback(
    (next: Product) => {
      applyProduct(next);
      if (isDemo) {
        writeDemoProducts(readDemoProducts().map((p) => (p.id === next.id ? next : p)));
      }
    },
    [isDemo, applyProduct]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!vendor && !isDemo) {
      router.push('/login');
      return;
    }
    if (!productId) return;

    let cancelled = false;

    const load = async () => {
      setLoadingProduct(true);
      setNotFound(false);

      if (isDemo) {
        const found = readDemoProducts().find((p) => p.id === productId) ?? null;
        if (!cancelled) {
          if (found) applyProduct(found);
          setNotFound(!found);
          setLoadingProduct(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .maybeSingle();

        if (!cancelled) {
          if (error || !data) {
            setNotFound(true);
          } else {
            applyProduct(data as Product);
          }
          setLoadingProduct(false);
        }
      } catch (err) {
        console.error('Failed to load product:', err);
        if (!cancelled) {
          setNotFound(true);
          setLoadingProduct(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [productId, vendor, authLoading, isDemo, router, applyProduct]);

  const handleToggleActive = async () => {
    if (!product) return;
    const nextActive = !product.is_active;

    try {
      if (isDemo) {
        persist({ ...product, is_active: nextActive });
      } else {
        const { error } = await supabase
          .from('products')
          .update({ is_active: nextActive, updated_at: new Date().toISOString() })
          .eq('id', product.id);
        if (error) throw error;
        persist({ ...product, is_active: nextActive });
      }
    } catch (err) {
      alert('Failed to update visibility: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!confirm('Are you sure you want to remove this product from your stall?')) return;

    try {
      if (isDemo) {
        writeDemoProducts(readDemoProducts().filter((p) => p.id !== product.id));
      } else {
        const { error } = await supabase.from('products').delete().eq('id', product.id);
        if (error) throw error;
      }
      router.push('/stall');
    } catch (err) {
      alert('Failed to delete product: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSaveColors = async () => {
    if (!product) return;
    setSavingColors(true);
    try {
      const nextColors = normalizeColors(draftColors);
      if (isDemo) {
        persist({ ...product, colors: nextColors });
      } else {
        const { error } = await supabase
          .from('products')
          .update({ colors: nextColors, updated_at: new Date().toISOString() })
          .eq('id', product.id);
        if (error) throw error;
        persist({ ...product, colors: nextColors });
      }
      setIsEditingColors(false);
    } catch (err) {
      alert('Failed to save colours: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSavingColors(false);
    }
  };

  if (authLoading || loadingProduct) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar showBack backHref="/stall" title="Product" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading product...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!vendor && !isDemo) return null;

  if (notFound || !product) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar showBack backHref="/stall" title="Product" />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <PackageX className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Product not found</h2>
            <p className="text-xs text-slate-500 mt-1">It may have been deleted or removed from your stall.</p>
            <Link
              href="/stall"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Stall
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const colors = normalizeColors(product.colors);
  const profit = (product.price || 0) - (product.cost || 0);
  const margin = product.price > 0 ? Math.round((profit / product.price) * 100) : 0;
  const isOutOfStock = !product.is_service && product.stock !== null && product.stock <= 0;
  const isLowStock =
    !product.is_service &&
    product.stock !== null &&
    product.stock > 0 &&
    product.stock <= (product.min_stock_alert || 5);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-28">
      <Navbar
        showBack
        backHref="/stall"
        title="Product Details"
        onOpenAddModal={() => {
          setIsEditOpen(true);
        }}
        actionButtonLabel="Edit"
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Hero card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Photo */}
            <div className="relative aspect-square md:aspect-auto md:min-h-[320px] bg-slate-100">
              {product.photo_url ? (
                <img
                  src={product.photo_url}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <Package className="h-14 w-14 stroke-1 mb-2" />
                  <span className="text-xs font-semibold">No photo uploaded</span>
                </div>
              )}

              <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-md ${
                    product.is_active ? 'bg-teal-600 text-white' : 'bg-slate-900/80 text-white'
                  }`}
                >
                  {product.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {product.is_active ? 'On Marketplace' : 'Hidden'}
                </span>
                {product.is_service ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-sm">
                    <Layers className="h-3.5 w-3.5" />
                    Service
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm ${
                      isOutOfStock ? 'bg-rose-600 text-white' : isLowStock ? 'bg-amber-600 text-white' : 'bg-slate-900/80 text-white'
                    }`}
                  >
                    {(isOutOfStock || isLowStock) && <AlertTriangle className="h-3.5 w-3.5" />}
                    {isOutOfStock
                      ? 'Out of stock'
                      : isLowStock
                      ? `Low: ${product.stock} ${product.quantity_unit || ''}`
                      : `${product.stock ?? 0} ${product.quantity_unit || 'units'}`}
                  </span>
                )}
                {product.is_sample && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                    Sample
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="p-6 sm:p-7 flex flex-col">
              {product.category && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Tag className="h-3 w-3" />
                  {product.category}
                </span>
              )}
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">
                {product.name}
              </h1>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-3xl font-black text-slate-900">{formatUGX(product.price)}</span>
                {!product.is_sample && (
                  <span className="text-xs font-semibold text-slate-400 line-through">{formatUGX(product.cost ?? 0)}</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${profit >= 0 ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-rose-700 bg-rose-50 border-rose-200'}`}>
                  <TrendingUp className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  {formatUGX(profit)} profit
                </span>
                {product.price > 0 && (
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    {margin}% margin
                  </span>
                )}
              </div>

              {product.description && (
                <p className="mt-4 text-sm text-slate-600 leading-relaxed">{product.description}</p>
              )}

              {/* Actions */}
              <div className="mt-auto pt-6 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-2xl bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-600/20 transition-all active:scale-95"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Product
                </button>
                <button
                  onClick={handleToggleActive}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-2xl border transition-all active:scale-95 ${
                    product.is_active
                      ? 'border-teal-200 bg-teal-50 text-teal-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {product.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {product.is_active ? 'Hide' : 'Publish'}
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Details + Colours */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Details */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900">Product Details</h2>

            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 text-slate-500 font-medium">
                  <Ruler className="h-4 w-4 text-slate-400" /> Unit
                </dt>
                <dd className="font-bold text-slate-800">{product.quantity_unit || 'unit'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 text-slate-500 font-medium">
                  <Hash className="h-4 w-4 text-slate-400" /> SKU
                </dt>
                <dd className="font-bold text-slate-800">{product.sku || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 text-slate-500 font-medium">
                  <Hash className="h-4 w-4 text-slate-400" /> Barcode
                </dt>
                <dd className="font-bold text-slate-800">{product.barcode || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 text-slate-500 font-medium">
                  <AlertTriangle className="h-4 w-4 text-slate-400" /> Low stock alert
                </dt>
                <dd className="font-bold text-slate-800">{product.min_stock_alert ?? 3}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 text-slate-500 font-medium">
                  <CalendarDays className="h-4 w-4 text-slate-400" /> Expiry
                </dt>
                <dd className="font-bold text-slate-800">{product.expiry_date ? formatDate(product.expiry_date) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2 text-slate-500 font-medium">
                  <CalendarDays className="h-4 w-4 text-slate-400" /> Added
                </dt>
                <dd className="font-bold text-slate-800">{formatDate(product.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Available Colours */}
          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-slate-900 inline-flex items-center gap-2">
                <PaintBucket className="h-4 w-4 text-teal-600" />
                Available Colours
                {colors.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black">
                    {colors.length}
                  </span>
                )}
              </h2>

              {!isEditingColors ? (
                <button
                  onClick={() => {
                    setDraftColors(colors);
                    setIsEditingColors(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {colors.length > 0 ? 'Edit Colours' : 'Add Colours'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setDraftColors(colors);
                      setIsEditingColors(false);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveColors}
                    disabled={savingColors}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-60"
                  >
                    {savingColors ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </button>
                </div>
              )}
            </div>

            {isEditingColors ? (
              <div className="mt-4">
                <ColorPicker value={draftColors} onChange={setDraftColors} />
              </div>
            ) : colors.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {colors.map((color) => (
                  <div
                    key={`${color.name}-${color.hex}`}
                    className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-2xl border border-slate-200 bg-slate-50/60"
                  >
                    <span
                      className="h-7 w-7 rounded-xl border border-white ring-1 ring-slate-200"
                      style={swatchStyle(color.hex)}
                    />
                    <span className="text-xs font-bold text-slate-700">{color.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 py-8 text-center rounded-2xl border border-dashed border-slate-200">
                <PaintBucket className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">No colours added yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Add the colours this product is available in — e.g. Red, Blue, Black.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {vendor && isEditOpen && (
        <AddEditProductModal
          key={product.id}
          isOpen
          onClose={() => setIsEditOpen(false)}
          vendorId={vendor.id}
          isDemo={isDemo}
          editingProduct={product}
          onProductSaved={(saved, isNew) => {
            if (isNew) {
              router.replace(`/stall/${saved.id}`);
            } else {
              persist(saved);
            }
          }}
        />
      )}
    </div>
  );
}
