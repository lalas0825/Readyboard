'use client';

/**
 * LiveIndicator — pulsing green dot shown in the top-right bar.
 * Indicates the dashboard is receiving live data from Supabase Realtime.
 */

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export function LiveIndicator() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Use a heartbeat channel to track realtime connectivity
    const channel = supabase.channel('live-heartbeat');

    channel
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium">
      <span
        className={`relative flex h-2 w-2 ${connected ? 'text-emerald-400' : 'text-zinc-500'}`}
      >
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            connected ? 'bg-emerald-400' : 'bg-zinc-500'
          }`}
        />
      </span>
      <span className={connected ? 'text-emerald-400' : 'text-zinc-500'}>
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}
