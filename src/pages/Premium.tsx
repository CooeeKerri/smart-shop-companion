import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Crown, Check, Camera, PartyPopper, Calendar, Package, Calculator,
  Zap, AlertTriangle, ArrowLeftRight, Bot, ChefHat, ArrowRight, Tag,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';

const freeFeatures = [
  '3 receipt scans per week',
  'Basic item extraction',
  'Simple spend summary',
  '5 meal ideas per scan',
  'Basic waste alerts',
];

const premiumFeatures = [
  { icon: Camera, label: 'Unlimited receipt scans' },
  { icon: PartyPopper, label: 'Dinner & Occasion Planner AI' },
  { icon: Calendar, label: 'Weekly Meal Planner' },
  { icon: Package, label: 'Pantry Tracking' },
  { icon: Calculator, label: '"Make It or Buy It" Calculator' },
  { icon: Zap, label: 'Impulse Purchase Insights' },
  { icon: AlertTriangle, label: 'Smart Waste Alerts' },
  { icon: ArrowLeftRight, label: 'Smart Substitutions' },
  { icon: Bot, label: 'Budget Mate AI Assistant' },
  { icon: ChefHat, label: 'Advanced Meal Suggestions' },
  { icon: Tag, label: 'Specials Catalogue Access' },
];

const Premium = () => {
  const navigate = useNavigate();
  const { isPremium } = useSubscription();

  const handleUpgrade = () => {
    toast({ title: 'Coming soon!', description: 'Premium subscriptions will be available shortly.' });
  };

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-3">
          <Crown className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold">
          {isPremium ? 'You\'re on Premium!' : 'Upgrade to Premium'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isPremium ? 'You have access to all features' : 'Unlock the full power of your grocery data'}
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Pricing card */}
        {!isPremium && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
            <CardContent className="p-6 text-center">
              <Badge className="mb-3 bg-primary/10 text-primary border-primary/30">Most Popular</Badge>
              <div className="mb-1">
                <span className="font-display text-4xl font-bold">$5.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">or $49.99/year (save 30%)</p>
              <Button className="w-full gap-2" size="lg" onClick={handleUpgrade}>
                <Crown className="h-4 w-4" /> Start Premium
              </Button>
              <p className="text-xs text-muted-foreground mt-2">7-day free trial · Cancel anytime</p>
            </CardContent>
          </Card>
        )}

        {/* Premium features */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" /> Premium includes
            </h3>
            <div className="space-y-2.5">
              {premiumFeatures.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm">{label}</span>
                  <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Free tier */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-display font-semibold text-sm mb-3">Free plan includes</h3>
            <div className="space-y-2">
              {freeFeatures.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick access to premium pages */}
        {isPremium && (
          <div className="space-y-2">
            <h3 className="font-display font-semibold text-sm px-1">Quick access</h3>
            {[
              { label: 'Meal Planner', path: '/meal-planner', icon: Calendar },
              { label: 'Pantry Tracker', path: '/pantry', icon: Package },
              { label: 'Make or Buy', path: '/make-or-buy', icon: Calculator },
              { label: 'Impulse Insights', path: '/impulse-insights', icon: Zap },
              { label: 'Price Comparison', path: '/price-comparison', icon: ArrowLeftRight },
              { label: 'Party Planner', path: '/occasion-chat', icon: PartyPopper },
              { label: 'Budget Mate', path: '/budget-chat', icon: Bot },
            ].map(({ label, path, icon: Icon }) => (
              <Card key={path} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(path)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium flex-1">{label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="h-4" />
      </div>
    </AppLayout>
  );
};

export default Premium;
