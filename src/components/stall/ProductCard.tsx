'use client';

import React from 'react';
import Link from 'next/link';
import { Product } from '@/types/database.types';
import { formatUGX } from '@/lib/formatters';
import { normalizeColors } from '@/lib/productColors';
import { swatchStyle } from '@/components/stall/ColorPicker';
import {
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Package,
  AlertTriangle,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const isOutOfStock = !product.is_service && product.stock !== null && product.stock <= 0;
  const isLowStock =
    !product.is_service &&
    product.stock !== null &&
    product.stock > 0 &&
    product.stock <= (product.min_stock_alert || 5);

  const profit = (product.price || 0) - (product.cost || 0);
  const colors = normalizeColors(product.colors);

  return (
    <div
      className={`group rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col bg-white ${
        product.is_active
          ? 'border-slate-200/90 shadow-xs hover:shadow-md hover:border-teal-300'
          : 'border-slate-200/60 opacity-85 hover:opacity-100'
      }`}
    >
      {/* Photo Container */}
      <Link
        href={`/stall/${product.id}`}
        className="relative block aspect-[4/3] w-full bg-slate-100 overflow-hidden"
      >
        {product.photo_url ? (
          <img
            src={product.photo_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4">
            <Package className="h-10 w-10 mb-1 stroke-1" />
            <span className="text-[11px] font-semibold">No photo uploaded</span>
          </div>
        )}

        {/* SAMPLE Badge */}
        {product.is_sample && (
          <div className="absolute top-3 left-3 z-10">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
              SAMPLE
            </span>
          </div>
        )}

        {/* Stock / Service Badge Overlay */}
        <div className="absolute top-3 right-3 z-10">
          {product.is_service ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs backdrop-blur-md">
              <Layers className="h-3 w-3" />
              <span>Service</span>
            </span>
          ) : product.stock !== null ? (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs backdrop-blur-md ${
                isOutOfStock
                  ? 'bg-rose-600 text-white'
                  : isLowStock
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900/80 text-white'
              }`}
            >
              {isOutOfStock ? (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  <span>Out of stock</span>
                </>
              ) : isLowStock ? (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  <span>Low: {product.stock} {product.quantity_unit || 'left'}</span>
                </>
              ) : (
                <span>{product.stock} {product.quantity_unit || 'units'}</span>
              )}
            </span>
          ) : null}
        </div>
      </Link>

      {/* Product Details */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/stall/${product.id}`}
              className="font-bold text-sm sm:text-base text-slate-900 line-clamp-1 group-hover:text-teal-700 transition-colors"
            >
              {product.name}
            </Link>
          </div>

          {product.category && (
            <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {product.category}
            </span>
          )}

          {product.description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}

          {colors.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex items-center -space-x-1.5">
                {colors.slice(0, 5).map((color) => (
                  <span
                    key={`${color.name}-${color.hex}`}
                    className="h-4 w-4 rounded-full border border-white ring-1 ring-slate-200"
                    style={swatchStyle(color.hex)}
                    title={color.name}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                {colors.length} {colors.length === 1 ? 'colour' : 'colours'}
              </span>
            </div>
          )}

          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-base sm:text-lg font-black text-slate-900">
              {formatUGX(product.price)}
            </span>

            {profit > 0 && (
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                +{formatUGX(profit)} profit
              </span>
            )}
          </div>
        </div>

        {/* Controls Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Marketplace Visibility Toggle Button */}
          <button
            onClick={() => onToggleActive(product.id, product.is_active)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 min-h-[36px] ${
              product.is_active
                ? 'border-teal-200 bg-teal-50 text-teal-800'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
            title="Toggle visibility on Quonnect Marketplace"
          >
            {product.is_active ? (
              <Eye className="h-3.5 w-3.5 text-teal-600" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span>{product.is_active ? 'Marketplace' : 'Hidden'}</span>
          </button>

          {/* Edit / Delete actions with minimum touch targets */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(product)}
              className="p-2.5 rounded-xl text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Edit product"
              aria-label="Edit product"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(product.id)}
              className="p-2.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Delete product"
              aria-label="Delete product"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
