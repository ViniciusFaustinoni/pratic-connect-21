-- Adiciona cancelled_at em vistoria_prestador_links (paridade com instalacao_prestador_links)
ALTER TABLE public.vistoria_prestador_links
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Cancela link "fantasma" do MARCUS (criado em teste sem envio de WhatsApp,
-- estava bloqueando reatribuição da vistoria 2101860d).
UPDATE public.vistoria_prestador_links
SET status = 'cancelada',
    cancelled_at = NOW(),
    updated_at = NOW()
WHERE id = '5eda6b02-a5dc-44bc-a246-98ab3c136d0c'
  AND status = 'aguardando';
