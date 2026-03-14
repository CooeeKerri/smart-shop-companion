import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Store, Calendar, ChevronDown, ChevronUp, Trash2, Loader2, Plus, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import ReceiptImageViewer from '@/components/ReceiptImageViewer';

interface ReceiptItem {
  id: string;
  clean_name: string;
  raw_name: string;
  category: string;
  price: number;
  quantity: number;
  is_discount: boolean;
  is_food: boolean;
  confidence: number | null;
}

interface ConfidenceBreakdown {
  date_confidence: number;
  total_confidence: number;
  item_extraction_confidence: number;
  needs_review: boolean;
}

interface Docket {
  id: string;
  storeName: string;
  storeConfidence: number | null;
  storeReviewRequired: boolean;
  items: ReceiptItem[];
  totalAmount: number | null;
  overallConfidence: number | null;
  confidenceBreakdown: ConfidenceBreakdown | null;
  warnings: string[];
}

const ConfidenceBadge = ({ confidence }: { confidence: number | null }) => {
  if (confidence === null) return null;
  if (confidence >= 0.8) return null; // Don't clutter high-confidence items
  if (confidence >= 0.5) {
    return (
      <Badge variant="outline" className="text-[10px] border-warning/50 text-warning gap-0.5">
        <AlertTriangle className="h-2.5 w-2.5" /> Check
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive gap-0.5">
      <ShieldAlert className="h-2.5 w-2.5" /> Uncertain
    </Badge>
  );
};

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
          const r = receiptRes.data;
          let warnings: string[] = [];
          let confidenceBreakdown: ConfidenceBreakdown | null = null;
          try {
            const ocrData = r.raw_ocr_text ? JSON.parse(r.raw_ocr_text) : {};
            warnings = ocrData.warnings || [];
            if (ocrData.date_confidence !== undefined) {
              confidenceBreakdown = {
                date_confidence: ocrData.date_confidence ?? 0,
                total_confidence: ocrData.total_confidence ?? 0,
                item_extraction_confidence: ocrData.item_extraction_confidence ?? 0,
                needs_review: ocrData.needs_review ?? false,
              };
            }
          } catch { /* not JSON, that's fine */ }

          // Use receipt date if available
          if (r.shop_date) {
            setShopDate(r.shop_date);
          }

          loaded.push({
            id,
            storeName: r.store_name || 'Unknown Store',
            storeConfidence: (r as any).store_confidence ?? null,
            storeReviewRequired: (r as any).store_review_required ?? false,
            totalAmount: r.total_amount,
            overallConfidence: (r as any).overall_confidence ?? null,
            confidenceBreakdown,
            warnings,
            items: (itemsRes.data || []).map((item: any) => ({
              id: item.id,
              clean_name: item.clean_name || item.raw_name || '',
              raw_name: item.raw_name || '',
              category: item.category || 'Other',
              price: Number(item.price) || 0,
              quantity: item.quantity || 1,
              is_discount: item.is_discount || false,
              is_food: item.is_food !== undefined ? item.is_food : true,
              confidence: item.confidence !== undefined ? Number(item.confidence) : null,
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

  const removeDocket = async (docketId: string) => {
    try {
      await supabase.from('receipt_items').delete().eq('receipt_id', docketId);
      await supabase.from('receipts').delete().eq('id', docketId);
      setDockets((prev) => prev.filter((d) => d.id !== docketId));
      toast({ title: 'Docket deleted' });
      if (dockets.length <= 1) navigate('/scan');
    } catch (err) {
      console.error('Delete docket error:', err);
      toast({ title: 'Error deleting docket', variant: 'destructive' });
    }
  };

  const updateItem = async (docketId: string, itemId: string, field: string, value: string | number) => {
    setDockets((prev) =>
      prev.map((d) =>
        d.id === docketId
          ? { ...d, items: d.items.map((item) => item.id === itemId ? { ...item, [field]: value } : item) }
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

  const CATEGORIES = [
    'Fresh Produce', 'Meat & Seafood', 'Dairy', 'Bakery', 'Pantry',
    'Frozen', 'Drinks', 'Snacks', 'Household', 'Health & Beauty',
    'Pet', 'Baby', 'Deli', 'Other',
  ];

  const addItem = async (docketId: string) => {
    const { data, error } = await supabase
      .from('receipt_items')
      .insert({
        receipt_id: docketId,
        clean_name: 'New item',
        raw_name: '',
        category: 'Other',
        price: 0,
        quantity: 1,
        is_discount: false,
        is_food: true,
      })
      .select()
      .single();

    if (error || !data) return;

    setDockets((prev) =>
      prev.map((d) =>
        d.id === docketId
          ? {
              ...d,
              items: [
                ...d.items,
                {
                  id: data.id,
                  clean_name: data.clean_name || 'New item',
                  raw_name: data.raw_name || '',
                  category: data.category || 'Other',
                  price: Number(data.price) || 0,
                  quantity: data.quantity || 1,
                  is_discount: data.is_discount || false,
                  is_food: data.is_food !== undefined ? data.is_food : true,
                  confidence: null,
                },
              ],
            }
          : d
      )
    );
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
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
              is_food: item.is_food,
              is_discount: item.is_discount,
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

  // Determine why review is needed
  const reviewReasons: string[] = [];
  for (const d of dockets) {
    if (d.storeReviewRequired) reviewReasons.push('Store needs confirmation');
    if (d.confidenceBreakdown?.total_confidence !== undefined && d.confidenceBreakdown.total_confidence < 0.6)
      reviewReasons.push('Total may be incorrect');
    if (d.confidenceBreakdown?.date_confidence !== undefined && d.confidenceBreakdown.date_confidence < 0.6)
      reviewReasons.push('Date could not be read');
    if (d.items.some((i) => i.confidence !== null && i.confidence < 0.5))
      reviewReasons.push('Some items need checking');
  }
  const uniqueReasons = [...new Set(reviewReasons)];

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-display text-2xl font-bold">Review your shop</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {dockets.length} {dockets.length === 1 ? 'docket' : 'dockets'} · {totalItems} items · ${totalAmount.toFixed(2)}
        </p>
      </div>

      <div className="px-4 space-y-3">
        {/* Why review is needed */}
        {uniqueReasons.length > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-warning">Review needed</p>
                  <ul className="mt-1 space-y-0.5">
                    {uniqueReasons.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed validation warnings */}
        {dockets.some((d) => d.warnings.length > 0) && (
          <Card className="border-muted">
            <CardContent className="p-3 space-y-1">
              {dockets.flatMap((d) => d.warnings).map((w, i) => (
                <p key={i} className="text-xs text-muted-foreground">• {w}</p>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Store confirmation for low-confidence detection */}
        {dockets.some((d) => d.storeReviewRequired) && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              {dockets.filter((d) => d.storeReviewRequired).map((docket) => {
                const STORE_OPTIONS = ['Coles', 'Woolworths', 'Aldi', 'IGA', 'Spudshed', 'Farmer Jacks', 'Costco', 'Harris Farm', 'FoodWorks', 'Drakes', 'Other'];
                const confPct = docket.storeConfidence ? Math.round(docket.storeConfidence * 100) : 0;
                return (
                  <div key={docket.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">
                        We think this receipt is from <strong>{docket.storeName}</strong>
                        {confPct > 0 && <span className="text-muted-foreground font-normal"> ({confPct}% confident)</span>}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Confirm or select the correct store:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STORE_OPTIONS.map((store) => (
                        <button
                          key={store}
                          onClick={() => {
                            updateStoreName(docket.id, store);
                            setDockets((prev) =>
                              prev.map((d) =>
                                d.id === docket.id ? { ...d, storeReviewRequired: false, storeConfidence: 1.0 } : d
                              )
                            );
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            docket.storeName === store
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {store === docket.storeName && <Check className="inline h-3 w-3 mr-1" />}
                          {store}
                        </button>
                      ))}
                    </div>
                    {docket.storeName === 'Other' && (
                      <Input
                        placeholder="Type store name…"
                        className="h-8 text-sm"
                        onChange={(e) => updateStoreName(docket.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Confidence breakdown */}
        {dockets.some((d) => d.overallConfidence !== null) && (
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Scan Confidence</span>
                {dockets.map((d) => {
                  if (d.overallConfidence === null) return null;
                  const pct = Math.round(d.overallConfidence * 100);
                  const isGood = pct >= 75;
                  return (
                    <Badge
                      key={d.id}
                      variant="outline"
                      className={`text-xs gap-1 ${isGood ? 'border-primary/40 text-primary' : 'border-warning/40 text-warning'}`}
                    >
                      {isGood ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                      {pct}% overall
                    </Badge>
                  );
                })}
              </div>
              {dockets.map((d) => {
                const cb = d.confidenceBreakdown;
                if (!cb) return null;
                const fields = [
                  { label: 'Store', score: d.storeConfidence ?? 0 },
                  { label: 'Date', score: cb.date_confidence },
                  { label: 'Items', score: cb.item_extraction_confidence },
                  { label: 'Total', score: cb.total_confidence },
                ];
                return (
                  <div key={d.id} className="grid grid-cols-4 gap-2">
                    {fields.map((f) => {
                      const pct = Math.round(f.score * 100);
                      const isLow = pct < 60;
                      return (
                        <div key={f.label} className={`text-center rounded-lg p-1.5 ${isLow ? 'bg-warning/10' : 'bg-muted/50'}`}>
                          <p className={`text-lg font-bold ${isLow ? 'text-warning' : 'text-foreground'}`}>{pct}%</p>
                          <p className="text-[10px] text-muted-foreground">{f.label}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {dockets.some((d) => d.confidenceBreakdown?.needs_review) && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Some fields need your review before confirming.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
          const lowConfItems = docket.items.filter((i) => i.confidence !== null && i.confidence < 0.5).length;

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
                    {lowConfItems > 0 && (
                      <Badge variant="outline" className="text-[10px] border-warning/50 text-warning gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" /> {lowConfItems} uncertain
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary text-sm">${docketTotal.toFixed(2)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeDocket(docket.id); }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete this docket"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
                  <ReceiptImageViewer receiptId={docket.id} />
                  {docket.items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 border-b pb-3 last:border-0 last:pb-0 ${
                        item.is_discount ? 'opacity-60' : ''
                      } ${item.confidence !== null && item.confidence < 0.5 ? 'bg-warning/5 -mx-2 px-2 rounded-lg' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={item.clean_name}
                            onChange={(e) => updateItem(docket.id, item.id, 'clean_name', e.target.value)}
                            className="h-8 text-sm font-medium border-0 bg-transparent px-0 focus-visible:ring-0"
                          />
                          <ConfidenceBadge confidence={item.confidence} />
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap items-center">
                          <Select
                            value={item.category}
                            onValueChange={(val) => updateItem(docket.id, item.id, 'category', val)}
                          >
                            <SelectTrigger className="h-6 text-xs w-auto border-0 bg-secondary/50 px-2 gap-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {item.is_discount && (
                            <Badge variant="outline" className="text-xs text-destructive">Discount</Badge>
                          )}
                          {!item.is_food && (
                            <Badge variant="outline" className="text-xs">Non-food</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => updateItem(docket.id, item.id, 'price', parseFloat(e.target.value) || 0)}
                            className="h-7 w-20 text-sm font-semibold text-right border-0 bg-transparent px-0 focus-visible:ring-0"
                          />
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={() => addItem(docket.id)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add missing item
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Total vs receipt comparison */}
        {dockets.some((d) => d.totalAmount !== null) && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Calculated total</span>
                <span className="font-semibold">${totalAmount.toFixed(2)}</span>
              </div>
              {dockets.map((d) => {
                if (d.totalAmount === null) return null;
                const diff = Math.abs(totalAmount - d.totalAmount);
                return (
                  <div key={d.id} className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Receipt total</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">${d.totalAmount.toFixed(2)}</span>
                      {diff > 1 ? (
                        <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">
                          ${diff.toFixed(2)} diff
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                          <Check className="h-2.5 w-2.5 mr-0.5" /> Matches
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

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
