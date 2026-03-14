import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface UpgradePromptProps {
  feature: string;
  description?: string;
  compact?: boolean;
}

const UpgradePrompt = ({ feature, description, compact = false }: UpgradePromptProps) => {
  const handleUpgrade = () => {
    toast({ title: 'Coming soon!', description: 'Premium subscriptions will be available shortly.' });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/20 p-3">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground flex-1">
          <span className="font-medium">{feature}</span> is a premium feature
        </p>
        <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" onClick={handleUpgrade}>
          <Crown className="h-3 w-3 mr-1" /> Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="flex flex-col items-center text-center gap-3 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold">{feature}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {description || 'Upgrade to Premium to unlock this feature'}
          </p>
        </div>
        <Button onClick={handleUpgrade} className="gap-2">
          <Crown className="h-4 w-4" /> Upgrade to Premium
        </Button>
      </CardContent>
    </Card>
  );
};

export default UpgradePrompt;
