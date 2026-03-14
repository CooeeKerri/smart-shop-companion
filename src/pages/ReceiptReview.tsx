import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Store, Calendar, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ReceiptItem {
  id: string;
  clean_name: string;
  raw_name: string;
  category: string;
  price: number;
  quantity: number;
  is_discount: boolean;
  is_food: boolean;
}

interface Docket {
  id: string;
  storeName: string;
  items: ReceiptItem[];
  totalAmount: number | null;
}

const ReceiptReview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const receiptIds: string[] = (location.state as any)?.receiptIds ?? [];

  const [dockets, setDockets] = useState<Docket[]>([]);
  const [shopDate, setShopDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedDockets, setExpandedDockets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (receiptIds.length === 0) {
      navigate('/scan');
      return;
    }
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    try {
      const loaded: Docket[] = [];

      for (const id of receiptIds) {
        const [receiptRes, itemsRes] = await Promise.all([
          supabase.from('receipts').select('*').eq('id', id).single(),
          supabase.from('receipt_items').select('*').eq('receipt_id', id).order('created_at'),
        ]);

        if (receiptRes.data) {
          loaded.push({
            id,
            storeName: receiptRes.data.store_name || 'Unknown Store',
            totalAmount: receiptRes.data.total_amount,
            items: (itemsRes.data || []).map((item) => ({
              id: item.id,
              clean_name: item.clean_name || item.raw_name || '',
              raw_name: item.raw_name || '',
              category: item.category || 'Other',
              price: Number(item.price) || 0,
              quantity: item.quantity || 1,
              is_discount: item.is_discount || false,
              is_food: (item as any).is_food !== undefined ? (item as any).is_food : true,
            })),
          });
        }
      }

      setDockets(loaded);
      setExpandedDockets(new Set(loaded.map((d) => d.id)));
    } catch (err) {
      console.error('Load error:', err);
      toast({ title: 'Error loading receipts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const totalItems = dockets.reduce((sum, d) => sum + d.items.filter((i) => !i.is_discount).length, 0);
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

  const updateItem = async (docketId: string, itemId: string, field: string, value: string | number) => {
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

  const removeItem = async (docketId: string, itemId: string) => {
    await supabase.from('receipt_items').delete().eq('id', itemId);
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

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Save all edits back to DB
      for (const docket of dockets) {
        await supabase
          .from('receipts')
          .update({
            store_name: docket.storeName,
            shop_date: shopDate,
            status: 'confirmed',
          })
          .eq('id', docket.id);

        for (const item of docket.items) {
          await supabase
            .from('receipt_items')
            .update({
              clean_name: item.clean_name,
              category: item.category,
              price: item.price,
              quantity: item.quantity,
            })
            .eq('id', item.id);
        }
      }

      toast({ title: 'Shop confirmed!' });
      navigate('/analysis', { state: { receiptIds } });
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: 'Error saving', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading receipt data…</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Review your shop</h1>
        <p className="text-sm text-muted-foreground">
          {dockets.length} {dockets.length === 1 ? 'docket' : 'dockets'} · {totalItems} items · ${totalAmount.toFixed(2)}
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Date */}
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
              <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleDocket(docket.id)}>
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
                      {docket.items.filter((i) => !i.is_discount).length} items
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
                      className={`flex items-center gap-3 border-b pb-3 last:border-0 last:pb-0 ${
                        item.is_discount ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <Input
                          value={item.clean_name}
                          onChange={(e) => updateItem(docket.id, item.id, 'clean_name', e.target.value)}
                          className="h-8 text-sm font-medium border-0 bg-transparent px-0 focus-visible:ring-0"
                        />
                        <div className="flex gap-1 mt-1">
                          <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                          {item.is_discount && (
                            <Badge variant="outline" className="text-xs text-green-600">Discount</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <span className={`text-sm font-semibold ${item.is_discount ? 'text-green-600' : ''}`}>
                            {item.is_discount ? '-' : ''}${Math.abs(item.price * item.quantity).toFixed(2)}
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
          <Button
            className="flex-1 font-semibold"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Confirm shop
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ReceiptReview;
