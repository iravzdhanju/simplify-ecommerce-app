'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSupabaseClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface BroadcastPayload {
  message: string;
}

export function RealtimeToast() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();

  useEffect(() => {
    if (!userId || !supabase) return;

    const channel = supabase.channel(`notifications:${userId}`, {
      config: {
        broadcast: {
          self: true
        }
      }
    });

    channel
      .on(
        'broadcast',
        { event: 'product:update' },
        ({ payload }: { payload: BroadcastPayload }) => {
          toast.info(payload.message);
        }
      )
      .subscribe(
        (
          status:
            | `${`${'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'}`}`
            | 'CONNECTING'
        ) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime channel subscribed');
          }
        }
      );

    // Cleanup function to remove the channel subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  return null; // This component does not render anything
}
