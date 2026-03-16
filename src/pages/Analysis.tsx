import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import SmartInsight from '@/components/SmartInsight';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Heart, UtensilsCrossed, AlertTriangle, ArrowRight, ArrowDown, ArrowUp, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ReceiptMeta {
  id: string;
  store_name: string | null;
  total_amount: number | null;
  shop_date: string | null;
  value_score: number | null;
  health_score: number | null;
  meal_potential_score: number | null;
  waste_risk_score: number | null;
}

interface AnalysisData {
  scores: { value: number; health: number; meal_potential: number; waste_risk: number };
  best_value: { item: string; note: string }[];
  cheaper_swaps: { current: string; current_price: string; swap: string; swap_price: string; save: string }[];
  healthier_swaps: { current: string; swap: string; reason: string }[];
}

const scoreConfig = [
  { key: 'value' as const, icon: TrendingUp, label: 'Value', color: 'text-primary' },
  { key: 'health' as const, icon: Heart, label: 'Health', color: 'text-destructive' },
  { key: 'meal_potential' as const, icon: UtensilsCrossed, label: 'Meal potential', color: 'text-secondary' },
  { key: 'waste_risk' as const, icon: AlertTriangle, label: 'Waste risk', color: 'text-warning' },
];

const Analysis = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<ReceiptMeta | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (user) loadLatestReceipt();
  }, [user]);

  const loadLatestReceipt = async () => {
    const { data } = await supabase
      .from('receipts')
      .select('id, store_name, total_amount, shop_date, value_score, health_score, meal_potential_score, waste_risk_score')
      .eq('user_id', user!.id)
      .in('status', ['confirmed', 'reviewed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setReceipt(data);
      // If we already have scores, load recommendations from DB
      if (data.value_score !== null) {
        await loadRecommendations(data.id, data);
      } else {
        // Auto-run analysis
        await runAnalysis(data.id);
      }
    }
    setLoading(false);
  };

  const loadRecommendations = async (receiptId: string, receiptData: ReceiptMeta) => {
    const { data: recs } = await supabase
      .from('recommendations')
      .select('current_item, suggested_item, potential_saving, reason, type')
      .eq('receipt_id', receiptId);

    // Also get best value from items (top items by low price relative to category)
    const { data: items } = await supabase
      .from('receipt_items')
      .select('clean_name, price, quantity, is_discount, is_food')
      .eq('receipt_id', receiptId)
      .eq('is_food', true)
      .eq('is_discount', false)
      .order('price', { ascending: true })
      .limit(3);

    const cheaperSwaps = (recs || [])
      .filter((r) => r.type === 'cheaper_swap')
      .map((r) => {
        const saving = r.potential_saving ? `$${Number(r.potential_saving).toFixed(2)}` : '';
        return {
          current: r.current_item,
          current_price: '',
          swap: r.suggested_item,
          swap_price: '',
          save: saving,
        };
      });

    const healthierSwaps = (recs || [])
      .filter((r) => r.type === 'healthier_swap')
      .map((r) => ({
        current: r.current_item,
        swap: r.suggested_item,
        reason: r.reason || '',
      }));

    const bestValue = (items || []).slice(0, 3).map((i) => ({
      item: i.clean_name || 'Unknown',
      note: `$${Number(i.price).toFixed(2)}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`,
    }));

    setAnalysis({
      scores: {
        value: receiptData.value_score ?? 0,
        health: receiptData.health_score ?? 0,
        meal_potential: receiptData.meal_potential_score ?? 0,
        waste_risk: receiptData.waste_risk_score ?? 0,
      },
      best_value: bestValue,
      cheaper_swaps: cheaperSwaps,
      healthier_swaps: healthierSwaps,
    });
  };

  const runAnalysis = async (receiptId?: string) => {
    const id = receiptId || receipt?.id;
    if (!id) return;
    setAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-receipt', {
        body: { receipt_id: id },
      });

      if (error) throw error;

      setAnalysis(data);

      // Update local receipt scores
      if (data.scores && receipt) {
        setReceipt({
          ...receipt,
          value_score: data.scores.value,
          health_score: data.scores.health,
          meal_potential_score: data.scores.meal_potential,
          waste_risk_score: data.scores.waste_risk,
        });
      }
    } catch (err) {
      console.error('Analysis error:', err);
      toast({ title: 'Analysis failed', description: 'Could not analyse your receipt. Try again.', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const shortStoreName = (name: string | null) => {
    if (!name) return 'Unknown store';
    return name.replace(/\s*(Supermarkets?|Australia|Pty|Ltd|Group)\s*/gi, ' ').trim();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="px-4 pt-6 pb-4 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!receipt) {
    return (
      <AppLayout>
        <div className="px-4 pt-6 pb-4 text-center">
            <h1 className="font-display text-2xl font-bold">Your Trolley Report</h1>
          <p className="text-sm text-muted-foreground mt-2">Scan a docket to see how your shop went</p>
          <Button className="mt-4" onClick={() => navigate('/scan')}>Scan a receipt</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">How'd Your Shop Go?</h1>
            <p className="text-sm text-muted-foreground">
              {shortStoreName(receipt.store_name)} · {formatDate(receipt.shop_date)} · ${receipt.total_amount?.toFixed(2) ?? '—'}
            </p>
          </div>
          {analysis && (
            <Button variant="ghost" size="icon" onClick={() => runAnalysis()} disabled={analyzing}>
              <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Smart Insight */}
        <SmartInsight receiptIds={[receipt.id]} />

        {analyzing && !analysis && (
          <Card className="border-primary/20">
            <CardContent className="p-6 flex flex-col items-center gap-3">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analysing your shop...</p>
            </CardContent>
          </Card>
        )}

        {analysis && (
          <>
            {/* Score cards */}
            <div className="grid grid-cols-2 gap-3">
              {scoreConfig.map(({ key, icon: Icon, label, color }) => (
                <Card key={key}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <span className="font-display text-2xl font-bold">{analysis.scores[key]}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                    <Progress value={analysis.scores[key]} className="mt-2 h-1.5" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Best value */}
            {analysis.best_value.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <ArrowDown className="h-4 w-4 text-primary" /> Best value buys
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.best_value.map((b) => (
                    <div key={b.item} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{b.item}</span>
                      <Badge variant="secondary" className="text-xs">{b.note}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Cheaper swaps */}
            {analysis.cheaper_swaps.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <ArrowUp className="h-4 w-4 text-secondary" /> Cheaper swaps for next time
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.cheaper_swaps.map((s) => (
                    <div key={s.current} className="border-b pb-2 last:border-0 last:pb-0">
                      <p className="text-sm">{s.current} {s.current_price && `${s.current_price}`}</p>
                      <p className="text-sm text-primary font-medium">→ {s.swap}</p>
                      {s.save && <Badge className="mt-1 text-xs bg-primary/10 text-primary border-0">Save {s.save}</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Healthier swaps */}
            {analysis.healthier_swaps.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <Heart className="h-4 w-4 text-destructive" /> Healthier swaps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.healthier_swaps.map((s) => (
                    <div key={s.current} className="border-b pb-2 last:border-0 last:pb-0">
                      <p className="text-sm">{s.current}</p>
                      <p className="text-sm text-primary font-medium">→ {s.swap}</p>
                      <Badge variant="outline" className="mt-1 text-xs">{s.reason}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* View meals CTA */}
        <Button
          className="w-full font-semibold gap-2"
          size="lg"
          onClick={() => navigate('/meals')}
        >
          <Sparkles className="h-4 w-4" />
          View meal suggestions
          <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="h-4" />
      </div>
    </AppLayout>
  );
};

export default Analysis;
