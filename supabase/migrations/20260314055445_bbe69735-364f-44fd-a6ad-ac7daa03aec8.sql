-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Households table
CREATE TABLE public.households (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  adults INTEGER NOT NULL DEFAULT 2,
  children INTEGER NOT NULL DEFAULT 0,
  child_ages TEXT,
  household_type TEXT NOT NULL DEFAULT 'family',
  dietary_preferences TEXT,
  budget_priority TEXT NOT NULL DEFAULT 'balanced',
  preferred_meal_count INTEGER NOT NULL DEFAULT 5,
  disliked_foods TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household" ON public.households FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own household" ON public.households FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own household" ON public.households FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON public.households
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Receipts table
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT,
  shop_date DATE,
  total_amount NUMERIC(10,2),
  image_url TEXT,
  raw_ocr_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  value_score INTEGER,
  health_score INTEGER,
  meal_potential_score INTEGER,
  waste_risk_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own receipts" ON public.receipts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own receipts" ON public.receipts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own receipts" ON public.receipts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own receipts" ON public.receipts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Receipt items table
CREATE TABLE public.receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  raw_name TEXT,
  clean_name TEXT,
  category TEXT,
  price NUMERIC(10,2),
  quantity INTEGER NOT NULL DEFAULT 1,
  is_discount BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own receipt items" ON public.receipt_items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = receipt_items.receipt_id AND receipts.user_id = auth.uid())
);
CREATE POLICY "Users can insert own receipt items" ON public.receipt_items
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = receipt_items.receipt_id AND receipts.user_id = auth.uid())
);
CREATE POLICY "Users can update own receipt items" ON public.receipt_items
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = receipt_items.receipt_id AND receipts.user_id = auth.uid())
);
CREATE POLICY "Users can delete own receipt items" ON public.receipt_items
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = receipt_items.receipt_id AND receipts.user_id = auth.uid())
);

-- Meal suggestions table
CREATE TABLE public.meal_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  reason TEXT,
  ingredients JSONB,
  pantry_staples JSONB,
  serves INTEGER,
  use_first BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal suggestions" ON public.meal_suggestions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = meal_suggestions.receipt_id AND receipts.user_id = auth.uid())
);
CREATE POLICY "Users can insert own meal suggestions" ON public.meal_suggestions
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = meal_suggestions.receipt_id AND receipts.user_id = auth.uid())
);

-- Recommendations table (cheaper/healthier swaps)
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  current_item TEXT NOT NULL,
  suggested_item TEXT NOT NULL,
  reason TEXT,
  potential_saving NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations" ON public.recommendations
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = recommendations.receipt_id AND receipts.user_id = auth.uid())
);
CREATE POLICY "Users can insert own recommendations" ON public.recommendations
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.receipts WHERE receipts.id = recommendations.receipt_id AND receipts.user_id = auth.uid())
);

-- Storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

CREATE POLICY "Users can upload own receipts" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own receipt images" ON storage.objects
FOR SELECT USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);