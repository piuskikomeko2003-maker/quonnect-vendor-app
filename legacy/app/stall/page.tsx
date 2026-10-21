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
    const lowStock = products.filter((p) => !p.is_service && p.stock !== null && p.stock <= (p.min_stock_alert || 5)).length;

    return { total, active, drafts, lowStock };
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Tab filter
      if (filterTab === 'active' && !prod.is_active) return false;
      if (filterTab === 'draft' && prod.is_active) return false;
      if (filterTab === 'low_stock' && (prod.is_service || prod.stock === null || prod.stock > (prod.min_stock_alert || 5))) return false;

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = prod.name.toLowerCase().includes(q);
        const matchesDesc = prod.description?.toLowerCase().includes(q);
        const matchesSku = prod.sku?.toLowerCase().includes(q);
        const matchesCategory = prod.category?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesSku && !matchesCategory) return false;
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
            Loading Products...
          </p>
        </div>
      </div>
    );
  }

  if (!vendor && !isDemo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Navbar with Back button to home & Add product action */}
      <Navbar
        title="Products"
        showBack
        backHref="/"
        onOpenAddModal={() => {
          setEditingProduct(null);
          setIsModalOpen(true);
        }}
        actionButtonLabel="Add Product"
      />

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* KPI Summary Card matching sales/expenses/customers */}
        <div className="rounded-3xl p-5 bg-gradient-to-r from-teal-800 to-teal-600 text-white shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-teal-100 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {vendor?.business_name || 'Stall Catalog'}
            </span>
            <p className="text-2xl font-black mt-0.5">{metrics.total} Products</p>
            <p className="text-xs text-teal-200 mt-1 font-bold">
              {metrics.active} active on marketplace • {metrics.lowStock} low stock
            </p>
          </div>

          <button
            onClick={() => {
              setEditingProduct(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1 px-4 py-2.5 rounded-2xl bg-white text-teal-900 font-extrabold text-xs shadow-sm hover:bg-teal-50 transition-colors"
          >
            <Plus className="h-4 w-4 text-teal-600" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="space-y-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products by name, category, SKU..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Preset Buttons matching other pages */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                filterTab === 'all'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All ({metrics.total})
            </button>
            <button
              onClick={() => setFilterTab('active')}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                filterTab === 'active'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Active ({metrics.active})
            </button>
            <button
              onClick={() => setFilterTab('draft')}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                filterTab === 'draft'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Drafts ({metrics.drafts})
            </button>
            <button
              onClick={() => setFilterTab('low_stock')}
              className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                filterTab === 'low_stock'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : metrics.lowStock > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Low ({metrics.lowStock})
            </button>
          </div>
        </div>

        {/* Product Cards List */}
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="py-12 px-6 text-center rounded-3xl border border-dashed border-slate-300 bg-white">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <Package className="h-6 w-6 stroke-1" />
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
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20"
              >
                <Plus className="h-4 w-4" />
                <span>Add Your First Product</span>
              </button>
            </div>
          ) : (
            filteredProducts.map((product) => (
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
            ))
          )}
        </div>
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
