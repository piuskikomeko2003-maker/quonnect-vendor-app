'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Vendor } from '@/types/database.types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  vendor: Vendor | null;
  loading: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
  enableDemoMode: () => void;
  refreshVendor: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_VENDOR: Vendor = {
  id: 'demo-vendor-0001',
  user_id: 'demo-user-0001',
  business_name: 'My Shop',
  category: 'General Retail',
  region: 'Kampala',
  phone: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const isDemoFlagSet = () =>
  typeof window !== 'undefined' && localStorage.getItem('quonnect_demo_mode') === 'true';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Tracks which user's profile is already loaded so repeated auth events
  // (SIGNED_IN, TOKEN_REFRESHED, tab refocus) don't refetch it.
  const loadedUserId = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Purge old mock data on first load so user starts completely clean
    if (typeof window !== 'undefined' && !localStorage.getItem('quonnect_data_cleared_v2')) {
      localStorage.removeItem('quonnect_demo_products');
      localStorage.removeItem('quonnect_demo_customers');
      localStorage.removeItem('quonnect_demo_sales');
      localStorage.removeItem('quonnect_demo_entries');
      localStorage.removeItem('quonnect_demo_bookings');
      localStorage.removeItem('quonnect_onboarding_completed');
      localStorage.removeItem('quonnect_first_sale_done');
      localStorage.removeItem('quonnect_demo_mode');
      localStorage.setItem('quonnect_data_cleared_v2', 'true');
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchVendorProfile = useCallback(async (userId: string) => {
    if (loadedUserId.current === userId) return;
    loadedUserId.current = userId;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching vendor profile:', error.message);
        loadedUserId.current = null;
        return;
      }
      if (mountedRef.current) setVendor(data ?? null);
    } catch (err) {
      console.error('Unexpected error fetching vendor:', err);
      loadedUserId.current = null;
    }
  }, []);

  useEffect(() => {
    const applySession = (event: string, session: { user: User } | null) => {
      if (!mountedRef.current) return;

      // Explicit sign-out should return to the login screen, not demo mode.
      if (event === 'SIGNED_OUT') {
        loadedUserId.current = null;
        setUser(null);
        setVendor(null);
        setIsDemo(false);
        setLoading(false);
        return;
      }

      if (session?.user && !isDemoFlagSet()) {
        setUser(session.user);
        setIsDemo(false);
        if (typeof window !== 'undefined') localStorage.removeItem('quonnect_demo_mode');

        // Fetch the profile in the background. The dashboard shell can render
        // immediately; the auth callback stays quick so later events aren't blocked.
        void fetchVendorProfile(session.user.id).finally(() => {
          if (mountedRef.current) setLoading(false);
        });
        return;
      }

      // No real session (or the user explicitly chose demo) -> zero-friction demo.
      setUser(null);
      setIsDemo(true);
      setVendor(DEMO_VENDOR);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(event, session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchVendorProfile]);

  const refreshVendor = useCallback(async () => {
    if (isDemo || !user) return;
    loadedUserId.current = null;
    await fetchVendorProfile(user.id);
  }, [isDemo, user, fetchVendorProfile]);

  const enableDemoMode = useCallback(() => {
    loadedUserId.current = null;
    setIsDemo(true);
    setUser(null);
    setVendor(DEMO_VENDOR);
    if (typeof window !== 'undefined') localStorage.setItem('quonnect_demo_mode', 'true');
  }, []);

  const signOut = useCallback(async () => {
    loadedUserId.current = null;

    if (isDemo) {
      setIsDemo(false);
      setVendor(null);
      if (typeof window !== 'undefined') localStorage.removeItem('quonnect_demo_mode');
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setVendor(null);
  }, [isDemo]);

  const value = useMemo(
    () => ({
      user,
      vendor,
      loading,
      isDemo,
      signOut,
      enableDemoMode,
      refreshVendor,
    }),
    [user, vendor, loading, isDemo, signOut, enableDemoMode, refreshVendor]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
