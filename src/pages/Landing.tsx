import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Receipt, ShoppingCart, UtensilsCrossed, TrendingDown, ArrowRight, Sparkles } from 'lucide-react';

const features = [
  {
    icon: Receipt,
    title: 'Scan your docket',
    description: 'Upload or photograph your grocery receipt and we\'ll extract every item automatically.',
  },
  {
    icon: TrendingDown,
    title: 'Spot savings',
    description: 'See what was great value and where you could save next time with cheaper swaps.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Get meal ideas',
    description: 'Realistic, family-friendly meals based on what you actually bought — not a fantasy list.',
  },
  {
    icon: ShoppingCart,
    title: 'Healthier swaps',
    description: 'Simple suggestions for healthier alternatives you can pick up on your next shop.',
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/6" />
        <div className="relative mx-auto max-w-lg text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Smart post-shop intelligence
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Shop first.
            <br />
            <span className="text-primary">Plan later.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Scan your grocery receipt and get meal ideas, savings insights, healthier swaps, and next-time guidance based on what you actually bought.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="gap-2 text-base font-semibold shadow-lg shadow-primary/20"
              onClick={() => navigate('/auth')}
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base"
              onClick={() => navigate('/auth?mode=login')}
            >
              Sign in
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-lg space-y-4">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="flex gap-4 rounded-xl border bg-card p-4 shadow-sm animate-slide-up"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
        <p>Made for Aussie families who shop smart 🇦🇺</p>
      </footer>
    </div>
  );
};

export default Landing;
