import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Edit2, Store, Calendar } from 'lucide-react';

// Placeholder data — will come from OCR
const mockItems = [
  { id: 1, name: 'Woolworths Milk 2L', category: 'Dairy', price: 3.50, quantity: 1 },
  { id: 2, name: 'Tip Top Bread White', category: 'Bakery', price: 3.80, quantity: 1 },
  { id: 3, name: 'Chicken Breast 500g', category: 'Meat', price: 9.00, quantity: 1 },
  { id: 4, name: 'Broccoli', category: 'Fresh Produce', price: 3.50, quantity: 1 },
  { id: 5, name: 'Barilla Pasta 500g', category: 'Pantry', price: 2.00, quantity: 2 },
  { id: 6, name: 'Passata 700ml', category: 'Pantry', price: 1.80, quantity: 1 },
  { id: 7, name: 'Cheddar Cheese 250g', category: 'Dairy', price: 4.50, quantity: 1 },
  { id: 8, name: 'Bananas 1kg', category: 'Fresh Produce', price: 3.90, quantity: 1 },
];

const ReceiptReview = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState(mockItems);
  const [storeName, setStoreName] = useState('Woolworths');
  const [shopDate, setShopDate] = useState('2026-03-14');

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateItem = (id: number, field: string, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Review your receipt</h1>
        <p className="text-sm text-muted-foreground">Check the items look right before we analyse</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Store info */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Store className="h-3 w-3" /> Store
            </label>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" /> Date
            </label>
            <Input type="date" value={shopDate} onChange={(e) => setShopDate(e.target.value)} />
          </div>
        </div>

        {/* Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between font-display text-base">
              <span>Items ({items.length})</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    className="h-8 text-sm font-medium border-0 bg-transparent px-0 focus-visible:ring-0"
                  />
                  <Badge variant="secondary" className="text-xs mt-1">{item.category}</Badge>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                  {item.quantity > 1 && (
                    <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 pb-4">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/scan')}>
            Re-scan
          </Button>
          <Button className="flex-1 font-semibold" onClick={() => navigate('/analysis')}>
            <Check className="mr-2 h-4 w-4" /> Analyse shop
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ReceiptReview;
