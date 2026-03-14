ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS store_confidence numeric DEFAULT NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS store_review_required boolean DEFAULT false;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS detected_abn text DEFAULT NULL;