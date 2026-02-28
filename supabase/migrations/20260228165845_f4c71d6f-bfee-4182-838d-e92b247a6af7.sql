
-- 1. Add can_edit column to existing role_module_visibility
ALTER TABLE public.role_module_visibility 
ADD COLUMN IF NOT EXISTS can_edit boolean DEFAULT true;

-- 2. Create role_module_item_visibility table
CREATE TABLE IF NOT EXISTS public.role_module_item_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module_id text NOT NULL,
  item_id text NOT NULL,
  visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role, module_id, item_id)
);

-- 3. Enable RLS
ALTER TABLE public.role_module_item_visibility ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies - anyone authenticated can read
CREATE POLICY "Authenticated users can read item visibility"
  ON public.role_module_item_visibility
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. Only directors can modify (using has_role function)
CREATE POLICY "Directors can manage item visibility"
  ON public.role_module_item_visibility
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'desenvolvedor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'desenvolvedor')
  );
