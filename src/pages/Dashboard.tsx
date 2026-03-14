import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, TrendingUp, UtensilsCrossed, DollarSign, ArrowRight, ShoppingCart, Store, Calendar } from 'lucide-react';
import PurchaseInsights from '@/components/PurchaseInsights';

interface ReceiptSummary {
  id: string;
  store_name: string | null;
  shop_date: string | null;
  total_amount: number | null;
  status: string;
  created_at: string;
  item_count: number;
}

interface MonthlyStats {
  totalSpent: number;
  shopCount: number;
  itemCount: number;
  avgPerShop: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.email?.split('@')[0] ?? 'there';

  const [recentReceipts, setRecentReceipts] = useState<ReceiptSummary[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    totalSpent: 0,
    shopCount: 0,
    itemCount: 0,
    avgPerShop: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Get current month boundaries
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Fetch confirmed receipts for this month
      const { data: receipts } = await supabase
        .from('receipts')
        .select('id, store_name, shop_date, total_amount, status, created_at')
        .eq('user_id', user!.id)
        .in('status', ['confirmed', 'reviewed'])
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .order('created_at', { ascending: false });

      // Fetch item counts per receipt
      const receiptList = receipts || [];
      const summaries: ReceiptSummary[] = [];

      if (receiptList.length > 0) {
        const { data: items } = await supabase
          .from('receipt_items')
          .select('receipt_id')
          .in('receipt_id', receiptList.map((r) => r.id));

        const countMap: Record<string, number> = {};
        (items || []).forEach((item) => {
          countMap[item.receipt_id] = (countMap[item.receipt_id] || 0) + 1;
        });

        for (const r of receiptList) {
          summaries.push({ ...r, item_count: countMap[r.id] || 0 });
        }
      }

      const totalSpent = summaries.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
      const totalItems = summaries.reduce((s, r) => s + r.item_count, 0);

      setRecentReceipts(summaries.slice(0, 5));
      setMonthlyStats({
        totalSpent,
        shopCount: summaries.length,
        itemCount: totalItems,
        avgPerShop: summaries.length > 0 ? totalSpent / summaries.length : 0,
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentMonth = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">G'day, {firstName}! 👋</h1>
        <p className="text-sm text-muted-foreground">Here's your {currentMonth} summary</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Scan CTA */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Camera className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold">Scan a receipt</h2>
              <p className="text-sm text-muted-foreground">Upload your docket to get started</p>
            </div>
            <Button size="sm" onClick={() => navigate('/scan')}>
              Scan <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        {/* Monthly stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">This month</span>
              </div>
              <span className="font-display text-2xl font-bold">${monthlyStats.totalSpent.toFixed(2)}</span>
              <p className="text-xs text-muted-foreground mt-0.5">total spent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">This month</span>
              </div>
              <span className="font-display text-2xl font-bold">{monthlyStats.shopCount}</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {monthlyStats.shopCount === 1 ? 'shop' : 'shops'} · {monthlyStats.itemCount} items
              </p>
            </CardContent>
          </Card>
        </div>

        {monthlyStats.shopCount > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Average per shop</p>
                  <span className="font-display text-lg font-bold">${monthlyStats.avgPerShop.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Items per shop</p>
                  <span className="font-display text-lg font-bold">
                    {monthlyStats.shopCount > 0
                      ? Math.round(monthlyStats.itemCount / monthlyStats.shopCount)
                      : 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent receipts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between font-display text-base">
              <span>Recent dockets</span>
              {recentReceipts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate('/history')} className="text-xs">
                  View all <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
            ) : recentReceipts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No receipts scanned yet.</p>
                <p className="text-sm text-muted-foreground">Scan your first docket to see insights here!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex items-center gap-3 border-b pb-3 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                    onClick={() => navigate('/review', { state: { receiptIds: [receipt.id] } })}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Store className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {receipt.store_name || 'Unknown Store'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {receipt.shop_date
                          ? new Date(receipt.shop_date).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                            })
                          : new Date(receipt.created_at).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                            })}
                        {' · '}
                        {receipt.item_count} items
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      ${Number(receipt.total_amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
