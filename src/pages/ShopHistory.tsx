import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Store, Calendar, Receipt, DollarSign, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ReceiptWithItems {
  id: string;
  store_name: string | null;
  shop_date: string | null;
  total_amount: number | null;
  status: string;
  created_at: string;
  item_count: number;
  food_total: number;
  non_food_total: number;
}

interface MonthGroup {
  label: string;
  key: string;
  receipts: ReceiptWithItems[];
  totalSpent: number;
  foodSpent: number;
  nonFoodSpent: number;
  shopCount: number;
}

const ShopHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const loadHistory = async () => {
    try {
      const { data: receipts } = await supabase
        .from('receipts')
        .select('id, store_name, shop_date, total_amount, status, created_at')
        .eq('user_id', user!.id)
        .in('status', ['confirmed', 'reviewed'])
        .order('created_at', { ascending: false });

      if (!receipts || receipts.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch all items for these receipts
      const { data: items } = await supabase
        .from('receipt_items')
        .select('receipt_id, price, quantity, is_discount, is_food')
        .in('receipt_id', receipts.map((r) => r.id));

      // Build per-receipt stats
      const statsMap: Record<string, { count: number; foodTotal: number; nonFoodTotal: number }> = {};
      (items || []).forEach((item: any) => {
        if (!statsMap[item.receipt_id]) {
          statsMap[item.receipt_id] = { count: 0, foodTotal: 0, nonFoodTotal: 0 };
        }
        const s = statsMap[item.receipt_id];
        const amount = (Number(item.price) || 0) * (item.quantity || 1);
        if (!item.is_discount) {
          s.count++;
          if (item.is_food !== false) {
            s.foodTotal += amount;
          } else {
            s.nonFoodTotal += amount;
          }
        }
      });

      // Group by month
      const groups: Record<string, MonthGroup> = {};
      for (const r of receipts) {
        const date = r.shop_date ? new Date(r.shop_date) : new Date(r.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

        if (!groups[key]) {
          groups[key] = {
            label,
            key,
            receipts: [],
            totalSpent: 0,
            foodSpent: 0,
            nonFoodSpent: 0,
            shopCount: 0,
          };
        }

        const stats = statsMap[r.id] || { count: 0, foodTotal: 0, nonFoodTotal: 0 };
        const receiptWithItems: ReceiptWithItems = {
          ...r,
          item_count: stats.count,
          food_total: stats.foodTotal,
          non_food_total: stats.nonFoodTotal,
        };

        groups[key].receipts.push(receiptWithItems);
        groups[key].totalSpent += Number(r.total_amount) || 0;
        groups[key].foodSpent += stats.foodTotal;
        groups[key].nonFoodSpent += stats.nonFoodTotal;
        groups[key].shopCount++;
      }

      const sorted = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));

      // Auto-expand current month
      if (sorted.length > 0) {
        setExpandedMonths(new Set([sorted[0].key]));
      }

      setMonthGroups(sorted);
    } catch (err) {
      console.error('History load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const deleteReceipt = async (receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from('receipt_items').delete().eq('receipt_id', receiptId);
      await supabase.from('meal_suggestions').delete().eq('receipt_id', receiptId);
      await supabase.from('recommendations').delete().eq('receipt_id', receiptId);
      await supabase.from('receipts').delete().eq('id', receiptId);

      setMonthGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            receipts: g.receipts.filter((r) => r.id !== receiptId),
            shopCount: g.receipts.filter((r) => r.id !== receiptId).length,
            totalSpent: g.receipts
              .filter((r) => r.id !== receiptId)
              .reduce((s, r) => s + Number(r.total_amount || 0), 0),
            foodSpent: g.receipts
              .filter((r) => r.id !== receiptId)
              .reduce((s, r) => s + r.food_total, 0),
            nonFoodSpent: g.receipts
              .filter((r) => r.id !== receiptId)
              .reduce((s, r) => s + r.non_food_total, 0),
          }))
          .filter((g) => g.receipts.length > 0)
      );

      toast({ title: 'Docket deleted' });
    } catch (err) {
      console.error('Delete error:', err);
      toast({ title: 'Error deleting docket', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Shop history</h1>
        <p className="text-sm text-muted-foreground">Your monthly spending and dockets</p>
      </div>

      <div className="px-4 space-y-4 pb-4">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        ) : monthGroups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Receipt className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-display font-semibold">No shops yet</p>
              <p className="text-sm text-muted-foreground">
                Your scanned receipts will appear here
              </p>
              <Button onClick={() => navigate('/scan')} className="mt-2">
                Scan your first docket
              </Button>
            </CardContent>
          </Card>
        ) : (
          monthGroups.map((group, groupIdx) => {
            const isExpanded = expandedMonths.has(group.key);
            const prevGroup = monthGroups[groupIdx + 1];
            const spendChange = prevGroup
              ? ((group.totalSpent - prevGroup.totalSpent) / prevGroup.totalSpent) * 100
              : null;

            return (
              <Card key={group.key}>
                <CardHeader
                  className="pb-2 cursor-pointer"
                  onClick={() => toggleMonth(group.key)}
                >
                  <CardTitle className="font-display text-base">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{group.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {group.shopCount} {group.shopCount === 1 ? 'shop' : 'shops'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-bold">${group.totalSpent.toFixed(2)}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Month-on-month change */}
                    {spendChange !== null && (
                      <div className="flex items-center gap-1 mt-1">
                        {spendChange > 0 ? (
                          <TrendingUp className="h-3 w-3 text-destructive" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-primary" />
                        )}
                        <span
                          className={`text-xs ${
                            spendChange > 0 ? 'text-destructive' : 'text-primary'
                          }`}
                        >
                          {spendChange > 0 ? '+' : ''}{spendChange.toFixed(1)}% vs previous month
                        </span>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4">
                    {/* Monthly breakdown */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Food & groceries</p>
                        <p className="font-display font-bold text-lg">${group.foodSpent.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Non-food items</p>
                        <p className="font-display font-bold text-lg">${group.nonFoodSpent.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Individual receipts */}
                    <div className="space-y-2">
                      {group.receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="flex items-center gap-3 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() =>
                            navigate('/review', { state: { receiptIds: [receipt.id] } })
                          }
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <Store className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {receipt.store_name || 'Unknown Store'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {receipt.shop_date
                                ? new Date(receipt.shop_date).toLocaleDateString('en-AU', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                  })
                                : new Date(receipt.created_at).toLocaleDateString('en-AU', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                              {' · '}
                              {receipt.item_count} items
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">
                              ${Number(receipt.total_amount || 0).toFixed(2)}
                            </p>
                            {receipt.non_food_total > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                ${receipt.food_total.toFixed(2)} food
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </AppLayout>
  );
};

export default ShopHistory;
