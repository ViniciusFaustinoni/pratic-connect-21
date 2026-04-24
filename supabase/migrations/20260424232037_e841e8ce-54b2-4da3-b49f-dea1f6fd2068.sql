-- 1) Recria a função do trigger com guard de aprovação cadastral
CREATE OR REPLACE FUNCTION public.criar_instalacao_de_cotacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_veiculo_id UUID;
  v_associado_id UUID;
  v_contrato_id UUID;
  v_aprovado_em TIMESTAMPTZ;
  v_periodo periodo_instalacao;
BEGIN
  IF NEW.tipo_vistoria = 'agendada'
     AND NEW.status_contratacao = 'pagamento_ok'
     AND NEW.vistoria_data_agendada IS NOT NULL
  THEN
    -- Guard: o Cadastro precisa ter aprovado o contrato antes de
    -- criar a instalação (que dispara cascata para servicos e
    -- consequentemente passa o associado para a fila de Monitoramento).
    SELECT c.id, c.associado_id, c.aprovado_em
      INTO v_contrato_id, v_associado_id, v_aprovado_em
      FROM contratos c
     WHERE c.cotacao_id = NEW.id
     LIMIT 1;

    IF v_aprovado_em IS NULL THEN
      RAISE NOTICE '[criar_instalacao_de_cotacao] cotacao % aguardando aprovação do Cadastro — instalação NÃO criada.', NEW.id;
      RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM instalacoes WHERE cotacao_id = NEW.id) THEN

      SELECT v.id INTO v_veiculo_id
        FROM veiculos v
       WHERE v.placa = NEW.veiculo_placa
       LIMIT 1;

      IF v_associado_id IS NULL THEN
        SELECT a.id INTO v_associado_id
          FROM associados a
          JOIN veiculos v ON v.associado_id = a.id
         WHERE v.placa = NEW.veiculo_placa
         LIMIT 1;
      END IF;

      v_periodo := CASE
        WHEN NEW.vistoria_horario_agendado::time < '12:00'::time THEN 'manha'::periodo_instalacao
        WHEN NEW.vistoria_horario_agendado::time < '18:00'::time THEN 'tarde'::periodo_instalacao
        ELSE 'noite'::periodo_instalacao
      END;

      INSERT INTO instalacoes (
        cotacao_id, contrato_id, associado_id, veiculo_id,
        data_agendada, hora_agendada, periodo, status,
        logradouro, numero, bairro, cidade, uf, cep,
        endereco_latitude, endereco_longitude,
        permite_encaixe, local_vistoria, instalador_responsavel_id, observacoes
      ) VALUES (
        NEW.id, v_contrato_id, v_associado_id, v_veiculo_id,
        NEW.vistoria_data_agendada, NEW.vistoria_horario_agendado::time, v_periodo, 'agendada'::status_instalacao,
        NEW.vistoria_endereco_logradouro, NEW.vistoria_endereco_numero, NEW.vistoria_endereco_bairro,
        NEW.vistoria_endereco_cidade, NEW.vistoria_endereco_estado, NEW.vistoria_endereco_cep,
        NEW.vistoria_endereco_latitude, NEW.vistoria_endereco_longitude,
        COALESCE(NEW.vistoria_permite_encaixe, false), 'cliente', NULL,
        'Instalação criada automaticamente após aprovação do Cadastro'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Reconciliar instalações órfãs criadas antes deste guard
--    Apenas instalações ainda não tocadas pelo Monitoramento.
UPDATE public.instalacoes i
SET status = 'cancelada'::status_instalacao,
    observacoes = COALESCE(observacoes, '') ||
                  ' | Cancelada automaticamente: criada antes da aprovação do Cadastro'
WHERE i.status = 'agendada'::status_instalacao
  AND i.instalador_responsavel_id IS NULL
  AND i.rota_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.contratos c
     WHERE c.id = i.contrato_id
       AND c.aprovado_em IS NULL
  );