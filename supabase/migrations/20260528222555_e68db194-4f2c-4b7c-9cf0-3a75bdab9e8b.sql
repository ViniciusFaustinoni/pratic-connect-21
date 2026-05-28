-- Regra das 3 pontas para efetivação de troca de titularidade.
-- Adiciona colunas para rastrear o estado da ponta "plataforma do rastreador" (Softruck/Rede)
-- de forma análoga a sga_status / sga_erro / sga_sincronizado_em.
ALTER TABLE public.solicitacoes_troca_titularidade
  ADD COLUMN IF NOT EXISTS plataforma_rastreador_status text,
  ADD COLUMN IF NOT EXISTS plataforma_rastreador_erro text,
  ADD COLUMN IF NOT EXISTS plataforma_rastreador_sincronizado_em timestamptz;

COMMENT ON COLUMN public.solicitacoes_troca_titularidade.plataforma_rastreador_status IS
  'Estado da ponta Softruck/Rede para a regra das 3 pontas. Valores: nao_aplicavel | pendente | sincronizado | falha | falha_permanente. nao_aplicavel só é setado quando NENHUMA operação Softruck/Rede foi tentada no fluxo desta troca.';

-- Backfill: trocas que já estão "efetivada" são tratadas como sincronizado para evitar regressão.
UPDATE public.solicitacoes_troca_titularidade
   SET plataforma_rastreador_status = 'sincronizado',
       plataforma_rastreador_sincronizado_em = COALESCE(plataforma_rastreador_sincronizado_em, efetivada_em, updated_at)
 WHERE status = 'efetivada'
   AND plataforma_rastreador_status IS NULL;