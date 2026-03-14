import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChefHat, Clock, Users, ShoppingBasket, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import UpgradePrompt from '@/components/UpgradePrompt';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const placeholderPlan = [
  { day: 'Monday', meal: 'Chicken Stir Fry', time: '30 min', serves: 4 },
  { day: 'Tuesday', meal: 'Pasta Bolognese', time: '40 min', serves: 4 },
  { day: 'Wednesday', meal: 'Fish Tacos', time: '25 min', serves: 4 },
  { day: 'Thursday', meal: 'Leftover Bolognese Bake', time: '20 min', serves: 4 },
  { day: 'Friday', meal: 'Homemade Pizza', time: '45 min', serves: 4 },
  { day: 'Saturday', meal: 'BBQ Sausages & Salad', time: '30 min', serves: 4 },
  { day: 'Sunday', meal: 'Roast Chicken & Veggies', time: '90 min', serves: 6 },
];

const MealPlanner = () => {
  const navigate = useNavigate();
  const { isPremium, loading } = useSubscription();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!isPremium) {
    return (
      <AppLayout>
        <div className="px-4 pt-6 pb-4">
          <h1 className="font-display text-2xl font-bold">Weekly Meal Planner</h1>
          <p className="text-sm text-muted-foreground">Plan your week's meals and auto-generate shopping lists</p>
        </div>
        <div className="px-4">
          <UpgradePrompt
            feature="Weekly Meal Planner"
            description="AI generates a full week of meals based on your budget, household size, and dietary needs — then creates your shopping list automatically."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Weekly Meal Planner</h1>
            <p className="text-sm text-muted-foreground">Week of 17 Mar 2026</p>
          </div>
          <Button size="sm" variant="outline">
            <Calendar className="h-4 w-4 mr-1" /> Regenerate
          </Button>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {placeholderPlan.map((item) => (
          <Card key={item.day}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ChefHat className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">{item.day}</p>
                <p className="text-sm font-semibold truncate">{item.meal}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.time}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Serves {item.serves}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button className="w-full gap-2" size="lg">
          <ShoppingBasket className="h-4 w-4" /> Generate Shopping List
        </Button>
        <div className="h-4" />
      </div>
    </AppLayout>
  );
};

export default MealPlanner;
