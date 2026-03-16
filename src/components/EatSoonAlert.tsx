import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Leaf } from 'lucide-react';

const PERISHABLE_KEYWORDS = [
  'spinach', 'lettuce', 'rocket', 'kale', 'salad', 'herbs', 'basil', 'coriander', 'parsley', 'mint', 'dill',
  'mushroom', 'avocado', 'banana', 'berries', 'strawberr', 'blueberr', 'raspberr', 'cherry', 'grape',
  'tomato', 'cucumber', 'capsicum', 'zucchini', 'broccoli', 'asparagus', 'bean sprout', 'sprout',
  'milk', 'cream', 'yoghurt', 'yogurt', 'cheese', 'ricotta', 'brie', 'camembert',
  'chicken', 'mince', 'sausage', 'steak', 'fish', 'salmon', 'prawn', 'shrimp', 'lamb', 'pork',
  'bread', 'baguette', 'rolls', 'wraps', 'tortilla',
  'fresh', 'deli', 'hummus', 'dip', 'pesto',
];

interface PerishableItem {
  name: string;
}

const EatSoonAlert = () => {
  const { user } = useAuth();
  const [perishables, setPerishables] = useState<PerishableItem[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadPerishables();
  }, [user]);

  const loadPerishables = async () => {
    // Get latest confirmed receipt
    const { data: receipt } = await supabase
      .from('receipts')
      .select('id, store_name')
      .eq('user_id', user!.id)
      .in('status', ['confirmed', 'reviewed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!receipt) return;

    setStoreName(receipt.store_name);

    const { data: items } = await supabase
      .from('receipt_items')
      .select('clean_name, raw_name, is_food')
      .eq('receipt_id', receipt.id)
      .eq('is_food', true);

    if (!items || items.length === 0) return;

    const found: PerishableItem[] = [];
    for (const item of items) {
      const name = (item.clean_name || item.raw_name || '').toLowerCase();
      if (PERISHABLE_KEYWORDS.some((kw) => name.includes(kw))) {
        found.push({ name: item.clean_name || item.raw_name || 'Unknown' });
      }
    }

    setPerishables(found.slice(0, 6));
  };

  if (perishables.length === 0) return null;

  return (
    <Card className="border-orange-300/50 bg-gradient-to-br from-orange-50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/10 dark:border-orange-800/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span>Use These Up First</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Don't let these go off — they won't last long
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2 mb-3">
          {perishables.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 text-xs font-medium text-orange-800 dark:text-orange-200"
            >
              <Leaf className="h-3 w-3" />
              {item.name}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground italic">
          💡 Cook meals with these first — reduces waste and saves money
        </p>
      </CardContent>
    </Card>
  );
};

export default EatSoonAlert;
