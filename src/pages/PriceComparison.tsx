import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Store, TrendingDown, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradePrompt from '@/components/UpgradePrompt';

const priceData = [
  { item: 'Woolworths Milk 2L', prices: [{ store: 'Woolworths', price: 3.10 }, { store: 'Coles', price: 2.90 }, { store: 'Aldi', price: 2.69 }] },
  { item: 'Chicken Breast 500g', prices: [{ store: 'Woolworths', price: 7.50 }, { store: 'Coles', price: 7.00 }, { store: 'Aldi', price: 6.49 }] },
  { item: 'Cheddar Cheese 250g', prices: [{ store: 'Woolworths', price: 4.50 }, { store: 'Coles', price: 4.20 }, { store: 'Aldi', price: 3.69 }] },
  { item: 'Barilla Pasta 500g', prices: [{ store: 'Woolworths', price: 2.00 }, { store: 'Coles', price: 2.00 }, { store: 'Aldi', price: 1.29 }] },
];

const PriceComparison = () => {
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
          <h1 className="font-display text-2xl font-bold">Price Comparison</h1>
          <p className="text-sm text-muted-foreground">Compare prices across stores</p>
        </div>
        <div className="px-4">
          <UpgradePrompt
            feature="Price Comparison Insights"
            description="See how your regular items compare across Woolworths, Coles, Aldi and more. Find the cheapest store for your specific basket."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Price Comparison</h1>
        <p className="text-sm text-muted-foreground">Based on your frequently bought items</p>
      </div>

      <div className="px-4 space-y-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-semibold">You could save ~$8.50/week</p>
              <p className="text-xs text-muted-foreground">by splitting your shop between Aldi and Coles</p>
            </div>
          </CardContent>
        </Card>

        {priceData.map((item) => {
          const cheapest = Math.min(...item.prices.map(p => p.price));
          return (
            <Card key={item.item}>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-2">{item.item}</p>
                <div className="space-y-1.5">
                  {item.prices
                    .sort((a, b) => a.price - b.price)
                    .map((p) => (
                      <div key={p.store} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{p.store}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${p.price === cheapest ? 'text-primary' : ''}`}>
                            ${p.price.toFixed(2)}
                          </span>
                          {p.price === cheapest && (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">
                              <ArrowDown className="h-2.5 w-2.5 mr-0.5" /> Best
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        <div className="h-4" />
      </div>
    </AppLayout>
  );
};

export default PriceComparison;
