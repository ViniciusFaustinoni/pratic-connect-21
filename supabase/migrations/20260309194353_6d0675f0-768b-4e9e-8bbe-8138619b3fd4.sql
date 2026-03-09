
-- Add permissions JSONB column to app_roles_config
ALTER TABLE public.app_roles_config 
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add area_icon and area_color columns for dynamic UI styling
ALTER TABLE public.app_roles_config 
  ADD COLUMN IF NOT EXISTS area_icon text NOT NULL DEFAULT 'Shield',
  ADD COLUMN IF NOT EXISTS area_color text NOT NULL DEFAULT 'gray';

COMMENT ON COLUMN public.app_roles_config.permissions IS 'Array of permission keys granted to this role (e.g. ["canManageUsers","canManageLeads"])';
COMMENT ON COLUMN public.app_roles_config.area_icon IS 'Lucide icon name for the area group in UI';
COMMENT ON COLUMN public.app_roles_config.area_color IS 'Tailwind color name for area styling (e.g. purple, blue)';
