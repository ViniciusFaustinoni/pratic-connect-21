-- 1) Backfill: cancelar instalações fantasma (local_vistoria='base') que possuem
-- agendamento_base ativo paralelo, e remover seus serviços órfãos da fila.
WITH duplicadas AS (
  SELECT i.id
    FROM public.instalacoes i
   WHERE i.local_vistoria = 'base'
     AND i.status IN ('agendada','em_analise')
     AND EXISTS (
       SELECT 1 FROM public.agendamentos_base ab
        WHERE ab.cotacao_id = i.cotacao_id
          AND ab.status IN ('agendado','confirmado','pendente')
          AND ab.atendido_por IS NULL
     )
)
UPDATE public.instalacoes i
   SET status = 'cancelada',
       observacoes = COALESCE(i.observacoes,'') || ' [Auto-cancelada: duplicata de Vistoria Base]',
       updated_at = now()
  FROM duplicadas d
 WHERE i.id = d.id;

DELETE FROM public.servicos s
 WHERE s.tipo = 'instalacao'
   AND s.profissional_id IS NULL
   AND s.status IN ('pendente','agendada')
   AND EXISTS (
     SELECT 1 FROM public.instalacoes i
      WHERE i.id = s.instalacao_origem_id
        AND i.status = 'cancelada'
        AND i.observacoes LIKE '%Auto-cancelada: duplicata de Vistoria Base%'
   );

-- 2) Hardening do trigger: nunca criar servico tipo='instalacao' quando a instalacoes
-- é local_vistoria='base' E há agendamento_base ativo na mesma cotação. Defesa em
-- profundidade contra regressões futuras.
CREATE OR REPLACE FUNCTION public.sync_instalacao_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Guard anti-duplicação: fluxo Base já tem agendamento_base como tarefa única.
  IF COALESCE(NEW.local_vistoria, 'cliente') = 'base'
     AND NEW.cotacao_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.agendamentos_base ab
        WHERE ab.cotacao_id = NEW.cotacao_id
          AND ab.status IN ('agendado','confirmado','pendente')
     ) THEN
    RETURN NEW;
  END IF;

  -- Só cria se não existir já um servico para esta instalacao
  IF NOT EXISTS (SELECT 1 FROM servicos WHERE instalacao_origem_id = NEW.id) THEN
    INSERT INTO servicos (
      tipo, status, data_agendada, hora_agendada, periodo,
      associado_id, veiculo_id, latitude, longitude,
      logradouro, numero, bairro, cidade, uf, cep,
      permite_encaixe, local_vistoria, cotacao_id, contrato_id,
      instalacao_origem_id, origem, created_at, updated_at
    ) VALUES (
      'instalacao',
      (NEW.status::text)::status_servico,
      NEW.data_agendada, NEW.hora_agendada,
      (NEW.periodo::text)::periodo_servico,
      NEW.associado_id, NEW.veiculo_id,
      NEW.endereco_latitude, NEW.endereco_longitude,
      NEW.logradouro, NEW.numero, NEW.bairro, NEW.cidade, NEW.uf, NEW.cep,
      COALESCE(NEW.permite_encaixe, false),
      COALESCE(NEW.local_vistoria, 'cliente'),
      NEW.cotacao_id, NEW.contrato_id, NEW.id, 'instalacao',
      NOW(), NOW()
    );
  END IF;
  RETURN NEW;
END;
$function$;