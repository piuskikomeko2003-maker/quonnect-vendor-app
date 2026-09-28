'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Check,
  Camera,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Tag,
  DollarSign,
  Package,
  Layers,
  PaintBucket,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Product, ProductColor } from '@/types/database.types';
import { formatUGX } from '@/lib/formatters';
import { uploadProductPhotoWithRetry } from '@/lib/storage';
import { normalizeColors } from '@/lib/productColors';
import { ColorPicker } from '@/components/stall/ColorPicker';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  isDemo: boolean;
  editingProduct?: Product | null;
  onProductSaved: (product: Product, isNew: boolean) => void;
}

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  vendorId,
  isDemo,
  editingProduct,
  onProductSaved,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core required fields
  const [name, setName] = useState(editingProduct?.name ?? '');
  const [isService, setIsService] = useState(editingProduct?.is_service ?? false);
  const [price, setPrice] = useState(editingProduct ? String(editingProduct.price) : '');
  const [cost, setCost] = useState(editingProduct && editingProduct.cost !== undefined ? String(editingProduct.cost) : '');
  const [stock, setStock] = useState(editingProduct && editingProduct.stock !== null ? String(editingProduct.stock) : '10');
  const [minStockAlert, setMinStockAlert] = useState(editingProduct && editingProduct.min_stock_alert !== undefined ? String(editingProduct.min_stock_alert) : '3');
  const [isActive, setIsActive] = useState(editingProduct?.is_active ?? true);

  // Collapsible: More options
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [category, setCategory] = useState(editingProduct?.category ?? '');
  const [quantityUnit, setQuantityUnit] = useState(editingProduct?.quantity_unit ?? 'unit');
  const [sku, setSku] = useState(editingProduct?.sku ?? '');
  const [barcode, setBarcode] = useState(editingProduct?.barcode ?? '');
  const [expiryDate, setExpiryDate] = useState(editingProduct?.expiry_date ?? '');
  const [description, setDescription] = useState(editingProduct?.description ?? '');

  // Collapsible: Product images
  const [showImageSection, setShowImageSection] = useState(Boolean(editingProduct?.photo_url));
  const photoUrl = editingProduct?.photo_url ?? null;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editingProduct?.photo_url ?? null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Collapsible: Available colours
  const [showColorSection, setShowColorSection] = useState(
    normalizeColors(editingProduct?.colors).length > 0
  );
  const [colors, setColors] = useState<ProductColor[]>(normalizeColors(editingProduct?.colors));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Live profit calculation
  const numericPrice = parseFloat(price) || 0;
  const numericCost = parseFloat(cost) || 0;
  const profitPerUnit = numericPrice - numericCost;
  const marginPercent = numericPrice > 0 ? Math.round((profitPerUnit / numericPrice) * 100) : 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Please select an image smaller than 5MB.');
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a product title.');
      return;
    }

    if (isNaN(numericPrice) || numericPrice < 0) {
      setError('Please enter a valid selling price in UGX.');
      return;
    }

    const numericStock = isService ? null : parseInt(stock, 10);
    if (!isService && (isNaN(numericStock as number) || (numericStock as number) < 0)) {
      setError('Please enter a valid stock quantity.');
      return;
    }

    setLoading(true);

    try {
      const productId = editingProduct?.id || (isDemo ? `demo-prod-${Date.now()}` : crypto.randomUUID());
      let finalPhotoUrl = photoUrl;

      // Handle image upload if new file chosen
      if (selectedFile) {
        setUploadStatus('Uploading photo...');
        const uploadRes = await uploadProductPhotoWithRetry(
          selectedFile,
          vendorId,
          productId,
          3,
          isDemo
        );

        if (uploadRes.error) {
          console.warn('Image upload issue:', uploadRes.error);
        } else if (uploadRes.url) {
          finalPhotoUrl = uploadRes.url;
        }
      }

      const productPayload: Product = {
        id: productId,
        vendor_id: vendorId,
        name: name.trim(),
        description: description.trim() || null,
        price: numericPrice,
        cost: numericCost,
        photo_url: finalPhotoUrl,
        stock: numericStock,
        is_service: isService,
        min_stock_alert: parseInt(minStockAlert, 10) || 3,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        expiry_date: expiryDate || null,
        category: category.trim() || null,
        quantity_unit: quantityUnit.trim() || 'unit',
        is_sample: editingProduct?.is_sample ?? false,
        colors,
        is_active: isActive,
        created_at: editingProduct?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      if (isDemo) {
        onProductSaved(productPayload, !editingProduct);
        onClose();
      } else {
        if (editingProduct) {
          const { data, error: updateError } = await supabase
            .from('products')
            .update({
              name: productPayload.name,
              description: productPayload.description,
              price: productPayload.price,
              cost: productPayload.cost,
              photo_url: productPayload.photo_url,
              stock: productPayload.stock,
              is_service: productPayload.is_service,
              min_stock_alert: productPayload.min_stock_alert,
              sku: productPayload.sku,
              barcode: productPayload.barcode,
              expiry_date: productPayload.expiry_date,
              category: productPayload.category,
              quantity_unit: productPayload.quantity_unit,
              colors: productPayload.colors,
              is_active: productPayload.is_active,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingProduct.id)
            .select()
            .single();

          if (updateError) throw updateError;
          if (data) {
            onProductSaved(data as Product, false);
            onClose();
          }
        } else {
          const { data, error: insertError } = await supabase
            .from('products')
            .insert({
              id: productPayload.id,
              vendor_id: vendorId,
              name: productPayload.name,
              description: productPayload.description,
              price: productPayload.price,
              cost: productPayload.cost,
              photo_url: productPayload.photo_url,
              stock: productPayload.stock,
              is_service: productPayload.is_service,
              min_stock_alert: productPayload.min_stock_alert,
              sku: productPayload.sku,
              barcode: productPayload.barcode,
              expiry_date: productPayload.expiry_date,
              category: productPayload.category,
              quantity_unit: productPayload.quantity_unit,
              colors: productPayload.colors,
              is_sample: false,
              is_active: productPayload.is_active,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          if (data) {
            onProductSaved(data as Product, true);
            onClose();
          }
        }
      }
    } catch (err) {
      console.error('Save product error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-label="Close modal overlay" />

      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col z-10 overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <p className="text-xs text-slate-500">
              {isService ? 'Service offering' : 'Physical inventory item'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Product Title / Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fresh Red Tomatoes, Cotton Shirt, Rolex"
              className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>

          {/* "This is a service" toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-900">This is a service</p>
              <p className="text-[11px] text-slate-500">Hides stock quantity tracking (e.g. salon, repair)</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isService}
              onClick={() => setIsService(!isService)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                isService ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isService ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Pricing & Profit Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selling Price (UGX) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25,000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cost Price (UGX) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="18,000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Live Profit Per Unit Preview */}
          <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl flex items-center justify-between text-xs">
            <span className="text-teal-900 font-medium">Profit per unit:</span>
            <div className="flex items-center gap-2">
              <span className={`font-black ${profitPerUnit >= 0 ? 'text-teal-900' : 'text-rose-600'}`}>
                {formatUGX(profitPerUnit)}
              </span>
              {numericPrice > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-600 text-white">
                  {marginPercent}% margin
                </span>
              )}
            </div>
          </div>

          {/* Stock Tracking (Hidden if isService is true) */}
          {!isService && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Stock
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="10"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Low Stock Alert
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minStockAlert}
                  onChange={(e) => setMinStockAlert(e.target.value)}
                  placeholder="3"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Collapsible Section 1: More Options */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="text-xs font-bold text-slate-800">
                More Details (Category, Unit, SKU, Expiry)
              </span>
              {showMoreOptions ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {showMoreOptions && (
              <div className="p-4 space-y-3 bg-white border-t border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g. Vegetables, Snacks"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quantity Unit
                    </label>
                    <select
                      value={quantityUnit}
                      onChange={(e) => setQuantityUnit(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 outline-none"
                    >
                      <option value="unit">unit / piece</option>
                      <option value="kg">kg (kilogram)</option>
                      <option value="litre">litre</option>
                      <option value="basin">basin / heap</option>
                      <option value="bag">bag / sack</option>
                      <option value="carton">carton / box</option>
                      <option value="session">service session</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      SKU Code
                    </label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="e.g. TOM-001"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Barcode
                    </label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Scan or type barcode"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description for receipt and marketplace stall..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Section 2: Product Images */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowImageSection(!showImageSection)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="text-xs font-bold text-slate-800">
                Product Image (800x800 recommended)
              </span>
              {showImageSection ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {showImageSection && (
              <div className="p-4 bg-white border-t border-slate-200">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 w-20 rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 flex flex-col items-center justify-center cursor-pointer overflow-hidden shrink-0"
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-6 w-6 text-slate-400" />
                    )}
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 font-bold border border-teal-200"
                    >
                      {imagePreview ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    <p className="text-[10px] text-slate-400">Compressed automatically before upload</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Section 3: Available Colours */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowColorSection(!showColorSection)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="text-xs font-bold text-slate-800 inline-flex items-center gap-2">
                <PaintBucket className="h-4 w-4 text-teal-600" />
                Available Colours
                {colors.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black">
                    {colors.length}
                  </span>
                )}
              </span>
              {showColorSection ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </button>

            {showColorSection && (
              <div className="p-4 bg-white border-t border-slate-200">
                <ColorPicker value={colors} onChange={setColors} />
              </div>
            )}
          </div>

          {/* Active on Marketplace Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-900">Show on Marketplace Stall</p>
              <p className="text-[11px] text-slate-500">Allow customers to discover and order this product</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                isActive ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sticky Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-md shadow-teal-600/20 active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              <span>{loading ? 'Saving Product...' : editingProduct ? 'Update Product' : 'Save Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
