import { supabase } from '@/lib/supabaseClient';
import { FeatureKey, FeaturesEnabled } from '@/types/database.types';

/**
 * Server-side helper to check if a specific vendor/shop has a feature enabled.
 * Useful in Next.js Server Components, Server Actions, or Route Handlers.
 */
export async function hasFeature(vendorId: string, key: FeatureKey): Promise<boolean> {
  if (!vendorId) return false;

  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('features_enabled')
      .eq('id', vendorId)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    const flags = (data.features_enabled || {}) as FeaturesEnabled;
    return Boolean(flags[key]);
  } catch (err) {
    console.error(`Server error checking feature ${key} for vendor ${vendorId}:`, err);
    return false;
  }
}

/**
 * Server-side helper to get all enabled features for a vendor.
 */
export async function getVendorFeatures(vendorId: string): Promise<FeaturesEnabled> {
  if (!vendorId) return {};

  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('features_enabled')
      .eq('id', vendorId)
      .maybeSingle();

    if (error || !data) {
      return {};
    }

    return (data.features_enabled || {}) as FeaturesEnabled;
  } catch (err) {
    console.error(`Server error fetching features for vendor ${vendorId}:`, err);
    return {};
  }
}
