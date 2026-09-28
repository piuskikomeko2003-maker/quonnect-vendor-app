'use client';

import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { ProductColor } from '@/types/database.types';
import {
  PRODUCT_COLOR_PRESETS,
  colorKey,
  isGradient,
  isValidHex,
} from '@/lib/productColors';

interface ColorPickerProps {
  value: ProductColor[];
  onChange: (colors: ProductColor[]) => void;
}

export function swatchStyle(hex: string): React.CSSProperties {
  return isGradient(hex) ? { background: hex } : { backgroundColor: hex };
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customHex, setCustomHex] = useState('#1f2937');
  const [error, setError] = useState<string | null>(null);

  const isSelected = (color: ProductColor) =>
    value.some((c) => colorKey(c) === colorKey(color));

  const togglePreset = (preset: ProductColor) => {
    setError(null);
    if (isSelected(preset)) {
      onChange(value.filter((c) => colorKey(c) !== colorKey(preset)));
    } else {
      onChange([...value, preset]);
    }
  };

  const addCustom = () => {
    const name = customName.trim();
    const hex = customHex.trim();

    if (!name) {
      setError('Give the colour a name.');
      return;
    }
    if (!isValidHex(hex) && !isGradient(hex)) {
      setError('Enter a valid hex code, e.g. #ff5733.');
      return;
    }
    if (isSelected({ name, hex })) {
      setError('That colour is already added.');
      return;
    }

    onChange([...value, { name, hex }]);
    setCustomName('');
    setCustomHex('#1f2937');
    setError(null);
    setShowCustom(false);
  };

  return (
    <div className="space-y-3">
      {/* Selected colours */}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((color) => (
            <span
              key={colorKey(color)}
              className="inline-flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-full bg-white border border-slate-200 shadow-xs"
            >
              <span
                className="h-5 w-5 rounded-full border border-slate-200 shadow-inner"
                style={swatchStyle(color.hex)}
              />
              <span className="text-xs font-bold text-slate-700">{color.name}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => colorKey(c) !== colorKey(color)))}
                className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                aria-label={`Remove ${color.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          No colours yet. Tap a swatch below or add a custom colour.
        </p>
      )}

      {/* Preset palette */}
      <div className="flex flex-wrap gap-2">
        {PRODUCT_COLOR_PRESETS.map((preset) => {
          const selected = isSelected(preset);
          return (
            <button
              key={colorKey(preset)}
              type="button"
              onClick={() => togglePreset(preset)}
              title={preset.name}
              className={`relative h-8 w-8 rounded-full border transition-all active:scale-90 ${
                selected
                  ? 'border-teal-600 ring-2 ring-teal-500/40'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
              style={swatchStyle(preset.hex)}
              aria-label={preset.name}
              aria-pressed={selected}
            >
              {selected && (
                <Check
                  className={`absolute inset-0 m-auto h-4 w-4 ${
                    preset.hex === '#ffffff' || preset.hex === '#facc15' || preset.hex === '#e7dbC8'
                      ? 'text-slate-900'
                      : 'text-white'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Custom colour */}
      {showCustom ? (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Colour name e.g. Maroon"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="color"
              value={isValidHex(customHex) ? customHex : '#1f2937'}
              onChange={(e) => setCustomHex(e.target.value)}
              className="h-9 w-10 rounded-lg border border-slate-200 bg-white cursor-pointer"
              aria-label="Pick custom colour"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              placeholder="#1f2937"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="button"
              onClick={addCustom}
              className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustom(false);
                setError(null);
              }}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add custom colour</span>
        </button>
      )}

      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
    </div>
  );
};
