-- Escopo da atribuição a prestador externo
-- 'fotos_instalacao' = vistoria + instalação/troca de rastreador (default histórico)
-- 'somente_fotos'    = vistoria sem mexer no rastreador (link público esconde IMEI)

ALTER TABLE public.instalacao_prestador_links
  ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'fotos_instalacao';

ALTER TABLE public.instalacao_prestador_links
  DROP CONSTRAINT IF EXISTS instalacao_prestador_links_escopo_check;
ALTER TABLE public.instalacao_prestador_links
  ADD CONSTRAINT instalacao_prestador_links_escopo_check
  CHECK (escopo IN ('somente_fotos','fotos_instalacao'));

-- Espelho na tabela de links de vistoria-pura (sempre 'somente_fotos' por natureza,
-- mas guardamos a coluna para auditoria e paridade)
ALTER TABLE public.vistoria_prestador_links
  ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'somente_fotos';

ALTER TABLE public.vistoria_prestador_links
  DROP CONSTRAINT IF EXISTS vistoria_prestador_links_escopo_check;
ALTER TABLE public.vistoria_prestador_links
  ADD CONSTRAINT vistoria_prestador_links_escopo_check
  CHECK (escopo IN ('somente_fotos','fotos_instalacao'));