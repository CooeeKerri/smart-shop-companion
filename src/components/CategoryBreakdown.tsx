import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PieChart, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CategorySpend {
  category: string;
  total: number;
  itemCount: number;
  percentage: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Dairy: 'bg-blue-500',
  Meat: 'bg-red-500',
  'Fresh Produce': 'bg-green-500',
  Bakery: 'bg-amber-600',
  Pantry: 'bg-orange-500',
  Frozen: 'bg-cyan-500',
  Beverages: 'bg-purple-500',
  Snacks: 'bg-pink-500',
  Household: 'bg-slate-500',
  Other: 'bg-muted-foreground',
};

const CategoryBreakdown = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategorySpend[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Get this month's confirmed receipts
    const { data: receipts } = await supabase
      .from('receipts')
      .select('id')
      .eq('user_id', user!.id)
      .in('status', ['confirmed', 'reviewed'])
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    if (!receipts || receipts.length === 0) {
      setLoading(false);
      return;
    }

    // Get all items for those receipts
    const { data: items } = await supabase
      .from('receipt_items')
      .select('category, price, quantity, is_discount')
      .in('receipt_id', receipts.map((r) => r.id));

    if (!items || items.length === 0) {
      setLoading(false);
      return;
    }

    // Aggregate by category
    const map: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;

    for (const item of items) {
      if (item.is_discount) continue;
      const cat = item.category || 'Other';
      const amount = (Number(item.price) || 0) * (item.quantity || 1);
      if (!map[cat]) map[cat] = { total: 0, count: 0 };
      map[cat].total += amount;
      map[cat].count += 1;
      grandTotal += amount;
    }

    const sorted: CategorySpend[] = Object.entries(map)
      .map(([category, v]) => ({
        category,
        total: v.total,
        itemCount: v.count,
        percentage: grandTotal > 0 ? (v.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    setCategories(sorted);
    setMonthTotal(grandTotal);
    setLoading(false);
  };

  if (loading || categories.length === 0) return null;

  const displayCategories = expanded ? categories : categories.slice(0, 5);
  const currentMonth = new Date().toLocaleDateString('en-AU', { month: 'long' });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between font-display text-base">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            {currentMonth} by category
          </div>
          <span className="text-sm font-semibold text-primary">
            ${monthTotal.toFixed(2)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Visual bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {categories.slice(0, 8).map((cat) => {
            const colorClass = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Other'];
            return (
              <div
                key={cat.category}
                className={`${colorClass} rounded-sm`}
                style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                title={`${cat.category}: ${cat.percentage.toFixed(1)}%`}
              />
            );
          })}
        </div>

        {/* Category list */}
        {displayCategories.map((cat) => {
          const colorClass = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Other'];
          return (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
                  <span className="font-medium">{cat.category}</span>
                  <span className="text-xs text-muted-foreground">
                    {cat.itemCount} items
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {cat.percentage.toFixed(0)}%
                  </span>
                  <span className="font-semibold w-16 text-right">
                    ${cat.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <Progress value={cat.percentage} className="h-1" />
            </div>
          );
        })}

        {categories.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>Show less <ChevronUp className="ml-1 h-3 w-3" /></>
            ) : (
              <>Show all {categories.length} categories <ChevronDown className="ml-1 h-3 w-3" /></>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryBreakdown;
