'use client';

import React, { useState, useEffect } from 'react';
import {
  getOfflineSalesQueue,
  syncOfflineSalesQueue,
  OfflineSaleQueueItem,
} from '@/lib/offlineQueue';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

export const OfflineSyncIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedItems, setQueuedItems] = useState<OfflineSaleQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    setQueuedItems(getOfflineSalesQueue());

    const handleOnline = async () => {
      setIsOnline(true);
      const queue = getOfflineSalesQueue();
      if (queue.length > 0) {
        setIsSyncing(true);
        const { syncedCount } = await syncOfflineSalesQueue();
        setIsSyncing(false);
        setQueuedItems(getOfflineSalesQueue());
        if (syncedCount > 0) {
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 4000);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setQueuedItems(getOfflineSalesQueue());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      setQueuedItems(getOfflineSalesQueue());
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const { syncedCount } = await syncOfflineSalesQueue();
    setIsSyncing(false);
    setQueuedItems(getOfflineSalesQueue());
    if (syncedCount > 0) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 4000);
    }
  };

  if (isOnline && queuedItems.length === 0 && !justSynced) {
    return null;
  }

  return (
    <aside
      aria-label="Offline Sync Status"
      className="fixed top-16 left-0 right-0 z-40 bg-amber-500 text-white px-4 py-2 text-xs font-bold shadow-md flex items-center justify-between animate-in slide-in-from-top duration-200"
    >
      <div className="flex items-center gap-2 max-w-sm">
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>Offline mode active. Sales will queue safely and sync when reconnected.</span>
          </>
        ) : justSynced ? (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-100" />
            <span>Offline sales successfully synchronized to Supabase!</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 shrink-0" />
            <span>{queuedItems.length} queued offline sales ready to upload.</span>
          </>
        )}
      </div>

      {isOnline && queuedItems.length > 0 && (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-black transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      )}
    </aside>
  );
};
