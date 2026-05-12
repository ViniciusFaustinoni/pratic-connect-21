-- Guard simétrico ao "Base não duplica instalação":
-- se já existe instalação ativa para a cotação, NÃO cria vistoria paralela.
CREATE OR REPLACE FUNCTION public.sync_agendamento_base_to_vistoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_associado_id uuid;
  v_veiculo_id uuid;
  v_contrato_id uuid;
  v_vistoria_id uuid;
  v_data_ts timestamptz;
  v_inst_count int;
BEGIN
  IF NEW.atendido_por IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se já há vistoria vinculada, apenas sincroniza vistoriador.
  IF NEW.vistoria_id IS NOT NULL THEN
    UPDATE public.vistorias
       SET vistoriador_id = NEW.atendido_por,
           updated_at = now()
     WHERE id = NEW.vistoria_id
       AND (vistoriador_id IS DISTINCT FROM NEW.atendido_por);
    RETURN NEW;
  END IF;

  -- GUARD ANTI-DUPLICAÇÃO: se já existe instalação ativa para a cotação,
  -- NÃO cria vistoria paralela (mesma lógica de criar-instalacao-pos-pagamento,
  -- porém na direção inversa). Apenas vincula a instalação ao agendamento via
  -- instalacao_id (se ainda não estiver setado).
  IF NEW.cotacao_id IS NOT NULL THEN
    SELECT count(*) INTO v_inst_count
      FROM public.instalacoes
     WHERE cotacao_id = NEW.cotacao_id
       AND status IN ('agendada','em_andamento','em_analise','em_rota','concluida');

    IF v_inst_count > 0 THEN
      IF NEW.instalacao_id IS NULL THEN
        UPDATE public.agendamentos_base ab
           SET instalacao_id = (
             SELECT id FROM public.instalacoes
              WHERE cotacao_id = NEW.cotacao_id
                AND status IN ('agendada','em_andamento','em_analise','em_rota','concluida')
              ORDER BY created_at DESC LIMIT 1
           )
         WHERE ab.id = NEW.id;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.cotacao_id IS NOT NULL THEN
    SELECT ct.associado_id, ct.veiculo_id, ct.id
      INTO v_associado_id, v_veiculo_id, v_contrato_id
      FROM public.cotacoes c
      LEFT JOIN public.contratos ct ON ct.id = c.contrato_gerado_id
     WHERE c.id = NEW.cotacao_id
     LIMIT 1;

    IF v_veiculo_id IS NULL AND NEW.veiculo_placa IS NOT NULL THEN
      SELECT v.id, v.associado_id
        INTO v_veiculo_id, v_associado_id
        FROM public.veiculos v
       WHERE v.placa = NEW.veiculo_placa
       ORDER BY v.created_at DESC
       LIMIT 1;
    END IF;
  END IF;

  IF v_associado_id IS NULL OR v_veiculo_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_data_ts := (NEW.data_agendada::text || ' ' || COALESCE(NEW.horario::text, '09:00:00'))::timestamptz;

  INSERT INTO public.vistorias (
    associado_id, veiculo_id, contrato_id, cotacao_id, vistoriador_id,
    tipo, status, data_agendada, horario_agendado,
    local_vistoria, modalidade, origem
  ) VALUES (
    v_associado_id, v_veiculo_id, v_contrato_id, NEW.cotacao_id, NEW.atendido_por,
    'entrada'::tipo_vistoria, 'agendada'::status_vistoria, v_data_ts, NEW.horario,
    'base', 'presencial', 'agendamento_base'
  )
  RETURNING id INTO v_vistoria_id;

  UPDATE public.agendamentos_base
     SET vistoria_id = v_vistoria_id
   WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- LIMPEZA do caso atual (RJM3D69 / cotação 22d0fcd4): a vistoria duplicada
-- (origem='agendamento_base', criada APÓS a instalação) deve ser removida e o
-- agendamento_base deve apontar para a instalação real.
DO $$
DECLARE
  v_cotacao_id uuid := '22d0fcd4-4a1c-4434-9a38-b714164ce0b4';
  v_vistoria_id uuid := '01286281-78b2-480b-a605-8ea33e403905';
  v_instalacao_id uuid := '094ac4d7-98d1-47b1-a2eb-3cde595df52c';
BEGIN
  -- Servico que tinha vistoria_origem_id apontando para a vistoria duplicada
  UPDATE public.servicos
     SET vistoria_origem_id = NULL
   WHERE vistoria_origem_id = v_vistoria_id;

  -- Agendamento_base: solta vistoria_id e fixa instalacao_id
  UPDATE public.agendamentos_base
     SET vistoria_id = NULL,
         instalacao_id = v_instalacao_id
   WHERE cotacao_id = v_cotacao_id;

  -- Remove a vistoria duplicada e suas dependências
  DELETE FROM public.vistoria_fotos WHERE vistoria_id = v_vistoria_id;
  DELETE FROM public.vistorias WHERE id = v_vistoria_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Limpeza RJM3D69 ignorada: %', SQLERRM;
END $$;