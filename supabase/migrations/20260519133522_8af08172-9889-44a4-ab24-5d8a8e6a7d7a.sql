-- =============================================================================
-- Correção raiz: duplicação de tarefas no monitoramento
-- Camadas: 1) saneamento  2) travas de unicidade  3) trigger idempotente
--          4) dedupe de log de atribuição
-- =============================================================================

-- 1) SANEAMENTO: para cada origem com >1 servico, manter UM canônico e
--    cancelar os demais (preserva histórico, libera espaço para o índice único).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT vistoria_origem_id
    FROM public.servicos
    WHERE vistoria_origem_id IS NOT NULL
    GROUP BY vistoria_origem_id
    HAVING count(*) > 1
  LOOP
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               ORDER BY
                 CASE status::text
                   WHEN 'em_andamento' THEN 1
                   WHEN 'em_rota' THEN 2
                   WHEN 'em_analise' THEN 3
                   WHEN 'agendada' THEN 4
                   WHEN 'pendente' THEN 5
                   WHEN 'imprevisto_pendente' THEN 6
                   WHEN 'aprovada' THEN 10
                   WHEN 'aprovada_ressalvas' THEN 11
                   WHEN 'concluida' THEN 12
                   WHEN 'nao_compareceu' THEN 20
                   WHEN 'reagendada' THEN 21
                   WHEN 'reprovada' THEN 22
                   WHEN 'cancelada' THEN 30
                   ELSE 99
                 END,
                 created_at DESC
             ) AS rn
      FROM public.servicos
      WHERE vistoria_origem_id = r.vistoria_origem_id
    )
    UPDATE public.servicos s
    SET status = 'cancelada',
        observacoes = COALESCE(s.observacoes,'') || E'\n[SANEAMENTO 2026-05-19] Cancelado por duplicidade — canônico mantido por vistoria_origem_id.',
        updated_at = now()
    FROM ranked
    WHERE s.id = ranked.id AND ranked.rn > 1 AND s.status::text NOT IN ('cancelada');
  END LOOP;

  FOR r IN
    SELECT instalacao_origem_id
    FROM public.servicos
    WHERE instalacao_origem_id IS NOT NULL
    GROUP BY instalacao_origem_id
    HAVING count(*) > 1
  LOOP
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               ORDER BY
                 CASE status::text
                   WHEN 'em_andamento' THEN 1
                   WHEN 'em_rota' THEN 2
                   WHEN 'em_analise' THEN 3
                   WHEN 'agendada' THEN 4
                   WHEN 'pendente' THEN 5
                   WHEN 'imprevisto_pendente' THEN 6
                   WHEN 'aprovada' THEN 10
                   WHEN 'aprovada_ressalvas' THEN 11
                   WHEN 'concluida' THEN 12
                   WHEN 'nao_compareceu' THEN 20
                   WHEN 'reagendada' THEN 21
                   WHEN 'reprovada' THEN 22
                   WHEN 'cancelada' THEN 30
                   ELSE 99
                 END,
                 created_at DESC
             ) AS rn
      FROM public.servicos
      WHERE instalacao_origem_id = r.instalacao_origem_id
    )
    UPDATE public.servicos s
    SET status = 'cancelada',
        observacoes = COALESCE(s.observacoes,'') || E'\n[SANEAMENTO 2026-05-19] Cancelado por duplicidade — canônico mantido por instalacao_origem_id.',
        updated_at = now()
    FROM ranked
    WHERE s.id = ranked.id AND ranked.rn > 1 AND s.status::text NOT IN ('cancelada');
  END LOOP;
END $$;

-- 2) TRAVAS DE UNICIDADE: um único servico VIVO por origem física
--    (cancelada/reprovada são "mortos" e podem coexistir como histórico).
CREATE UNIQUE INDEX IF NOT EXISTS uq_servicos_instalacao_origem_vivo
  ON public.servicos (instalacao_origem_id)
  WHERE instalacao_origem_id IS NOT NULL
    AND status NOT IN ('cancelada','reprovada');

CREATE UNIQUE INDEX IF NOT EXISTS uq_servicos_vistoria_origem_vivo
  ON public.servicos (vistoria_origem_id)
  WHERE vistoria_origem_id IS NOT NULL
    AND status NOT IN ('cancelada','reprovada');

-- 3) agendamentos_base: um único agendamento ATIVO por origem
CREATE UNIQUE INDEX IF NOT EXISTS uq_agendamentos_base_instalacao_ativo
  ON public.agendamentos_base (instalacao_id)
  WHERE instalacao_id IS NOT NULL
    AND status IN ('agendado','confirmado','em_atendimento','pendente');

CREATE UNIQUE INDEX IF NOT EXISTS uq_agendamentos_base_vistoria_ativo
  ON public.agendamentos_base (vistoria_id)
  WHERE vistoria_id IS NOT NULL
    AND status IN ('agendado','confirmado','em_atendimento','pendente');

-- 4) sync_instalacao_to_servicos: reusar servico canônico (vistoria_entrada vivo)
--    quando existir para o mesmo contrato/veículo, em vez de criar irmão.
CREATE OR REPLACE FUNCTION public.sync_instalacao_to_servicos()
RETURNS TRIGGER AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- Já existe servico para esta instalacao?
  SELECT id INTO v_existing_id
  FROM public.servicos
  WHERE instalacao_origem_id = NEW.id
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN RETURN NEW; END IF;

  -- Existe servico canônico vivo (vistoria_entrada/instalacao) para o MESMO
  -- contrato+veículo ainda sem instalacao_origem_id? Reaproveita.
  IF NEW.contrato_id IS NOT NULL AND NEW.veiculo_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.servicos
    WHERE instalacao_origem_id IS NULL
      AND contrato_id = NEW.contrato_id
      AND veiculo_id = NEW.veiculo_id
      AND tipo IN ('instalacao','vistoria_entrada')
      AND status NOT IN ('cancelada','reprovada','concluida','aprovada','aprovada_ressalvas')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.servicos
      SET instalacao_origem_id = NEW.id,
          data_agendada = COALESCE(NEW.data_agendada, data_agendada),
          hora_agendada = COALESCE(NEW.hora_agendada, hora_agendada),
          periodo       = COALESCE((NEW.periodo::text)::periodo_servico, periodo),
          updated_at = now()
      WHERE id = v_existing_id;
      RETURN NEW;
    END IF;
  END IF;

  -- Caminho normal: cria novo servico
  INSERT INTO public.servicos (
    tipo, status, data_agendada, hora_agendada, periodo,
    associado_id, veiculo_id, latitude, longitude,
    logradouro, numero, bairro, cidade, uf, cep,
    permite_encaixe, local_vistoria, cotacao_id, contrato_id,
    instalacao_origem_id, origem, created_at, updated_at
  ) VALUES (
    'instalacao', (NEW.status::text)::status_servico, NEW.data_agendada, NEW.hora_agendada,
    (NEW.periodo::text)::periodo_servico, NEW.associado_id, NEW.veiculo_id,
    NEW.endereco_latitude, NEW.endereco_longitude,
    NEW.logradouro, NEW.numero, NEW.bairro, NEW.cidade, NEW.uf, NEW.cep,
    COALESCE(NEW.permite_encaixe, false), COALESCE(NEW.local_vistoria, 'cliente'),
    NEW.cotacao_id, NEW.contrato_id, NEW.id, 'instalacao', NOW(), NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5) Dedupe de logs de atribuição: ignora silenciosamente repetições da
--    mesma chave (servico/agendamento + profissional + tipo) dentro de 5 min.
CREATE OR REPLACE FUNCTION public.dedup_servicos_atribuicoes_log()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.servicos_atribuicoes_log
    WHERE COALESCE(servico_id::text,'') = COALESCE(NEW.servico_id::text,'')
      AND COALESCE(agendamento_base_id::text,'') = COALESCE(NEW.agendamento_base_id::text,'')
      AND COALESCE(profissional_id::text,'') = COALESCE(NEW.profissional_id::text,'')
      AND tipo_atribuicao = NEW.tipo_atribuicao
      AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_dedup_atribuicao_log ON public.servicos_atribuicoes_log;
CREATE TRIGGER trg_dedup_atribuicao_log
BEFORE INSERT ON public.servicos_atribuicoes_log
FOR EACH ROW EXECUTE FUNCTION public.dedup_servicos_atribuicoes_log();

COMMENT ON INDEX public.uq_servicos_instalacao_origem_vivo IS
  'Garante 1 servico vivo por instalacao_origem_id (ver mem://logic/operations/vistoria-entrada-equivale-instalacao).';
COMMENT ON INDEX public.uq_servicos_vistoria_origem_vivo IS
  'Garante 1 servico vivo por vistoria_origem_id (ver mem://logic/operations/vistoria-entrada-equivale-instalacao).';