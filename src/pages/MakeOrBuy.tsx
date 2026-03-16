import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, DollarSign, Clock, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradePrompt from '@/components/UpgradePrompt';

const comparisons = [
  { item: 'Pasta Sauce (500ml)', makePrice: 2.10, buyPrice: 4.50, makeTime: '25 min', verdict: 'make' },
  { item: 'Garlic Bread', makePrice: 1.80, buyPrice: 3.50, makeTime: '15 min', verdict: 'make' },
  { item: 'Hummus (200g)', makePrice: 1.50, buyPrice: 3.00, makeTime: '10 min', verdict: 'make' },
  { item: 'Rotisserie Chicken', makePrice: 6.50, buyPrice: 8.00, makeTime: '90 min', verdict: 'buy' },
  { item: 'Sliced Bread Loaf', makePrice: 2.00, buyPrice: 3.80, makeTime: '3 hrs', verdict: 'buy' },
];

const MakeOrBuy = () => {
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
          <h1 className="font-display text-2xl font-bold">Cook It or Grab Takeaway?</h1>
          <p className="text-sm text-muted-foreground">See when cooking from scratch actually saves you a few bucks</p>
        </div>
        <div className="px-4">
          <UpgradePrompt
            feature="Cook It or Grab Takeaway"
            description="We'll suss out whether it's cheaper to whip it up yourself or just grab it off the shelf — factoring in your time and what you've already got."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Make It or Buy It?</h1>
        <p className="text-sm text-muted-foreground">Based on your recent purchases</p>
      </div>

      <div className="px-4 space-y-3">
        {comparisons.map((item) => (
          <Card key={item.item}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold">{item.item}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {item.makeTime} to make
                  </div>
                </div>
                <Badge
                  className={item.verdict === 'make' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}
                >
                  {item.verdict === 'make' ? (
                    <><ThumbsUp className="h-3 w-3 mr-1" /> Make it</>
                  ) : (
                    <><ThumbsDown className="h-3 w-3 mr-1" /> Buy it</>
                  )}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-primary/5 p-2 text-center">
                  <p className="text-xs text-muted-foreground">Make it</p>
                  <p className="text-sm font-bold text-primary">${item.makePrice.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-muted p-2 text-center">
                  <p className="text-xs text-muted-foreground">Buy it</p>
                  <p className="text-sm font-bold">${item.buyPrice.toFixed(2)}</p>
                </div>
              </div>
              {item.verdict === 'make' && (
                <p className="text-xs text-primary mt-2 font-medium">
                  Save ${(item.buyPrice - item.makePrice).toFixed(2)} by making it yourself
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        <div className="h-4" />
      </div>
    </AppLayout>
  );
};

export default MakeOrBuy;
