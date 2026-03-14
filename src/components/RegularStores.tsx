import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, ShoppingCart, DollarSign } from 'lucide-react';

interface StoreStats {
  name: string;
  visitCount: number;
  totalSpent: number;
  avgSpend: number;
  lastVisit: string;
}

const RegularStores = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadStores();
  }, [user]);

  const loadStores = async () => {
    const { data } = await supabase
      .from('receipts')
      .select('store_name, total_amount, shop_date, created_at')
      .eq('user_id', user!.id)
      .in('status', ['confirmed', 'reviewed'])
      .not('store_name', 'is', null);

    if (!data || data.length === 0) {
      setLoading(false);
      return;
    }

    const map: Record<string, { visits: number; total: number; lastDate: string }> = {};
    for (const r of data) {
      const name = (r.store_name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const date = r.shop_date || r.created_at;
      if (!map[key]) {
        map[key] = { visits: 0, total: 0, lastDate: date };
      }
      map[key].visits += 1;
      map[key].total += Number(r.total_amount) || 0;
      if (date > map[key].lastDate) map[key].lastDate = date;
      // keep original casing from first occurrence
      if (map[key].visits === 1) map[key] = { ...map[key], ...{ _name: name } } as any;
    }

    const storeStats: StoreStats[] = Object.entries(map)
      .map(([key, v]) => ({
        name: (v as any)._name || key,
        visitCount: v.visits,
        totalSpent: v.total,
        avgSpend: v.visits > 0 ? v.total / v.visits : 0,
        lastVisit: v.lastDate,
      }))
      .sort((a, b) => b.visitCount - a.visitCount);

    setStores(storeStats);
    setLoading(false);
  };

  if (loading || stores.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <MapPin className="h-4 w-4 text-primary" />
          Your regular shops
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stores.map((store) => (
          <div
            key={store.name}
            className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{store.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShoppingCart className="h-3 w-3" />
                  {store.visitCount} {store.visitCount === 1 ? 'visit' : 'visits'}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${store.totalSpent.toFixed(2)} total
                </span>
                <span>~${store.avgSpend.toFixed(2)}/shop</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last visit:{' '}
                {new Date(store.lastVisit).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default RegularStores;
