-- Grant permissions on vistorias table for public access (link do associado)
GRANT SELECT, INSERT, UPDATE ON public.vistorias TO anon;
GRANT SELECT, INSERT, UPDATE ON public.vistorias TO authenticated;

-- Grant permissions on contratos_historico for logging events
GRANT SELECT, INSERT ON public.contratos_historico TO anon;
GRANT SELECT, INSERT ON public.contratos_historico TO authenticated;

-- Grant permissions on vistoria_fotos for photo uploads
GRANT SELECT, INSERT ON public.vistoria_fotos TO anon;
GRANT SELECT, INSERT ON public.vistoria_fotos TO authenticated;