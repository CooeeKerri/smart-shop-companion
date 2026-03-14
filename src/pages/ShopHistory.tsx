import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Store, Calendar, Receipt } from 'lucide-react';

const ShopHistory = () => {
  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Shop history</h1>
        <p className="text-sm text-muted-foreground">Your past receipt analyses</p>
      </div>

      <div className="px-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Receipt className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-display font-semibold">No shops yet</p>
            <p className="text-sm text-muted-foreground">
              Your scanned receipts and analyses will appear here
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ShopHistory;
