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
  ChevronRight,
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
      className={`rounded-2xl border transition-all duration-200 bg-white p-3.5 sm:p-4 shadow-xs hover:shadow-sm ${
        product.is_active
          ? 'border-slate-200/90'
          : 'border-slate-200/60 bg-slate-50/50 opacity-90'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Left: Thumbnail with Stock / Service Badge */}
        <Link
          href={`/stall/${product.id}`}
          className="relative block w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 overflow-hidden shrink-0 group border border-slate-200/60"
        >
          {product.photo_url ? (
            <img
              src={product.photo_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2">
              <Package className="h-6 w-6 stroke-1 mb-0.5" />
              <span className="text-[9px] font-semibold text-slate-400">No photo</span>
            </div>
          )}

          {/* Sample Badge */}
          {product.is_sample && (
            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
              Sample
            </span>
          )}

          {/* Stock Badge overlay at bottom */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent p-1 text-center">
            {product.is_service ? (
              <span className="text-[9px] font-bold text-blue-200 flex items-center justify-center gap-0.5">
                <Layers className="h-2.5 w-2.5" /> Service
              </span>
            ) : product.stock !== null ? (
              <span
                className={`text-[9px] font-extrabold block truncate ${
                  isOutOfStock
                    ? 'text-rose-300'
                    : isLowStock
                    ? 'text-amber-300'
                    : 'text-white'
                }`}
              >
                {isOutOfStock ? 'Out of stock' : `${product.stock} ${product.quantity_unit || 'left'}`}
              </span>
            ) : null}
          </div>
        </Link>

        {/* Middle: Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <Link
              href={`/stall/${product.id}`}
              className="font-extrabold text-sm sm:text-base text-slate-900 truncate hover:text-teal-700 transition-colors block"
            >
              {product.name}
            </Link>

            {/* Quick active pill */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                product.is_active
                  ? 'bg-teal-50 text-teal-800 border border-teal-200/80'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  product.is_active ? 'bg-teal-500' : 'bg-slate-400'
                }`}
              />
              {product.is_active ? 'Active' : 'Draft'}
            </span>
          </div>

          {/* Category & Units */}
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
            {product.category && (
              <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                {product.category}
              </span>
            )}
            {product.sku && (
              <span className="text-slate-400 font-mono text-[10px]">
                SKU: {product.sku}
              </span>
            )}
          </div>

          {/* Price & Profit */}
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-base sm:text-lg font-black text-slate-900">
              {formatUGX(product.price)}
            </span>
            {profit > 0 && (
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/80">
                +{formatUGX(profit)} profit
              </span>
            )}
          </div>

          {/* Colors swatch if any */}
          {colors.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="flex items-center -space-x-1">
                {colors.slice(0, 4).map((color) => (
                  <span
                    key={`${color.name}-${color.hex}`}
                    className="h-3.5 w-3.5 rounded-full border border-white ring-1 ring-slate-200 shrink-0"
                    style={swatchStyle(color.hex)}
                    title={color.name}
                  />
                ))}
              </div>
              <span className="text-[10px] text-slate-400">
                {colors.length} {colors.length === 1 ? 'colour' : 'colours'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions Row */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        {/* Marketplace Visibility Toggle */}
        <button
          onClick={() => onToggleActive(product.id, product.is_active)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 min-h-[38px] active:scale-95 ${
            product.is_active
              ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
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

        {/* Edit / Delete / View details */}
        <div className="flex items-center gap-1">
          <Link
            href={`/stall/${product.id}`}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors min-h-[38px] flex items-center gap-1"
            title="View Details"
          >
            <span>Details</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => onEdit(product)}
            className="p-2 rounded-xl text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Edit product"
            aria-label="Edit product"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Delete product"
            aria-label="Delete product"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
