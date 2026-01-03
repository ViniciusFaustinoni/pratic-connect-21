-- Add notification preferences columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notif_novos_leads BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notif_documentos_pendentes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notif_resumo_diario BOOLEAN DEFAULT false;