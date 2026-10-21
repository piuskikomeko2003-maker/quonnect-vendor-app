'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Product, Customer, Sale, SaleItem } from '@/types/database.types';
import { formatUGX } from '@/lib/formatters';
import { Navbar } from '@/components/layout/Navbar';
import { ReceiptModal } from '@/components/sales/ReceiptModal';
import { enqueueOfflineSale } from '@/lib/offlineQueue';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Check,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  User,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', icon: Banknote },
  { id: 'Mobile money', label: 'Mobile Money', icon: Smartphone },
  { id: 'Bank transfer', label: 'Bank Transfer', icon: Building },
  { id: 'Card', label: 'Card', icon: CreditCard },
  { id: 'Credit', label: 'Credit (Due)', icon: CreditCard },
];

export default function PosPage() {
  const router = useRouter();
  const { vendor, isDemo } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart Sheet & Checkout State
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [discount, setDiscount] = useState<string>('0');
  const [tax, setTax] = useState<string>('0');
  const [notes, setNotes] = useState('');
  const [loadingSale, setLoadingSale] = useState(false);

  // Success Receipt State
  const [completedSale, setCompletedSale] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);

  // Fetch products & customers
  useEffect(() => {
    async function loadData() {
      if (!vendor) return;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const demoProds = localStorage.getItem('quonnect_demo_products');
          if (demoProds) {
            try {
              setProducts(JSON.parse(demoProds));
            } catch {}
          }
          const demoCusts = localStorage.getItem('quonnect_demo_customers');
          if (demoCusts) {
            try {
              setCustomers(JSON.parse(demoCusts));
            } catch {}
          }
        }
        return;
      }

      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('is_active', true)
        .order('name');
      if (prodData) setProducts(prodData as Product[]);

      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('name');
      if (custData) setCustomers(custData as Customer[]);
    }

    loadData();
  }, [vendor, isDemo]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          (p.sku && p.sku.toLowerCase().includes(query)) ||
          (p.category && p.category.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [products, selectedCategory, searchTerm]);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Cart Totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0);
  }, [cart]);

  const numericDiscount = parseFloat(discount) || 0;
  const numericTax = parseFloat(tax) || 0;
  const totalAmount = Math.max(0, subtotal - numericDiscount + numericTax);

  // Auto-fill paid amount when cart total updates if user hasn't explicitly customized it
  useEffect(() => {
    if (amountPaid === '' || amountPaid === '0' || parseFloat(amountPaid) === subtotal) {
      setAmountPaid(String(totalAmount));
    }
  }, [totalAmount]);

  const numericPaid = parseFloat(amountPaid) || 0;
  const changeDue = Math.max(0, numericPaid - totalAmount);
  const balanceDue = Math.max(0, totalAmount - numericPaid);

  // Complete POS Sale
  const handleCompleteSale = async () => {
    if (!vendor || cart.length === 0) return;
    setLoadingSale(true);

    const orderNo = `POS-${Date.now().toString().slice(-4)}`;
    const costTotal = cart.reduce(
      (sum, item) => sum + (item.product.cost || 0) * item.quantity,
      0
    );
    const profit = totalAmount - costTotal;
    const now = new Date();
    const saleDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const saleRecord: Sale = {
      id: crypto.randomUUID(),
      vendor_id: vendor.id,
      order_no: orderNo,
      customer_id: selectedCustomerId || null,
      customer_name: customerName.trim() || 'Walk-in Customer',
      subtotal,
      discount: numericDiscount,
      tax: numericTax,
      shipping: 0,
      total: totalAmount,
      paid_amount: numericPaid,
      due_amount: balanceDue,
      profit,
      status: balanceDue > 0 ? (numericPaid > 0 ? 'partial' : 'credit') : 'completed',
      payment_method: paymentMethod,
      sold_by: vendor.owner_name || 'Owner',
      notes: notes.trim() || null,
      sale_date: saleDate,
      is_sample: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const saleItemsRecords: SaleItem[] = cart.map((item) => ({
      id: crypto.randomUUID(),
      sale_id: saleRecord.id,
      vendor_id: vendor.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.price,
      unit_cost: item.product.cost || 0,
      total: item.product.price * item.quantity,
      profit: (item.product.price - (item.product.cost || 0)) * item.quantity,
      created_at: new Date().toISOString(),
    }));

    try {
      if (isDemo) {
        if (typeof window !== 'undefined') {
          // 1. Save sale to demo sales
          const rawSales = localStorage.getItem('quonnect_demo_sales');
          let existingSales: Sale[] = [];
          if (rawSales) {
            try {
              existingSales = JSON.parse(rawSales);
            } catch {}
          }
          localStorage.setItem('quonnect_demo_sales', JSON.stringify([saleRecord, ...existingSales]));

          // 2. Save cashflow entry to demo entries
          const rawEntries = localStorage.getItem('quonnect_demo_entries');
          let existingEntries: any[] = [];
          if (rawEntries) {
            try {
              existingEntries = JSON.parse(rawEntries);
            } catch {}
          }
          const demoEntry = {
            id: 'demo-fe-' + crypto.randomUUID(),
            vendor_id: vendor.id,
            type: 'income',
            category: 'POS Stall Sale',
            amount: saleRecord.paid_amount,
            source: 'manual',
            entry_date: saleDate,
            notes: `Order #${saleRecord.order_no} (${saleRecord.customer_name})`,
            created_at: new Date().toISOString(),
          };
          localStorage.setItem('quonnect_demo_entries', JSON.stringify([demoEntry, ...existingEntries]));

          // 3. Deduct stock in demo products
          const rawProds = localStorage.getItem('quonnect_demo_products');
          let existingProds: Product[] = [];
          if (rawProds) {
            try {
              existingProds = JSON.parse(rawProds);
            } catch {}
          }
          const updatedDemoProds = existingProds.map((prod) => {
            const cartItem = cart.find((item) => item.product.id === prod.id);
            if (cartItem && !prod.is_service && prod.stock !== null && prod.stock !== undefined) {
              const newStock = Math.max(0, prod.stock - cartItem.quantity);
              return { ...prod, stock: newStock };
            }
            return prod;
          });
          localStorage.setItem('quonnect_demo_products', JSON.stringify(updatedDemoProds));
          setProducts(updatedDemoProds);
        }
      } else {
        // Insert into Supabase
        const { error: saleErr } = await supabase.from('sales').insert({
          id: saleRecord.id,
          vendor_id: saleRecord.vendor_id,
          order_no: saleRecord.order_no,
          customer_id: saleRecord.customer_id,
          customer_name: saleRecord.customer_name,
          subtotal: saleRecord.subtotal,
          discount: saleRecord.discount,
          tax: saleRecord.tax,
          total: saleRecord.total,
          paid_amount: saleRecord.paid_amount,
          due_amount: saleRecord.due_amount,
          profit: saleRecord.profit,
          status: saleRecord.status,
          payment_method: saleRecord.payment_method,
          sold_by: saleRecord.sold_by,
          notes: saleRecord.notes,
          sale_date: saleRecord.sale_date,
        });

        if (saleErr) throw saleErr;

        await supabase.from('sale_items').insert(
          saleItemsRecords.map((i) => ({
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

        // Deduct stock for each cart item in Supabase
        for (const item of cart) {
          if (!item.product.is_service && item.product.stock !== null && item.product.stock !== undefined) {
            const currentStock = item.product.stock;
            const newStock = Math.max(0, currentStock - item.quantity);
            const { error: stockErr } = await supabase
              .from('products')
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq('id', item.product.id);
            if (stockErr) {
              console.warn('Could not update stock for product', item.product.id, stockErr);
            }
          }
        }

        // Update local products state
        setProducts((prev) =>
          prev.map((prod) => {
            const cartItem = cart.find((item) => item.product.id === prod.id);
            if (cartItem && !prod.is_service && prod.stock !== null && prod.stock !== undefined) {
              return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
            }
            return prod;
          })
        );

        // Also add auto entry to finance_entries for backwards compatibility & cashflow
        await supabase.from('finance_entries').insert({
          vendor_id: vendor.id,
          type: 'income',
          category: 'POS Stall Sale',
          amount: saleRecord.paid_amount,
          source: 'manual',
          entry_date: saleDate,
          notes: `Order #${saleRecord.order_no} (${saleRecord.customer_name})`,
        });
      }

      // Reset cart and open receipt
      setCart([]);
      setIsCartOpen(false);
      setCompletedSale({ sale: saleRecord, items: saleItemsRecords });
    } catch (err) {
      console.error('POS Checkout error:', err);
      // Offline fallback: enqueue offline sale
      if (typeof window !== 'undefined' && !navigator.onLine) {
        enqueueOfflineSale(saleRecord, saleItemsRecords);
        setProducts((prev) =>
          prev.map((prod) => {
            const cartItem = cart.find((item) => item.product.id === prod.id);
            if (cartItem && !prod.is_service && prod.stock !== null && prod.stock !== undefined) {
              return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
            }
            return prod;
          })
        );
        setCart([]);
        setIsCartOpen(false);
        setCompletedSale({ sale: saleRecord, items: saleItemsRecords });
        return;
      }
      alert('Failed to complete sale. Please check connection and try again.');
    } finally {
      setLoadingSale(false);
    }
  };

  const totalCartUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Header */}
      <Navbar title="Quick POS Checkout" showBack backHref="/" />

      <main className="max-w-3xl mx-auto px-4 pt-3 space-y-3">
        {/* Search & Category Chips */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products by name or SKU..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Category Filter Horizontal Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat === 'all' ? 'All Products' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid (Tap to Add) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {filteredProducts.map((product) => {
            const inCart = cart.find((c) => c.product.id === product.id);

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className={`relative flex flex-col p-3 rounded-2xl border text-left bg-white transition-all active:scale-98 min-h-[110px] justify-between ${
                  inCart
                    ? 'border-teal-500 ring-2 ring-teal-500 shadow-sm'
                    : 'border-slate-200 hover:border-teal-300'
                }`}
              >
                {/* Quantity badge if in cart */}
                {inCart && (
                  <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-white text-xs font-black shadow-xs">
                    {inCart.quantity}
                  </div>
                )}

                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                      {product.name}
                    </h3>
                  </div>
                  {product.is_sample && (
                    <span className="inline-block text-[9px] font-black uppercase text-amber-600">
                      SAMPLE
                    </span>
                  )}
                </div>

                <div className="pt-2 flex items-baseline justify-between">
                  <span className="text-xs sm:text-sm font-black text-teal-800">
                    {formatUGX(product.price)}
                  </span>
                  {!product.is_service && product.stock !== null && (
                    <span className="text-[10px] text-slate-400">
                      {product.stock} left
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-500">
            <Package className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-1" />
            <p>No products match your search.</p>
          </div>
        )}
      </main>

      {/* Sticky Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 p-3 bg-gradient-to-t from-slate-900/10 to-transparent pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-xl shadow-teal-900/30 active:scale-98 transition-all min-h-[50px]"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/20 text-xs font-black">
                  {totalCartUnits}
                </span>
                <span>Items in Cart</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-base font-black">{formatUGX(totalAmount)}</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg">View Cart</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Cart & Checkout Sheet */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsCartOpen(false)} />

          <div className="relative bg-white rounded-t-3xl border-t border-slate-200 shadow-2xl max-w-lg mx-auto w-full max-h-[88vh] flex flex-col z-10 overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Current Order Cart</h3>
                <p className="text-xs text-slate-500">{totalCartUnits} items selected</p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="overflow-y-auto p-4 space-y-2.5 flex-1 divide-y divide-slate-100">
              {cart.map(({ product, quantity }) => (
                <div key={product.id} className="pt-2 flex items-center justify-between">
                  <div className="max-w-[50%]">
                    <p className="text-xs font-bold text-slate-900 truncate">{product.name}</p>
                    <p className="text-[11px] text-teal-800 font-bold">{formatUGX(product.price)} each</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => updateQuantity(product.id, -1)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-white text-slate-700 shadow-xs"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-xs font-black">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, 1)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-white text-slate-700 shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(product.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Customer selection */}
              <div className="pt-4 space-y-2">
                <label className="block text-xs font-bold text-slate-700">Customer</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in Customer"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none"
                  />
                  {customers.length > 0 && (
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => {
                        setSelectedCustomerId(e.target.value);
                        const c = customers.find((cust) => cust.id === e.target.value);
                        if (c) setCustomerName(c.name);
                      }}
                      className="px-2 py-2 text-xs rounded-xl border border-slate-200 outline-none bg-white text-slate-700"
                    >
                      <option value="">Select Saved...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Payment Chips */}
              <div className="pt-3 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Payment Method</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_METHODS.map((m) => {
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`p-2 rounded-xl text-[11px] font-bold border transition-colors ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paid Amount & Auto-Calculated Change */}
              <div className="pt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount Paid (UGX)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-black rounded-xl border border-slate-200 outline-none"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    {changeDue > 0 ? 'Change to Return' : 'Balance Remaining'}
                  </span>
                  <span
                    className={`text-sm font-black ${
                      changeDue > 0 ? 'text-emerald-700' : balanceDue > 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {changeDue > 0 ? formatUGX(changeDue) : formatUGX(balanceDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Checkout Action Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
              <div className="flex justify-between items-baseline text-xs font-bold">
                <span className="text-slate-600">Total Due:</span>
                <span className="text-base font-black text-slate-900">{formatUGX(totalAmount)}</span>
              </div>

              <button
                type="button"
                disabled={loadingSale}
                onClick={handleCompleteSale}
                className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md shadow-teal-600/20 active:scale-98 transition-all min-h-[44px] flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span>{loadingSale ? 'Processing Sale...' : 'Complete Sale & Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable / Shareable Receipt Modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale.sale}
          items={completedSale.items}
          shopName={vendor?.business_name || 'My Market Shop'}
          shopPhone={vendor?.phone}
          shopLocation={vendor?.region}
          isOpen={Boolean(completedSale)}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </div>
  );
}
