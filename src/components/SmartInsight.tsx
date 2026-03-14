import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

interface SmartInsightProps {
  receiptIds: string[];
}

const SmartInsight = ({ receiptIds }: SmartInsightProps) => {
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    if (receiptIds.length > 0) generateInsight();
  }, [receiptIds]);

  const generateInsight = async () => {
    // Fetch all items for these receipts
    const { data: items } = await supabase
      .from('receipt_items')
      .select('clean_name, raw_name, price, category, is_discount, is_food')
      .in('receipt_id', receiptIds);

    if (!items || items.length === 0) return;

    // Fetch recommendations if any
    const { data: recs } = await supabase
      .from('recommendations')
      .select('current_item, suggested_item, potential_saving, type')
      .in('receipt_id', receiptIds);

    // Generate insight from real data
    const foodItems = items.filter((i) => i.is_food);
    const discounts = items.filter((i) => i.is_discount);
    const totalSaved = discounts.reduce((s, i) => s + Math.abs(Number(i.price) || 0), 0);

    // Check for branded items that could be swapped
    const swapRecs = (recs || []).filter((r) => r.type === 'cheaper_swap' || r.type === 'value');
    const totalPotentialSaving = swapRecs.reduce((s, r) => s + (Number(r.potential_saving) || 0), 0);

    // Pick the most impactful insight
    if (swapRecs.length > 0 && totalPotentialSaving > 0) {
      setInsight(
        `Heads up — ${swapRecs.length} ${swapRecs.length === 1 ? 'item has' : 'items have'} a cheaper option. You could shave $${totalPotentialSaving.toFixed(2)} off your next shop by switching to home brand.`
      );
    } else if (totalSaved > 0) {
      setInsight(
        `Nice one — you saved $${totalSaved.toFixed(2)} on specials this shop! Keep hunting those markdowns and you'll stretch your budget even further.`
      );
    } else {
      // Fallback: category-based insight
      const categories: Record<string, number> = {};
      foodItems.forEach((i) => {
        const cat = i.category || 'Other';
        categories[cat] = (categories[cat] || 0) + (Number(i.price) || 0);
      });
      const topCat = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
      if (topCat) {
        setInsight(
          `Your biggest spend was ${topCat[0]} at $${topCat[1].toFixed(2)}. Reckon you could find better deals here — worth a look next time.`
        );
      }
    }
  };

  if (!insight) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-primary mb-0.5">Smart Insight</p>
          <p className="text-sm text-foreground">{insight}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SmartInsight;
