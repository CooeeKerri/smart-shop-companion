import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionInfo {
  tier: string;
  scansUsed: number;
  scanLimit: number;
  scansRemaining: number;
  isPremium: boolean;
  loading: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [info, setInfo] = useState<SubscriptionInfo>({
    tier: 'free',
    scansUsed: 0,
    scanLimit: 3,
    scansRemaining: 3,
    isPremium: false,
    loading: true,
  });

  useEffect(() => {
    if (!user) return;
    loadInfo();
  }, [user]);

  const loadInfo = async () => {
    try {
      const { data, error } = await supabase.rpc('get_subscription_info');
      if (error) throw error;
      const d = data as any;
      setInfo({
        tier: d.tier,
        scansUsed: d.scans_used,
        scanLimit: d.scan_limit,
        scansRemaining: d.scans_remaining,
        isPremium: d.is_premium,
        loading: false,
      });
    } catch (e) {
      console.error('Subscription load error:', e);
      setInfo((prev) => ({ ...prev, loading: false }));
    }
  };

  const checkAndIncrementScan = async (): Promise<{ allowed: boolean; remaining: number }> => {
    try {
      const { data, error } = await supabase.rpc('check_and_increment_scan');
      if (error) throw error;
      const d = data as any;
      setInfo((prev) => ({
        ...prev,
        scansUsed: prev.scanLimit - d.remaining - (d.allowed ? 1 : 0),
        scansRemaining: d.remaining,
      }));
      return { allowed: d.allowed, remaining: d.remaining };
    } catch (e) {
      console.error('Scan check error:', e);
      return { allowed: true, remaining: 0 }; // Fail open
    }
  };

  return { ...info, checkAndIncrementScan, refresh: loadInfo };
};
