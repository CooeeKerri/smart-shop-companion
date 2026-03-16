import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UtensilsCrossed, Users, AlertTriangle, Crown, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface MealSuggestion {
  title: string;
  reason: string;
  ingredients: string[];
  pantryStaples: string[];
  serves: number;
  category: string;
  useFirst?: boolean;
  premium?: boolean;
}

const mockMeals: MealSuggestion[] = [
  {
    title: 'Chicken & Broccoli Pasta',
    reason: 'Uses your chicken breast, broccoli, and pasta',
    ingredients: ['Chicken breast', 'Broccoli', 'Barilla pasta', 'Cheddar cheese'],
    pantryStaples: ['Olive oil', 'Garlic', 'Salt & pepper'],
    serves: 4,
    category: 'dinner',
    useFirst: true,
  },
  {
    title: 'Cheesy Pasta Bake',
    reason: 'Uses your pasta, passata, and cheddar',
    ingredients: ['Barilla pasta', 'Passata', 'Cheddar cheese'],
    pantryStaples: ['Mixed herbs', 'Onion'],
    serves: 4,
    category: 'dinner',
  },
  {
    title: 'Banana on Toast',
    reason: 'Quick breakfast with your bananas and bread',
    ingredients: ['Bananas', 'Tip Top Bread'],
    pantryStaples: ['Honey or peanut butter'],
    serves: 2,
    category: 'breakfast',
  },
  // Premium meals
  {
    title: 'Chicken Stir-Fry with Veggie Rice',
    reason: 'A quick dinner using your chicken and fresh veg',
    ingredients: ['Chicken breast', 'Broccoli', 'Capsicum'],
    pantryStaples: ['Soy sauce', 'Sesame oil', 'Rice'],
    serves: 4,
    category: 'dinner',
    premium: true,
  },
  {
    title: 'Chicken & Cheese Sandwich',
    reason: 'Uses leftover chicken, bread, and cheese',
    ingredients: ['Chicken breast (cooked)', 'Tip Top Bread', 'Cheddar cheese'],
    pantryStaples: ['Mayo', 'Lettuce'],
    serves: 2,
    category: 'lunch',
    premium: true,
  },
  {
    title: 'Banana Smoothie',
    reason: 'Great way to use up ripe bananas',
    ingredients: ['Bananas', 'Woolworths Milk'],
    pantryStaples: ['Honey', 'Ice'],
    serves: 2,
    category: 'snack',
    useFirst: true,
    premium: true,
  },
];

const categories = ['all', 'dinner', 'lunch', 'breakfast', 'snack'] as const;

const MealCard = ({ meal, locked }: { meal: MealSuggestion; locked: boolean }) => (
  <Card className={`animate-fade-in ${locked ? 'relative overflow-hidden' : ''}`}>
    {locked && (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-[2px]">
        <div className="flex flex-col items-center gap-1.5 text-center px-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground">Premium idea</p>
        </div>
      </div>
    )}
    <CardHeader className="pb-2">
      <div className="flex items-start justify-between gap-2">
        <CardTitle className="font-display text-base">{meal.title}</CardTitle>
        <div className="flex gap-1.5 shrink-0">
          {meal.useFirst && (
            <Badge className="bg-warning/15 text-warning border-warning/30 text-xs">
              <AlertTriangle className="mr-1 h-3 w-3" /> Use first
            </Badge>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{meal.reason}</p>
    </CardHeader>
    <CardContent className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">From your trolley:</p>
        <div className="flex flex-wrap gap-1">
          {meal.ingredients.map((i) => (
            <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
          ))}
        </div>
      </div>
      {meal.pantryStaples.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Pantry staples needed:</p>
          <p className="text-xs text-muted-foreground">{meal.pantryStaples.join(', ')}</p>
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Serves {meal.serves}</span>
      </div>
    </CardContent>
  </Card>
);

const Meals = () => {
  const navigate = useNavigate();
  const { isPremium } = useSubscription();

  const freeMeals = mockMeals.filter((m) => !m.premium);
  const premiumMeals = mockMeals.filter((m) => m.premium);

  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">What You Can Rustle Up</h1>
        <p className="text-sm text-muted-foreground">Based on your latest shop</p>
      </div>

      <div className="px-4 space-y-4">
        <Tabs defaultValue="all">
          <TabsList className="w-full justify-start overflow-x-auto">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="capitalize text-xs">
                {cat === 'all' ? 'All meals' : cat}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-3 mt-3">
              {/* Free meals */}
              {freeMeals
                .filter((m) => cat === 'all' || m.category === cat)
                .map((meal) => (
                  <MealCard key={meal.title} meal={meal} locked={false} />
                ))}

              {/* Premium upsell divider */}
              {premiumMeals.filter((m) => cat === 'all' || m.category === cat).length > 0 && (
                <>
                  {!isPremium && (
                    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent">
                      <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <Crown className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-sm">
                            Unlock {premiumMeals.filter((m) => cat === 'all' || m.category === cat).length} more meal ideas
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Get personalised meals for every item you buy — breakfast, lunch, dinner & snacks
                          </p>
                        </div>
                        <Button onClick={() => navigate('/premium')} className="gap-2">
                          <Sparkles className="h-4 w-4" />
                          Go Premium
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Show premium meals — unlocked or blurred */}
                  {premiumMeals
                    .filter((m) => cat === 'all' || m.category === cat)
                    .map((meal) => (
                      <MealCard key={meal.title} meal={meal} locked={!isPremium} />
                    ))}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Meals;
