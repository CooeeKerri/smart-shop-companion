import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import SmartInsight from '@/components/SmartInsight';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Heart, UtensilsCrossed, AlertTriangle, ArrowRight, ArrowDown, ArrowUp, Sparkles } from 'lucide-react';

const scores = [
  { icon: TrendingUp, label: 'Value', score: 72, color: 'text-primary' },
  { icon: Heart, label: 'Health', score: 65, color: 'text-destructive' },
  { icon: UtensilsCrossed, label: 'Meal potential', score: 80, color: 'text-secondary' },
  { icon: AlertTriangle, label: 'Waste risk', score: 30, color: 'text-warning' },
];

const Analysis = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Shop analysis</h1>
        <p className="text-sm text-muted-foreground">Woolworths · 14 Mar 2026 · $32.00</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Score cards */}
        <div className="grid grid-cols-2 gap-3">
          {scores.map(({ icon: Icon, label, score, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <span className="font-display text-2xl font-bold">{score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
                <Progress value={score} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Best value */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-primary" /> Best value buys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { item: 'Barilla Pasta 500g', note: 'Great price at $2.00 each' },
              { item: 'Passata 700ml', note: 'Solid staple at $1.80' },
            ].map((b) => (
              <div key={b.item} className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.item}</span>
                <Badge variant="secondary" className="text-xs">{b.note}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cheaper swaps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-secondary" /> Cheaper swaps for next time
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { current: 'Tip Top Bread White $3.80', swap: 'Homebrand White Bread $1.80', save: '$2.00' },
              { current: 'Cheddar Cheese 250g $4.50', swap: 'Homebrand Cheddar 250g $3.20', save: '$1.30' },
            ].map((s) => (
              <div key={s.current} className="border-b pb-2 last:border-0 last:pb-0">
                <p className="text-sm">{s.current}</p>
                <p className="text-sm text-primary font-medium">→ {s.swap}</p>
                <Badge className="mt-1 text-xs bg-primary/10 text-primary border-0">Save {s.save}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Healthier swaps */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-destructive" /> Healthier swaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { current: 'Tip Top White Bread', swap: 'Wholemeal or multigrain bread', reason: 'More fibre' },
              { current: 'Woolworths Milk 2L (full cream)', swap: 'Reduced fat milk', reason: 'Lower saturated fat' },
            ].map((s) => (
              <div key={s.current} className="border-b pb-2 last:border-0 last:pb-0">
                <p className="text-sm">{s.current}</p>
                <p className="text-sm text-primary font-medium">→ {s.swap}</p>
                <Badge variant="outline" className="mt-1 text-xs">{s.reason}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

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
