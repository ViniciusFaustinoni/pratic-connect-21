-- Add sort_priority and requires_recent_year to product_lines
ALTER TABLE public.product_lines 
  ADD COLUMN IF NOT EXISTS sort_priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS requires_recent_year boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gradient_class text;

-- Update existing product lines with correct values
UPDATE public.product_lines SET sort_priority = 1, gradient_class = 'from-blue-500 to-blue-600' WHERE slug = 'select';
UPDATE public.product_lines SET sort_priority = 3, gradient_class = 'from-orange-500 to-amber-600' WHERE slug = 'especial';
UPDATE public.product_lines SET sort_priority = 4, requires_recent_year = true, gradient_class = 'from-violet-500 to-purple-600' WHERE slug = 'lancamento';
UPDATE public.product_lines SET sort_priority = 5, gradient_class = 'from-red-500 to-rose-600' WHERE slug = 'advanced';

-- Insert missing select-one line
INSERT INTO public.product_lines (name, slug, icon, color, display_order, is_active, vehicle_type, sort_priority, gradient_class)
VALUES ('Linha Select One', 'select-one', '🔷', 'emerald', 1, true, 'car', 2, 'from-emerald-500 to-green-600')
ON CONFLICT DO NOTHING;