
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS preferred_stores text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shopping_frequency text DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS weekly_budget text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS brand_preference text DEFAULT 'mix',
  ADD COLUMN IF NOT EXISTS bulk_buying boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS meal_planning text DEFAULT 'sometimes',
  ADD COLUMN IF NOT EXISTS cooking_skill text DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS leftover_comfort text DEFAULT 'happy';
