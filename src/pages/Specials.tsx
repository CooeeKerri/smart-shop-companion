import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag, ExternalLink, Store, Loader2, Search, Bell } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradePrompt from '@/components/UpgradePrompt';

const catalogues = [
  {
    store: 'Woolworths',
    tagline: 'Weekly specials',
    url: 'https://www.woolworths.com.au/shop/browse/specials',
    color: 'bg-green-500/10 text-green-700',
  },
  {
    store: 'Coles',
    tagline: 'This week\'s deals',
    url: 'https://www.coles.com.au/on-special',
    color: 'bg-red-500/10 text-red-700',
  },
  {
    store: 'Aldi',
    tagline: 'Super Savers',
    url: 'https://www.aldi.com.au/en/special-buys/',
    color: 'bg-blue-500/10 text-blue-700',
  },
  {
    store: 'IGA',
    tagline: 'Weekly catalogue',
    url: 'https://www.iga.com.au/catalogue/',
    color: 'bg-orange-500/10 text-orange-700',
  },
];

const matchedSpecials = [
  { item: 'Chicken Breast 500g', store: 'Coles', wasPrice: 9.00, nowPrice: 6.50, saving: '28%' },
  { item: 'Barilla Pasta 500g', store: 'Woolworths', wasPrice: 3.50, nowPrice: 2.00, saving: '43%' },
  { item: 'Woolworths Milk 2L', store: 'Woolworths', wasPrice: 3.10, nowPrice: 2.50, saving: '19%' },
  { item: 'Cheddar Cheese 250g', store: 'Aldi', wasPrice: 4.50, nowPrice: 3.29, saving: '27%' },
  { item: 'Passata 700ml', store: 'Coles', wasPrice: 2.50, nowPrice: 1.50, saving: '40%' },
];

const Specials = () => {
  const { isPremium, loading } = useSubscription();
  const [activeTab, setActiveTab] = useState<'matched' | 'catalogues'>('matched');

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
          <h1 className="font-display text-2xl font-bold">Specials & Catalogues</h1>
          <p className="text-sm text-muted-foreground">Find deals on your regular purchases</p>
        </div>
        <div className="px-4">
          <UpgradePrompt
            feature="Specials Catalogue Access"
            description="Get matched specials for items you regularly buy, quick links to all major supermarket catalogues, and alerts when your favourites go on sale."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Specials & Catalogues</h1>
        <p className="text-sm text-muted-foreground">Deals matched to your shopping habits</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={activeTab === 'matched' ? 'default' : 'outline'}
            onClick={() => setActiveTab('matched')}
            className="flex-1"
          >
            <Search className="h-3.5 w-3.5 mr-1.5" /> Your Specials
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'catalogues' ? 'default' : 'outline'}
            onClick={() => setActiveTab('catalogues')}
            className="flex-1"
          >
            <Store className="h-3.5 w-3.5 mr-1.5" /> Catalogues
          </Button>
        </div>

        {activeTab === 'matched' && (
          <>
            {/* Savings summary */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Tag className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm font-semibold">
                    ${matchedSpecials.reduce((s, i) => s + (i.wasPrice - i.nowPrice), 0).toFixed(2)} potential savings
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {matchedSpecials.length} of your regular items are on special this week
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Matched specials */}
            <div className="space-y-2">
              {matchedSpecials.map((special) => (
                <Card key={special.item}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{special.item}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Store className="h-3 w-3" /> {special.store}
                        </p>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/30 shrink-0">
                        {special.saving} off
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground line-through">${special.wasPrice.toFixed(2)}</span>
                      <span className="text-lg font-display font-bold text-primary">${special.nowPrice.toFixed(2)}</span>
                      <span className="text-xs text-primary font-medium">
                        Save ${(special.wasPrice - special.nowPrice).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="rounded-xl bg-muted p-4 flex items-start gap-3">
              <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Price alerts</p>
                <p className="text-xs text-muted-foreground">
                  We'll notify you when items you regularly buy go on special at your local stores.
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'catalogues' && (
          <div className="space-y-3">
            {catalogues.map((cat) => (
              <Card key={cat.store} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <a href={cat.url} target="_blank" rel="noopener noreferrer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cat.color}`}>
                      <Store className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{cat.store}</p>
                      <p className="text-xs text-muted-foreground">{cat.tagline}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </a>
              </Card>
            ))}

            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground text-center">
                Catalogue links open in your browser. Specials are updated weekly.
              </p>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </AppLayout>
  );
};

export default Specials;
