import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, TrendingUp, UtensilsCrossed, Clock, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.email?.split('@')[0] ?? 'there';

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">G'day, {firstName}! 👋</h1>
        <p className="text-sm text-muted-foreground">What did you pick up today?</p>
      </div>

      <div className="px-4 space-y-4">
        {/* Scan CTA */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Camera className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold">Scan a receipt</h2>
              <p className="text-sm text-muted-foreground">Upload your docket to get started</p>
            </div>
            <Button size="sm" onClick={() => navigate('/scan')}>
              Scan <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        {/* Quick stats placeholder */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: TrendingUp, label: 'Shops', value: '0' },
            { icon: UtensilsCrossed, label: 'Meals', value: '0' },
            { icon: Clock, label: 'Saved', value: '$0' },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="flex flex-col items-center p-4 text-center">
                <Icon className="mb-1 h-5 w-5 text-muted-foreground" />
                <span className="font-display text-xl font-bold">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent activity placeholder */}
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p className="text-sm">No receipts scanned yet.</p>
            <p className="text-sm">Scan your first docket to see insights here!</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
