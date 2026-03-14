import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ShoppingBasket,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Package,
  Bell,
} from 'lucide-react';

interface FrequentItem {
  clean_name: string;
  category: string;
  total_qty: number;
  purchase_count: number;
  avg_price: number;
  last_price: number | null;
  price_alert: boolean; // last price > avg price (not on special)
  last_purchased: string;
  days_since_last: number;
  avg_days_between: number | null;
  restock_due: boolean;
}

const PurchaseInsights = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<FrequentItem[]>([]);
  const [restockItems, setRestockItems] = useState<FrequentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (user) loadInsights();
  }, [user]);

  const loadInsights = async () => {
    try {
      // Get all confirmed receipts
      const { data: receipts } = await supabase
        .from('receipts')
        .select('id, shop_date, created_at')
        .eq('user_id', user!.id)
        .in('status', ['confirmed', 'reviewed'])
        .order('created_at', { ascending: true });

      if (!receipts || receipts.length === 0) {
        setLoading(false);
        return;
      }

      // Get all items
      const { data: allItems } = await supabase
        .from('receipt_items')
        .select('clean_name, category, price, quantity, is_discount, is_food, receipt_id')
        .in('receipt_id', receipts.map((r) => r.id));

      if (!allItems || allItems.length === 0) {
        setLoading(false);
        return;
      }

      // Build receipt date map
      const dateMap: Record<string, string> = {};
      receipts.forEach((r) => {
        dateMap[r.id] = r.shop_date || r.created_at;
      });

      // Aggregate by normalised item name
      const agg: Record<
        string,
        {
          name: string;
          category: string;
          totalQty: number;
          totalSpent: number;
          dates: string[];
        }
      > = {};

      for (const item of allItems) {
        if (item.is_discount || !item.clean_name) continue;

        const key = item.clean_name.toLowerCase().trim();
        if (!agg[key]) {
          agg[key] = {
            name: item.clean_name,
            category: item.category || 'Other',
            totalQty: 0,
            totalSpent: 0,
            dates: [],
          };
        }

        const qty = item.quantity || 1;
        agg[key].totalQty += qty;
        agg[key].totalSpent += (Number(item.price) || 0) * qty;

        const date = dateMap[item.receipt_id];
        if (date && !agg[key].dates.includes(date)) {
          agg[key].dates.push(date);
        }
      }

      const now = new Date();
      const frequentItems: FrequentItem[] = Object.values(agg)
        .filter((a) => a.dates.length >= 2) // At least bought twice
        .map((a) => {
          const sortedDates = a.dates
            .map((d) => new Date(d))
            .sort((x, y) => x.getTime() - y.getTime());

          const lastDate = sortedDates[sortedDates.length - 1];
          const daysSinceLast = Math.floor(
            (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Calculate average days between purchases
          let avgDays: number | null = null;
          if (sortedDates.length >= 2) {
            const gaps: number[] = [];
            for (let i = 1; i < sortedDates.length; i++) {
              gaps.push(
                (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) /
                  (1000 * 60 * 60 * 24)
              );
            }
            avgDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
          }

          const restockDue = avgDays !== null && daysSinceLast >= avgDays * 0.8;

          return {
            clean_name: a.name,
            category: a.category,
            total_qty: a.totalQty,
            purchase_count: a.dates.length,
            avg_price: a.totalSpent / a.totalQty,
            last_purchased: lastDate.toISOString(),
            days_since_last: daysSinceLast,
            avg_days_between: avgDays,
            restock_due: restockDue,
          };
        })
        .sort((a, b) => b.purchase_count - a.purchase_count);

      setItems(frequentItems);
      setRestockItems(frequentItems.filter((i) => i.restock_due));
    } catch (err) {
      console.error('Insights error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  const maxPurchases = items[0]?.purchase_count || 1;
  const displayItems = showAll ? items : items.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Restock Alerts */}
      {restockItems.length > 0 && (
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Restock due
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Based on your purchase patterns, these items may need restocking
            </p>
            <div className="flex flex-wrap gap-2">
              {restockItems.slice(0, 8).map((item) => (
                <Badge
                  key={item.clean_name}
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-foreground gap-1.5 py-1.5 px-3"
                >
                  <RefreshCw className="h-3 w-3 text-amber-600" />
                  <span className="font-medium">{item.clean_name}</span>
                  <span className="text-muted-foreground text-[10px]">
                    · every ~{item.avg_days_between}d
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most Purchased */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between font-display text-base">
            <div className="flex items-center gap-2">
              <ShoppingBasket className="h-4 w-4 text-primary" />
              Most purchased items
            </div>
            <Badge variant="secondary" className="text-xs font-mono">
              {items.length} items tracked
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayItems.map((item, idx) => (
            <div key={item.clean_name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <span className="text-sm font-medium truncate">{item.clean_name}</span>
                  {item.restock_due && (
                    <RefreshCw className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {item.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.purchase_count}× bought
                  </span>
                  <span className="text-xs font-semibold w-16 text-right">
                    ${item.avg_price.toFixed(2)} avg
                  </span>
                </div>
              </div>
              <Progress
                value={(item.purchase_count / maxPurchases) * 100}
                className="h-1.5"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  Total qty: {item.total_qty}
                  {item.avg_days_between && ` · every ~${item.avg_days_between} days`}
                </span>
                <span>
                  Last: {new Date(item.last_purchased).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  {item.days_since_last > 0 && ` (${item.days_since_last}d ago)`}
                </span>
              </div>
            </div>
          ))}

          {items.length > 6 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show less' : `Show all ${items.length} items`}
              <ArrowRight className={`ml-1 h-3 w-3 transition-transform ${showAll ? 'rotate-90' : ''}`} />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseInsights;
