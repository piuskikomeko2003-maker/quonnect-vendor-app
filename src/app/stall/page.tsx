'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Product } from '@/types/database.types';
import { Navbar } from '@/components/layout/Navbar';
import { ProductCard } from '@/components/stall/ProductCard';
import { AddEditProductModal } from '@/components/stall/AddEditProductModal';
import { 
  Building2, 
  MapPin, 
  Tag, 
  Plus, 
  Search, 
  Package, 
  Eye, 
  EyeOff, 
  AlertTriangle
} from 'lucide-react';

export default function StallPage() {
  const router = useRouter();
  const { vendor, loading: authLoading, isDemo } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'draft' | 'low_stock'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!vendor) return null;

    if (isDemo) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('quonnect_demo_products') : null;
      if (saved) {
        try {
          return JSON.parse(saved) as Product[];
        } catch {
          return [];
        }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        return null;
      }
      return data as Product[];
    } catch (err) {
      console.error('Fetch error:', err);
      return null;
    }
  }, [vendor, isDemo]);

  useEffect(() => {
    if (!authLoading && !vendor && !isDemo) {
      router.push('/login');
      return;
    }
    if (!vendor) return;

    let cancelled = false;
    void fetchProducts().then((data) => {
      if (!cancelled && data) setProducts(data);
    });
    return () => {
      cancelled = true;
    };
  }, [vendor, authLoading, isDemo, router, fetchProducts]);

  // Persist demo helper
  const persistDemoProducts = (updated: Product[]) => {
    if (isDemo && typeof window !== 'undefined') {
      localStorage.setItem('quonnect_demo_products', JSON.stringify(updated));
    }
  };

  const handleProductSaved = (product: Product, isNew: boolean) => {
    const index = products.findIndex((p) => p.id === product.id);
    const updated =
      index >= 0
        ? products.map((p) => (p.id === product.id ? product : p))
        : [product, ...products];

    setProducts(updated);
    persistDemoProducts(updated);

    if (isNew) {
      router.push(`/stall/${product.id}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to remove this product from your stall?')) return;

    try {
      if (isDemo) {
        setProducts((prev) => {
          const updated = prev.filter((p) => p.id !== id);
          persistDemoProducts(updated);
          return updated;
        });
      } else {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      alert('Failed to delete product: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const nextActive = !currentActive;

    try {
      if (isDemo) {
        setProducts((prev) => {
          const updated = prev.map((p) => (p.id === id ? { ...p, is_active: nextActive } : p));
          persistDemoProducts(updated);
          return updated;
        });
      } else {
        const { error } = await supabase
          .from('products')
          .update({ is_active: nextActive, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_active: nextActive } : p))
        );
      }
    } catch (err) {
      alert('Failed to update product visibility: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.is_active).length;
    const drafts = total - active;
    const lowStock = products.filter((p) => p.stock !== null && p.stock <= 5).length;

    return { total, active, drafts, lowStock };
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Tab filter
      if (filterTab === 'active' && !prod.is_active) return false;
      if (filterTab === 'draft' && prod.is_active) return false;
      if (filterTab === 'low_stock' && (prod.stock === null || prod.stock > 5)) return false;

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = prod.name.toLowerCase().includes(q);
        const matchesDesc = prod.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [products, filterTab, searchTerm]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Stall & Catalog...
          </p>
        </div>
      </div>
    );
  }

  if (!vendor && !isDemo) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar
        onOpenAddModal={() => {
          setEditingProduct(null);
          setIsModalOpen(true);
        }}
        actionButtonLabel="Add Product"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Stall Header Banner with Background Image & Dark Gradient Overlay */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 shadow-md p-6 sm:p-8 min-h-[190px] flex items-center">
          {/* Background Image */}
          <img
            src="/images/Marketplace%20Stall%20%26%20Product%20Catalog.png"
            alt="Marketplace Stall & Product Catalog Banner"
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          />

          {/* Dark Gradient Overlay for Maximum Readability */}
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
                Marketplace Stall & Product Catalog
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 max-w-xl leading-relaxed drop-shadow-xs">
                Showcase your items, set prices in UGX, and toggle which products are active for buyers on Quonnect.
              </p>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsModalOpen(true);
                }}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold rounded-2xl bg-teal-500 hover:bg-teal-400 text-white shadow-md shadow-teal-950/40 hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap border border-teal-400/30"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add Product</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Total Catalog</span>
              <Package className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">
              {metrics.total}
            </div>
            <span className="text-[11px] text-slate-400">products listed</span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-teal-200/80 shadow-xs">
            <div className="flex items-center justify-between text-teal-700 text-xs font-bold uppercase tracking-wider">
              <span>Marketplace Active</span>
              <Eye className="h-4 w-4 text-teal-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-teal-700">
              {metrics.active}
            </div>
            <span className="text-[11px] text-slate-400">visible to buyers</span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Drafts / Hidden</span>
              <EyeOff className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-700">
              {metrics.drafts}
            </div>
            <span className="text-[11px] text-slate-400">private drafts</span>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-amber-200/80 shadow-xs">
            <div className="flex items-center justify-between text-amber-600 text-xs font-bold uppercase tracking-wider">
              <span>Low / Out Stock</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-600">
              {metrics.lowStock}
            </div>
            <span className="text-[11px] text-slate-400">need restock</span>
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
              onClick={() => setFilterTab('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'active'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-teal-700'
              }`}
            >
              Active ({metrics.active})
            </button>
            <button
              onClick={() => setFilterTab('draft')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'draft'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Drafts ({metrics.drafts})
            </button>
            <button
              onClick={() => setFilterTab('low_stock')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterTab === 'low_stock'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Low Stock ({metrics.lowStock})
            </button>
          </div>

          {/* Search */}
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 px-6 text-center rounded-3xl border border-dashed border-slate-300 bg-white">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <Package className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No products found
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || filterTab !== 'all'
                ? 'Try clearing your search query or switching filters.'
                : 'Start populating your stall to display products on Quonnect.'}
            </p>
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Your First Product</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={(p) => {
                  setEditingProduct(p);
                  setIsModalOpen(true);
                }}
                onDelete={handleDeleteProduct}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add / Edit Modal */}
      {vendor && isModalOpen && (
        <AddEditProductModal
          key={editingProduct?.id ?? 'new'}
          isOpen
          onClose={() => {
            setIsModalOpen(false);
            setEditingProduct(null);
          }}
          vendorId={vendor.id}
          isDemo={isDemo}
          editingProduct={editingProduct}
          onProductSaved={handleProductSaved}
        />
      )}
    </div>
  );
}
