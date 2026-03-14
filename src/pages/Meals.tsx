import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UtensilsCrossed, Users, Clock, AlertTriangle } from 'lucide-react';

interface MealSuggestion {
  title: string;
  reason: string;
  ingredients: string[];
  pantryStaples: string[];
  serves: number;
  category: string;
  useFirst?: boolean;
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
  {
    title: 'Chicken & Cheese Sandwich',
    reason: 'Uses leftover chicken, bread, and cheese',
    ingredients: ['Chicken breast (cooked)', 'Tip Top Bread', 'Cheddar cheese'],
    pantryStaples: ['Mayo', 'Lettuce'],
    serves: 2,
    category: 'lunch',
  },
  {
    title: 'Banana Smoothie',
    reason: 'Great way to use up ripe bananas',
    ingredients: ['Bananas', 'Woolworths Milk'],
    pantryStaples: ['Honey', 'Ice'],
    serves: 2,
    category: 'snack',
    useFirst: true,
  },
];

const categories = ['all', 'dinner', 'lunch', 'breakfast', 'snack'] as const;

const MealCard = ({ meal }: { meal: MealSuggestion }) => (
  <Card className="animate-fade-in">
    <CardHeader className="pb-2">
      <div className="flex items-start justify-between gap-2">
        <CardTitle className="font-display text-base">{meal.title}</CardTitle>
        {meal.useFirst && (
          <Badge className="shrink-0 bg-warning/15 text-warning border-warning/30 text-xs">
            <AlertTriangle className="mr-1 h-3 w-3" /> Use first
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{meal.reason}</p>
    </CardHeader>
    <CardContent className="space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">From your shop:</p>
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
  return (
    <AppLayout>
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-2xl font-bold">Meal ideas</h1>
        <p className="text-sm text-muted-foreground">Based on your latest shop</p>
      </div>

      <div className="px-4">
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
              {mockMeals
                .filter((m) => cat === 'all' || m.category === cat)
                .map((meal) => (
                  <MealCard key={meal.title} meal={meal} />
                ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Meals;
