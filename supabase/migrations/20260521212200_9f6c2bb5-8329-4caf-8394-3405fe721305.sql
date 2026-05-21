
CREATE OR REPLACE FUNCTION public.trg_inclusao_isenta_auto_instalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cotacao record;
  v_veiculo_id uuid;
  v_precisa_rastreador boolean;
BEGIN
  IF NEW.data_assinatura IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.data_assinatura IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.cotacao_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, tipo_entrada, vistoria_data_agendada, valor_adesao
    INTO v_cotacao
  FROM public.cotacoes WHERE id = NEW.cotacao_id;

  IF v_cotacao IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(v_cotacao.tipo_entrada, '') NOT IN ('inclusao','adesao','nova') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.valor_adesao, v_cotacao.valor_adesao, 0) > 0 THEN RETURN NEW; END IF;
  IF v_cotacao.vistoria_data_agendada IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.instalacoes WHERE cotacao_id = v_cotacao.id) THEN
    RETURN NEW;
  END IF;

  SELECT veiculo_id INTO v_veiculo_id FROM public.contratos WHERE id = NEW.id;
  IF v_veiculo_id IS NOT NULL THEN
    BEGIN
      v_precisa_rastreador := public.fn_veiculo_precisa_rastreador(v_veiculo_id);
    EXCEPTION WHEN OTHERS THEN
      v_precisa_rastreador := TRUE;
    END;
    IF v_precisa_rastreador = FALSE THEN
      RAISE NOTICE 'trg_inclusao_isenta_auto_instalacao: contrato % é sub-FIPE (veículo %), pulando criação automática de instalação', NEW.id, v_veiculo_id;
      RETURN NEW;
    END IF;
  END IF;

  PERFORM net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/criar-instalacao-pos-pagamento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI'
    ),
    body := jsonb_build_object(
      'cotacaoId', v_cotacao.id,
      'skipPaymentCheck', true,
      'source', 'trg_inclusao_isenta_auto_instalacao'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_inclusao_isenta_auto_instalacao falhou para contrato %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

UPDATE public.associados
SET status = 'pendente_vistoria',
    updated_at = now()
WHERE id = '8a85497d-fa03-4b82-abeb-45c451c16fa8'
  AND status = 'aguardando_instalacao';

INSERT INTO public.associados_historico (
  associado_id, tipo, acao, descricao, motivo, metadata, created_at
) VALUES (
  '8a85497d-fa03-4b82-abeb-45c451c16fa8',
  'status_alterado',
  'reverter_status',
  'Saneamento: status revertido de aguardando_instalacao para pendente_vistoria após notificação cobertura_360_ativada_v3 enviada por engano. Cliente segue aguardando autovistoria (sub-FIPE, sem rastreador).',
  'Bug do gatilho trg_inclusao_isenta_auto_instalacao em fluxo sub-FIPE — fix com defesa em duas camadas aplicado nesta migração + edges.',
  jsonb_build_object(
    'cotacao_id', 'fb58b2e7-b656-4d82-952d-24b6bf476055',
    'placa', 'KZZ9E93',
    'status_anterior', 'aguardando_instalacao',
    'status_novo', 'pendente_vistoria',
    'mensagem_indevida_template', 'cobertura_360_ativada_v3',
    'mensagem_enviada_em', '2026-05-21T18:39:52-03:00',
    'gatilho_origem', 'trg_inclusao_isenta_auto_instalacao -> criar-instalacao-pos-pagamento -> ativar-associado',
    'comunicacao_corretiva', 'telefonema_consultor_bruno_21997275482',
    'fix_aplicado', 'trigger DB ignora sub-FIPE + edges suprimem ativar_cobertura_total/notificacao quando aguardar_instalacao=true',
    'tag', 'saneamento'
  ),
  now()
);
