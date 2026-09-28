'use client';

import { useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FeatureKey, FeaturesEnabled } from '@/types/database.types';
import { supabase } from '@/lib/supabaseClient';

export interface FeatureMetadata {
  key: FeatureKey;
  tier: 2 | 3;
  title: string;
  shortDescription: string;
  exampleUseCase: string;
  iconName: string;
}

export const FEATURE_METADATA_LIST: FeatureMetadata[] = [
  // Tier 2: Growing Business Add-ons
  {
    key: 'expense',
    tier: 2,
    title: 'Expenses',
    shortDescription: 'Record everyday business costs, rent, transport, and utilities.',
    exampleUseCase: 'E.g., tracking boda-boda delivery fees or weekly market stall rental.',
    iconName: 'Receipt',
  },
  {
    key: 'income',
    tier: 2,
    title: 'Other Income',
    shortDescription: 'Log supplementary revenue streams beyond direct sales.',
    exampleUseCase: 'E.g., earning commission on agent banking or bulk delivery fees.',
    iconName: 'Wallet',
  },
  {
    key: 'suppliers',
    tier: 2,
    title: 'Suppliers Directory',
    shortDescription: 'Manage vendor contacts, payment balances, and delivery terms.',
    exampleUseCase: 'E.g., storing contacts and locations for Kalerwe fresh produce suppliers.',
    iconName: 'Truck',
  },
  {
    key: 'purchases',
    tier: 2,
    title: 'Purchases & Stock In',
    shortDescription: 'Log stock inventory restocks and supplier purchase costs.',
    exampleUseCase: 'E.g., recording a 10-crate beverage restocking delivery with invoice notes.',
    iconName: 'PackagePlus',
  },
  {
    key: 'damaged_items',
    tier: 2,
    title: 'Damaged & Lost Items',
    shortDescription: 'Track stock lost without sale (spoilage, damage, expired goods).',
    exampleUseCase: 'E.g., writing off ripe tomatoes spoiled in transit without skewing sales.',
    iconName: 'AlertOctagon',
  },
  {
    key: 'activity_log',
    tier: 2,
    title: 'Activity Log',
    shortDescription: 'Audit timeline showing who created, edited, or deleted items.',
    exampleUseCase: 'E.g., seeing when a price was edited or when a sale was updated.',
    iconName: 'History',
  },
  {
    key: 'quotations',
    tier: 2,
    title: 'Quotations / Proforma',
    shortDescription: 'Issue professional price estimates and convert directly to sales.',
    exampleUseCase: 'E.g., quoting a hotel client for weekly bulk fruit delivery before delivery.',
    iconName: 'FileText',
  },
  {
    key: 'deep_analytics',
    tier: 2,
    title: 'Deep Analytics',
    shortDescription: 'Trend lines, margins, top product volume, and performance donuts.',
    exampleUseCase: 'E.g., analyzing which products generate the most profit margin this month.',
    iconName: 'BarChart3',
  },

  // Tier 3: Multi-staff & Multi-branch
  {
    key: 'representatives',
    tier: 3,
    title: 'Representatives / Staff',
    shortDescription: 'Staff accounts with custom permission controls and sales attribution.',
    exampleUseCase: 'E.g., cashiers recording sales without seeing business profit or cost prices.',
    iconName: 'Users',
  },
  {
    key: 'multi_store',
    tier: 3,
    title: 'Multi-Store & Branches',
    shortDescription: 'Manage inventory across multiple stalls or shop branches.',
    exampleUseCase: 'E.g., managing inventory separately for Downtown vs Kalerwe branch.',
    iconName: 'Store',
  },
  {
    key: 'stock_transfer',
    tier: 3,
    title: 'Stock Transfer',
    shortDescription: 'Transfer items between shop branches with real-time tracking.',
    exampleUseCase: 'E.g., moving 20 bags of flour from main warehouse to branch stall.',
    iconName: 'ArrowLeftRight',
  },
];

/**
 * Client-side hook for checking and toggling feature flags.
 */
export function useFeature(key: FeatureKey) {
  const { vendor, isDemo, refreshVendor } = useAuth();

  // Read flag from vendor profile (or localStorage in demo mode)
  const isEnabled = useMemo(() => {
    if (!vendor) return false;

    if (isDemo && typeof window !== 'undefined') {
      const demoFlags = localStorage.getItem('quonnect_demo_features');
      if (demoFlags) {
        try {
          const parsed = JSON.parse(demoFlags) as FeaturesEnabled;
          if (parsed[key] !== undefined) return Boolean(parsed[key]);
        } catch {
          // ignore error
        }
      }
    }

    const flags = (vendor.features_enabled || {}) as FeaturesEnabled;
    return Boolean(flags[key]);
  }, [vendor, isDemo, key]);

  // Toggle or set a specific feature state
  const setFeature = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      if (!vendor) return false;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const demoFlagsStr = localStorage.getItem('quonnect_demo_features');
          let current: FeaturesEnabled = {};
          try {
            if (demoFlagsStr) current = JSON.parse(demoFlagsStr);
          } catch {
            current = {};
          }
          current[key] = enabled;
          localStorage.setItem('quonnect_demo_features', JSON.stringify(current));
          await refreshVendor();
          return true;
        }
        return false;
      }

      try {
        const currentFlags = (vendor.features_enabled || {}) as FeaturesEnabled;
        const updatedFlags: FeaturesEnabled = {
          ...currentFlags,
          [key]: enabled,
        };

        const { error } = await supabase
          .from('vendors')
          .update({
            features_enabled: updatedFlags,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vendor.id);

        if (error) {
          console.error(`Failed to update feature ${key}:`, error.message);
          return false;
        }

        await refreshVendor();
        return true;
      } catch (err) {
        console.error(`Error toggling feature ${key}:`, err);
        return false;
      }
    },
    [vendor, isDemo, key, refreshVendor]
  );

  return {
    isEnabled,
    enable: () => setFeature(true),
    disable: () => setFeature(false),
    toggle: () => setFeature(!isEnabled),
  };
}

/**
 * Hook to retrieve all feature states at once.
 */
export function useAllFeatures() {
  const { vendor, isDemo, refreshVendor } = useAuth();

  const features = useMemo<FeaturesEnabled>(() => {
    if (!vendor) return {};

    if (isDemo && typeof window !== 'undefined') {
      const demoFlags = localStorage.getItem('quonnect_demo_features');
      if (demoFlags) {
        try {
          return JSON.parse(demoFlags) as FeaturesEnabled;
        } catch {
          return {};
        }
      }
    }

    return (vendor.features_enabled || {}) as FeaturesEnabled;
  }, [vendor, isDemo]);

  const toggleFeature = useCallback(
    async (key: FeatureKey, enabled: boolean): Promise<boolean> => {
      if (!vendor) return false;

      if (isDemo) {
        if (typeof window !== 'undefined') {
          const updated: FeaturesEnabled = { ...features, [key]: enabled };
          localStorage.setItem('quonnect_demo_features', JSON.stringify(updated));
          await refreshVendor();
          return true;
        }
        return false;
      }

      try {
        const updatedFlags: FeaturesEnabled = {
          ...features,
          [key]: enabled,
        };

        const { error } = await supabase
          .from('vendors')
          .update({
            features_enabled: updatedFlags,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vendor.id);

        if (error) {
          console.error(`Failed to update feature ${key}:`, error);
          return false;
        }

        await refreshVendor();
        return true;
      } catch (err) {
        console.error(`Error toggling feature ${key}:`, err);
        return false;
      }
    },
    [vendor, isDemo, features, refreshVendor]
  );

  return {
    features,
    toggleFeature,
    metadataList: FEATURE_METADATA_LIST,
  };
}
