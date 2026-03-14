import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradePrompt from '@/components/UpgradePrompt';

const pantryItems = [
  { name: 'Chicken Breast 500g', expires: '2 days', status: 'urgent' },
  { name: 'Woolworths Milk 2L', expires: '4 days', status: 'soon' },
  { name: 'Broccoli', expires: '3 days', status: 'soon' },
  { name: 'Cheddar Cheese 250g', expires: '12 days', status: 'ok' },
  { name: 'Barilla Pasta 500g', expires: '6 months', status: 'ok' },
  { name: 'Passata 700ml', expires: '8 months', status: 'ok' },
];

const Pantry = () => {
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
          <h1 className="font-display text-2xl font-bold">Pantry Tracker</h1>
          <p className="text-sm text-muted-foreground">Track what's in your kitchen and reduce waste</p>
        </div>
        <div className="px-4">
          <UpgradePrompt
            feature="Pantry Tracking"
            description="Automatically builds your pantry from scanned receipts, tracks expiry dates, and alerts you before food goes to waste."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Pantry Tracker</h1>
            <p className="text-sm text-muted-foreground">{pantryItems.length} items tracked</p>
          </div>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      <div className="px-4 space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Use Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pantryItems.filter(i => i.status !== 'ok').map((item) => (
              <div key={item.name} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <Badge variant={item.status === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                  {item.expires}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> In Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pantryItems.filter(i => i.status === 'ok').map((item) => (
              <div key={item.name} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">{item.expires}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="h-4" />
      </div>
    </AppLayout>
  );
};

export default Pantry;
