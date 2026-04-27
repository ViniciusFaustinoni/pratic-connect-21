-- 1) Coluna para o analista do cadastro registrar avarias observadas
ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS avarias_observadas_cadastro text,
  ADD COLUMN IF NOT EXISTS avarias_observadas_em timestamptz,
  ADD COLUMN IF NOT EXISTS avarias_observadas_por uuid;

-- 2) Cleanup: cancelar serviços duplicados ativos (mesma cotação, sucessor mais recente).
WITH ranked AS (
  SELECT
    s.id,
    s.cotacao_id,
    ROW_NUMBER() OVER (
      PARTITION BY s.cotacao_id
      ORDER BY s.created_at DESC
    ) AS rn
  FROM public.servicos s
  WHERE s.cotacao_id IS NOT NULL
    AND s.status NOT IN ('cancelada','reagendada','reprovada','concluida','aprovada','aprovada_ressalvas','nao_compareceu')
)
UPDATE public.servicos s
SET status = 'cancelada',
    observacoes = COALESCE(s.observacoes,'') || E'\n[AUTO-CLEANUP 27/04/2026] Cancelado por duplicação — serviço sucessor mais recente para a mesma cotação.',
    updated_at = now()
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

-- 3) Cleanup agendamentos_base órfãos: fechar agendamentos cuja cotação
--    já não tenha nenhum serviço ativo (todos cancelados/reagendados/reprovados).
UPDATE public.agendamentos_base ab
SET status = 'cancelado',
    updated_at = now()
WHERE ab.status NOT IN ('cancelado','concluido','realizado')
  AND ab.cotacao_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.servicos s
    WHERE s.cotacao_id = ab.cotacao_id
      AND s.status NOT IN ('cancelada','reagendada','reprovada','concluida','aprovada','aprovada_ressalvas','nao_compareceu')
  );

-- 4) Marcar os 5 relatos de erro como concluído
UPDATE public.error_reports
SET status = 'concluido',
    observacao_diretor = COALESCE(observacao_diretor || E'\n','') || '[27/04/2026] ' || v._obs,
    concluido_em = now(),
    concluido_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'::uuid,
    updated_at = now()
FROM (VALUES
  ('7b671078-2cde-48bd-9b10-94bfed38fa5d'::uuid,
    'Aprovação de proposta agora invalida cache (propostas, associados, fila-documentos, cadastro-pendentes) imediatamente após o sucesso. O badge "Pendente" desaparecerá no próximo refresh sem necessidade de F5. Favor validar.'),
  ('88c6d372-244f-4137-baf9-0cabf591248f'::uuid,
    'Adicionado campo "Avarias observadas pelo analista" no painel de aprovação da proposta (etapa Fotos & Vistoria). O texto fica destacado em amarelo na ficha do associado. Favor validar.'),
  ('2189c17b-df8f-4373-a064-813dcab91d76'::uuid,
    'Backfill: serviços duplicados antigos cancelados automaticamente. Edge function reagendar-vistoria-publica reforçada para fechar serviços/agendamentos antigos antes de criar novos. Favor validar.'),
  ('51a83208-9355-4e51-890e-63944b24cb5a'::uuid,
    'Bug de timezone corrigido em 9 componentes (EncaixeCard, ManutencaoTabela, TratarAusenciaModal, TratarAusenciaRetiradaModal, ManutencaoRastreadoresTab, DetalhesRastreadorDialog, AddInstalacaoDialog, TimelineEventoTab, AcompanhamentoProposta) usando parseDataLocal. Datas DATE puras já não voltam 1 dia em fusos negativos. Favor validar.'),
  ('ee37f6dc-fefb-45f9-8f19-7306805eac3d'::uuid,
    'Backfill: agendamentos_base órfãos vinculados a serviços cancelados/reagendados foram fechados. Edge function reagendar-vistoria-publica agora fecha agendamentos antigos da mesma cotação antes de criar o novo, evitando que o técnico veja item fantasma com data antiga. Favor validar reagendando um serviço.')
) AS v(_id, _obs)
WHERE error_reports.id = v._id;