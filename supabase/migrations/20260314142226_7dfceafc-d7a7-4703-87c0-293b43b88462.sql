ALTER TABLE public.receipt_items ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS receipt_time text DEFAULT NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS total_discounts numeric DEFAULT NULL;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS overall_confidence numeric DEFAULT NULL;