"use client";

import { useEffect, useRef, useState } from "react";
import { userMessage } from "@/lib/errors";

const listeners = new Set<() => void>();

/**
 * Tells every mounted page to reload its Supabase data. Mutations call this
 * instead of the old `revalidatePath`, so the web build and the bundled mobile
 * build behave the same.
 */
export function refreshAppData() {
  listeners.forEach((listener) => listener());
}

/** Subscribe to refreshAppData() calls, e.g. to reload the vendor profile. */
export function subscribeAppData(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Runs a client-side loader on mount, when `key` changes, and after any
 * mutation calls refreshAppData(). Loader errors are surfaced instead of
 * crashing the screen.
 */
export function useAppData<T>(key: string, loader: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [reload, setReload] = useState(0);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    const bump = () => setReload((value) => value + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    let active = true;
    loaderRef
      .current()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((cause) => {
        if (!active) return;
        console.error("[data] load failed:", cause);
        setState({
          data: null,
          error: userMessage(cause, "Could not load this page. Check your connection and try again."),
          loading: false,
        });
      });
    return () => {
      active = false;
    };
  }, [key, reload]);

  return state;
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
