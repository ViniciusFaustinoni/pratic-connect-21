-- Parte 1: sanear caso Alexandre Gutti (KRN9E64) — fecha o servico de autovistoria como aprovada terminal
UPDATE public.servicos
   SET status = 'aprovada',
       modalidade = 'autovistoria',
       analisado_em = now(),
       observacoes = COALESCE(observacoes,'') ||
         E'\n[2026-05-19 SANEAMENTO] Cliente também agendou Vistoria Base 19/05 13:00 (agendamento 5f96e7ca-2201-4c1a-939e-3ba259dda6b5) — autovistoria fica como aprovada terminal, fora da fila.'
 WHERE id = '31009ff6-8627-4aae-a237-db5ac07ac336';

UPDATE public.vistorias
   SET modalidade = 'autovistoria'
 WHERE id = 'a3353a69-557b-4294-a598-110387d8eab0'
   AND modalidade IS DISTINCT FROM 'autovistoria';

INSERT INTO public.contratos_historico (contrato_id, evento, descricao, dados)
VALUES (
  'ee5f5aa3-e8d3-4a99-b00d-a703ea3ffab4',
  'saneamento_dedup',
  'Servico vistoria_entrada da autovistoria (31009ff6) marcado como aprovada terminal — cliente também agendou Vistoria Base 19/05 13:00 (5f96e7ca). Dedup manual.',
  jsonb_build_object(
    'servico_id', '31009ff6-8627-4aae-a237-db5ac07ac336',
    'vistoria_id', 'a3353a69-557b-4294-a598-110387d8eab0',
    'agendamento_base_id', '5f96e7ca-2201-4c1a-939e-3ba259dda6b5'
  )
);

-- Parte 2: trigger sistêmico — ao criar agendamento_base para cotação que já tem servico de autovistoria pendente, fecha o servico como aprovada terminal
CREATE OR REPLACE FUNCTION public.fn_dedup_autovistoria_ao_agendar_base()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cotacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fecha como 'aprovada' (terminal) os servicos vistoria_entrada cujo origem é
  -- uma vistoria de modalidade='autovistoria' da MESMA cotacao. A autovistoria
  -- vira insumo (continua disponível para R/F via aprovar-proposta) e sai da fila
  -- Aprovação de Associados / Atribuição. O agendamento_base recém-criado é a
  -- tarefa canônica de Vistoria Base.
  UPDATE public.servicos s
     SET status = 'aprovada'::status_servico,
         modalidade = 'autovistoria',
         analisado_em = COALESCE(s.analisado_em, now()),
         observacoes = COALESCE(s.observacoes,'') ||
           E'\n[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
           '] Fechada automaticamente: cliente agendou Vistoria Base (agendamento ' || NEW.id::text || ').',
         updated_at = now()
    FROM public.vistorias v
   WHERE s.vistoria_origem_id = v.id
     AND v.cotacao_id = NEW.cotacao_id
     AND v.modalidade = 'autovistoria'
     AND s.tipo IN ('vistoria_entrada'::tipo_servico, 'instalacao'::tipo_servico)
     AND s.status NOT IN ('aprovada'::status_servico, 'reprovada'::status_servico,
                          'aprovada_ressalvas'::status_servico, 'concluida'::status_servico,
                          'cancelada'::status_servico);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_dedup_autovistoria_ao_agendar_base ON public.agendamentos_base;
CREATE TRIGGER trg_dedup_autovistoria_ao_agendar_base
AFTER INSERT ON public.agendamentos_base
FOR EACH ROW
EXECUTE FUNCTION public.fn_dedup_autovistoria_ao_agendar_base();