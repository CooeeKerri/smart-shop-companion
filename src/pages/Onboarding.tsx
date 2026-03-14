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
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Users } from 'lucide-react';

const steps = ['Household', 'Preferences', 'Goals'];

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
    budgetPriority: 'balanced',
    mealCount: '5',
    dislikedFoods: '',
  });

  const update = (field: string, value: string) =>
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
      budget_priority: form.budgetPriority,
      preferred_meal_count: parseInt(form.mealCount),
      disliked_foods: form.dislikedFoods,
    } as any);

    setLoading(false);

    if (error) {
      toast.error('Failed to save household profile');
    } else {
      toast.success('Profile saved!');
      navigate('/dashboard');
    }
  };

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
          <CardDescription>
            {step === 0 && 'Who\'s in the house?'}
            {step === 1 && 'Any dietary needs?'}
            {step === 2 && 'What matters most?'}
          </CardDescription>
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
