import type { Vendor } from "@/types/app-db";

/**
 * Central capability check.
 *
 * Stage 1 features are on by default for existing vendors so this helper is
 * safe to introduce before the feature-flag migration. New vendors will be
 * seeded with NEW_VENDOR_FEATURES by the signup trigger in a later migration.
 */
export const STAGE1_CORE_FEATURES = ["home", "sales", "stock", "money"] as const;
export const STAGE1_OPTIONAL_FEATURES = [
  "customers",
  "suppliers",
  "budgets",
  "accounts",
  "analytics",
  "insights",
] as const;
export const STAGE2_FEATURES = [
  "staff",
  "purchasing",
  "advanced_inventory",
  "advanced_reports",
] as const;
export const STAGE3_FEATURES = ["branches", "accounting", "governance"] as const;

export const FEATURE_KEYS = [
  ...STAGE1_CORE_FEATURES,
  ...STAGE1_OPTIONAL_FEATURES,
  ...STAGE2_FEATURES,
  ...STAGE3_FEATURES,
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureFlags = Partial<Record<FeatureKey, boolean>>;

function flagsFor(keys: readonly FeatureKey[], value: boolean): FeatureFlags {
  return Object.fromEntries(keys.map((key) => [key, value])) as FeatureFlags;
}

/** Existing vendors keep every Stage 1 feature they already use. */
export const EXISTING_VENDOR_FEATURES: FeatureFlags = {
  ...flagsFor(STAGE1_CORE_FEATURES, true),
  ...flagsFor(STAGE1_OPTIONAL_FEATURES, true),
  ...flagsFor(STAGE2_FEATURES, false),
  ...flagsFor(STAGE3_FEATURES, false),
};

/** New vendors start with the four core screens and opt into the rest. */
export const NEW_VENDOR_FEATURES: FeatureFlags = {
  ...flagsFor(STAGE1_CORE_FEATURES, true),
  ...flagsFor(STAGE1_OPTIONAL_FEATURES, false),
  ...flagsFor(STAGE2_FEATURES, false),
  ...flagsFor(STAGE3_FEATURES, false),
};

function readFlags(value: unknown): FeatureFlags {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as FeatureFlags;
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

/**
 * Explicit `features_enabled` wins. Missing flags fall back to the existing
 * vendor defaults so an unmigrated database does not hide working screens.
 */
export function hasFeature(
  vendor: Pick<Vendor, "features_enabled"> | null | undefined,
  key: FeatureKey,
): boolean {
  const flags = readFlags(vendor?.features_enabled);
  const explicit = flags[key];
  if (typeof explicit === "boolean") return explicit;
  return EXISTING_VENDOR_FEATURES[key] === true;
}

/**
 * Merge defaults with stored flags without ever turning an explicit flag off
 * by accident. Used by the signup trigger/migration when seeding new vendors.
 */
export function mergeFeatureDefaults(
  stored: unknown,
  defaults: FeatureFlags = EXISTING_VENDOR_FEATURES,
): FeatureFlags {
  return { ...defaults, ...readFlags(stored) };
}

export function enabledFeatures(
  vendor: Pick<Vendor, "features_enabled"> | null | undefined,
): FeatureKey[] {
  return FEATURE_KEYS.filter((key) => hasFeature(vendor, key));
}
