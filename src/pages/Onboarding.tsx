import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Users } from 'lucide-react';

const steps = ['Household', 'Preferences', 'Shopping', 'Goals'];

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    adults: '2',
    children: '0',
    childAges: '',
    householdType: 'family',
    dietaryPreferences: '',
    dislikedFoods: '',
    // Shopping practices
    preferredStores: '',
    shoppingFrequency: 'weekly',
    weeklyBudget: '',
    brandPreference: 'mix',
    bulkBuying: false,
    mealPlanning: 'sometimes',
    cookingSkill: 'intermediate',
    leftoverComfort: 'happy',
    // Goals
    budgetPriority: 'balanced',
    mealCount: '5',
  });

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from('households').upsert({
      user_id: user.id,
      adults: parseInt(form.adults),
      children: parseInt(form.children),
      child_ages: form.childAges,
      household_type: form.householdType,
      dietary_preferences: form.dietaryPreferences,
      disliked_foods: form.dislikedFoods,
      preferred_stores: form.preferredStores,
      shopping_frequency: form.shoppingFrequency,
      weekly_budget: form.weeklyBudget,
      brand_preference: form.brandPreference,
      bulk_buying: form.bulkBuying,
      meal_planning: form.mealPlanning,
      cooking_skill: form.cookingSkill,
      leftover_comfort: form.leftoverComfort,
      budget_priority: form.budgetPriority,
      preferred_meal_count: parseInt(form.mealCount),
    } as any);

    setLoading(false);

    if (error) {
      toast.error('Failed to save household profile');
    } else {
      toast.success('Profile saved!');
      navigate('/dashboard');
    }
  };

  const stepDescriptions = [
    "Who's in the house?",
    'Any dietary needs?',
    'How do you shop?',
    'What matters most?',
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-xl font-bold">Tell us about your household</h1>
        <p className="text-sm text-muted-foreground">So we can tailor meals and insights for you</p>
      </div>

      {/* Progress */}
      <div className="mb-6 flex gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-2 w-16 rounded-full transition-colors ${
                i <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          </div>
        ))}
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display text-lg">{steps[step]}</CardTitle>
          <CardDescription>{stepDescriptions[step]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adults</Label>
                  <Select value={form.adults} onValueChange={(v) => update('adults', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Children</Label>
                  <Select value={form.children} onValueChange={(v) => update('children', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {parseInt(form.children) > 0 && (
                <div className="space-y-2">
                  <Label>Child age groups</Label>
                  <Input
                    placeholder="e.g. toddler, primary school, teen"
                    value={form.childAges}
                    onChange={(e) => update('childAges', e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Household type</Label>
                <Select value={form.householdType} onValueChange={(v) => update('householdType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="couple">Couple</SelectItem>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="share-house">Share house</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Dietary preferences or restrictions</Label>
                <Input
                  placeholder="e.g. vegetarian, gluten-free, halal"
                  value={form.dietaryPreferences}
                  onChange={(e) => update('dietaryPreferences', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Disliked foods or picky eater notes</Label>
                <Textarea
                  placeholder="e.g. no mushrooms, kids won't eat fish"
                  value={form.dislikedFoods}
                  onChange={(e) => update('dislikedFoods', e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Preferred stores</Label>
                <Input
                  placeholder="e.g. Coles, Woolworths, Aldi, IGA"
                  value={form.preferredStores}
                  onChange={(e) => update('preferredStores', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>How often do you shop?</Label>
                <Select value={form.shoppingFrequency} onValueChange={(v) => update('shoppingFrequency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="few-times-week">A few times a week</SelectItem>
                    <SelectItem value="weekly">Once a week</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly big shop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Approximate weekly grocery budget</Label>
                <Select value={form.weeklyBudget} onValueChange={(v) => update('weeklyBudget', v)}>
                  <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under-100">Under $100</SelectItem>
                    <SelectItem value="100-150">$100 – $150</SelectItem>
                    <SelectItem value="150-200">$150 – $200</SelectItem>
                    <SelectItem value="200-300">$200 – $300</SelectItem>
                    <SelectItem value="300-plus">$300+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brand preference</Label>
                <Select value={form.brandPreference} onValueChange={(v) => update('brandPreference', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branded">Mostly branded</SelectItem>
                    <SelectItem value="mix">Mix of both</SelectItem>
                    <SelectItem value="homebrand">Mostly homebrand / generic</SelectItem>
                    <SelectItem value="cheapest">Whatever's cheapest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Do you buy in bulk?</Label>
                <Switch
                  checked={form.bulkBuying}
                  onCheckedChange={(v) => update('bulkBuying', v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cooking skill level</Label>
                <Select value={form.cookingSkill} onValueChange={(v) => update('cookingSkill', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner — keep it simple</SelectItem>
                    <SelectItem value="intermediate">Intermediate — happy to try</SelectItem>
                    <SelectItem value="advanced">Advanced — love a challenge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>How do you feel about leftovers?</Label>
                <Select value={form.leftoverComfort} onValueChange={(v) => update('leftoverComfort', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="love">Love them — cook once, eat twice</SelectItem>
                    <SelectItem value="happy">Happy to have them</SelectItem>
                    <SelectItem value="avoid">Prefer fresh each meal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Do you meal plan?</Label>
                <Select value={form.mealPlanning} onValueChange={(v) => update('mealPlanning', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Always — plan every meal</SelectItem>
                    <SelectItem value="sometimes">Sometimes — loose plan</SelectItem>
                    <SelectItem value="never">Never — wing it each day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>What's your priority?</Label>
                <Select value={form.budgetPriority} onValueChange={(v) => update('budgetPriority', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="budget">Save money first</SelectItem>
                    <SelectItem value="health">Eat healthier first</SelectItem>
                    <SelectItem value="balanced">A bit of both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Meal suggestions per shop</Label>
                <Select value={form.mealCount} onValueChange={(v) => update('mealCount', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 7, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} meals</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button className="flex-1" onClick={() => setStep(step + 1)}>
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button className="flex-1 font-semibold" onClick={handleFinish} disabled={loading}>
                {loading ? 'Saving...' : 'Finish setup'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
