import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Store, Calendar, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface ReceiptItem {
  id: number;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

interface Docket {
  id: string;
  storeName: string;
  items: ReceiptItem[];
}

// Placeholder data — will come from OCR
const mockDockets: Docket[] = [
  {
    id: '1',
    storeName: 'Woolworths',
    items: [
      { id: 1, name: 'Woolworths Milk 2L', category: 'Dairy', price: 3.50, quantity: 1 },
      { id: 2, name: 'Tip Top Bread White', category: 'Bakery', price: 3.80, quantity: 1 },
      { id: 3, name: 'Chicken Breast 500g', category: 'Meat', price: 9.00, quantity: 1 },
      { id: 4, name: 'Broccoli', category: 'Fresh Produce', price: 3.50, quantity: 1 },
      { id: 5, name: 'Barilla Pasta 500g', category: 'Pantry', price: 2.00, quantity: 2 },
    ],
  },
  {
    id: '2',
    storeName: 'Coles',
    items: [
      { id: 6, name: 'Passata 700ml', category: 'Pantry', price: 1.80, quantity: 1 },
      { id: 7, name: 'Cheddar Cheese 250g', category: 'Dairy', price: 4.50, quantity: 1 },
      { id: 8, name: 'Bananas 1kg', category: 'Fresh Produce', price: 3.90, quantity: 1 },
    ],
  },
];

const ReceiptReview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const docketCount = (location.state as any)?.docketCount ?? 1;

  const [dockets, setDockets] = useState<Docket[]>(
    docketCount > 1 ? mockDockets : [mockDockets[0]]
  );
  const [shopDate, setShopDate] = useState('2026-03-14');
  const [expandedDockets, setExpandedDockets] = useState<Set<string>>(
    new Set(dockets.map((d) => d.id))
  );

  const totalItems = dockets.reduce((sum, d) => sum + d.items.length, 0);
  const totalAmount = dockets.reduce(
    (sum, d) => sum + d.items.reduce((s, i) => s + i.price * i.quantity, 0),
    0
  );

  const toggleDocket = (id: string) => {
    setExpandedDockets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateItem = (docketId: string, itemId: number, field: string, value: string | number) => {
    setDockets((prev) =>
      prev.map((d) =>
        d.id === docketId
          ? {
              ...d,
              items: d.items.map((item) =>
                item.id === itemId ? { ...item, [field]: value } : item
              ),
            }
          : d
      )
    );
  };

  const removeItem = (docketId: string, itemId: number) => {
    setDockets((prev) =>
      prev.map((d) =>
        d.id === docketId
          ? { ...d, items: d.items.filter((item) => item.id !== itemId) }
          : d
      )
    );
  };

  const updateStoreName = (docketId: string, name: string) => {
    setDockets((prev) =>
      prev.map((d) => (d.id === docketId ? { ...d, storeName: name } : d))
    );
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Review your shop</h1>
        <p className="text-sm text-muted-foreground">
          {dockets.length} {dockets.length === 1 ? 'docket' : 'dockets'} · {totalItems} items · ${totalAmount.toFixed(2)}
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Date for the whole trip */}
        <div className="space-y-1">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" /> Shopping date
          </label>
          <Input type="date" value={shopDate} onChange={(e) => setShopDate(e.target.value)} />
        </div>

        {/* Dockets */}
        {dockets.map((docket) => {
          const isExpanded = expandedDockets.has(docket.id);
          const docketTotal = docket.items.reduce((s, i) => s + i.price * i.quantity, 0);

          return (
            <Card key={docket.id}>
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => toggleDocket(docket.id)}
              >
                <CardTitle className="flex items-center justify-between font-display text-base">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={docket.storeName}
                      onChange={(e) => updateStoreName(docket.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-sm font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 w-auto"
                    />
                    <Badge variant="outline" className="text-xs">
                      {docket.items.length} items
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary text-sm">${docketTotal.toFixed(2)}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-3">
                  {docket.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex-1 min-w-0">
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            updateItem(docket.id, item.id, 'name', e.target.value)
                          }
                          className="h-8 text-sm font-medium border-0 bg-transparent px-0 focus-visible:ring-0"
                        />
                        <Badge variant="secondary" className="text-xs mt-1">
                          {item.category}
                        </Badge>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <span className="text-sm font-semibold">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                          {item.quantity > 1 && (
                            <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(docket.id, item.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}

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
