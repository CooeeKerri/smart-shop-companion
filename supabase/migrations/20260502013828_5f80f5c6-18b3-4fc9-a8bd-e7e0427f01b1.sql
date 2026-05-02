
-- 1. scan_errors: log failed scans
CREATE TABLE public.scan_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  receipt_id UUID,
  error_type TEXT NOT NULL,
  error_message TEXT,
  raw_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scan_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own scan errors" ON public.scan_errors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scan errors" ON public.scan_errors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scan errors" ON public.scan_errors FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_scan_errors_user ON public.scan_errors(user_id, created_at DESC);

-- 2. product_aliases: learned corrections
CREATE TABLE public.product_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_name TEXT,
  raw_text TEXT NOT NULL,
  cleaned_name TEXT NOT NULL,
  ingredient_keyword TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_name, raw_text)
);
ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own aliases" ON public.product_aliases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own aliases" ON public.product_aliases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own aliases" ON public.product_aliases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own aliases" ON public.product_aliases FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_product_aliases_lookup ON public.product_aliases(user_id, store_name, raw_text);
CREATE TRIGGER trg_product_aliases_updated
  BEFORE UPDATE ON public.product_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. pantry_items: real pantry
CREATE TABLE public.pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_receipt_item_id UUID,
  name TEXT NOT NULL,
  ingredient_keyword TEXT,
  category TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  estimated_expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pantry" ON public.pantry_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pantry" ON public.pantry_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pantry" ON public.pantry_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own pantry" ON public.pantry_items FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_pantry_items_user ON public.pantry_items(user_id, status);
CREATE TRIGGER trg_pantry_items_updated
  BEFORE UPDATE ON public.pantry_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. receipts: keep original image + debug fields
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS original_image_url TEXT,
  ADD COLUMN IF NOT EXISTS original_image_paths TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extraction_method TEXT,
  ADD COLUMN IF NOT EXISTS raw_extraction_json JSONB;

-- 5. receipt_items: numeric quantity + unit (for weighted items)
ALTER TABLE public.receipt_items
  ALTER COLUMN quantity TYPE NUMERIC USING quantity::numeric,
  ALTER COLUMN quantity SET DEFAULT 1;
ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS unit TEXT;
