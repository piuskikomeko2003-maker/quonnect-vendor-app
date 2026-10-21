import { ProductColor } from '@/types/database.types';

export const PRODUCT_COLOR_PRESETS: ProductColor[] = [
  { name: 'Black', hex: '#111827' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Grey', hex: '#9ca3af' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Brown', hex: '#92400e' },
  { name: 'Gold', hex: '#d4af37' },
  { name: 'Beige', hex: '#e7dbC8' },
  { name: 'Multi', hex: 'linear-gradient(135deg,#ef4444,#facc15,#22c55e,#3b82f6)' },
];

export function colorKey(color: ProductColor): string {
  return `${color.name.trim().toLowerCase()}|${color.hex.trim().toLowerCase()}`;
}

export function isGradient(hex: string): boolean {
  return hex.includes('gradient');
}

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(hex: string): boolean {
  return HEX_PATTERN.test(hex.trim());
}

export function normalizeColors(value: unknown): ProductColor[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Partial<ProductColor> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : 'Colour',
      hex: typeof item.hex === 'string' && item.hex ? item.hex : '#9ca3af',
    }));
}
