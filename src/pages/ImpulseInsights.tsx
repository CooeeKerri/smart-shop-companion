import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingDown, ShoppingCart, AlertCircle, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradePrompt from '@/components/UpgradePrompt';

const impulseItems = [
  { name: 'Tim Tams Original', count: 4, totalSpent: 18.00, category: 'Snacks', tip: 'You buy these almost every shop. Try adding to your list to avoid duplicates.' },
  { name: 'Magazine', count: 2, totalSpent: 15.90, category: 'Non-food', tip: 'Consider a digital subscription instead — could save $150/year.' },
  { name: 'Energy Drinks 4-pack', count: 3, totalSpent: 29.85, category: 'Drinks', tip: 'Bulk buying from a different store could save 30%.' },
];

const ImpulseInsights = () => {
  const { isPremium, loading } = useSubscription();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isPremium) {
    return (
      <AppLayout>
        <div className="px-4 pt-6 pb-4">
          <h1 className="font-display text-2xl font-bold">Impulse Insights</h1>
          <p className="text-sm text-muted-foreground">Spot unplanned spending patterns</p>
        </div>
        <div className="px-4">
          <UpgradePrompt
            feature="Impulse Purchase Insights"
            description="AI analyses your shopping history to identify repeat impulse buys, calculates how much they cost you over time, and suggests smarter alternatives."
          />
        </div>
      </AppLayout>
    );
  }

  const totalImpulse = impulseItems.reduce((s, i) => s + i.totalSpent, 0);

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Impulse Insights</h1>
        <p className="text-sm text-muted-foreground">Patterns from your last 30 days</p>
      </div>

      <div className="px-4 space-y-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <Zap className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-2xl font-display font-bold">${totalImpulse.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">estimated impulse spending this month</p>
          </CardContent>
        </Card>

        {impulseItems.map((item) => (
          <Card key={item.name}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Bought {item.count} times · ${item.totalSpent.toFixed(2)} total</p>
                </div>
                <Badge variant="secondary" className="text-xs">{item.category}</Badge>
              </div>
              <div className="flex items-start gap-2 mt-2 rounded-lg bg-muted p-2.5">
                <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{item.tip}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <div className="h-4" />
      </div>
    </AppLayout>
  );
};

export default ImpulseInsights;
