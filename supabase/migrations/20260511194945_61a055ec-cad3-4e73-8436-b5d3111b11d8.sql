
WITH limbo AS (
  SELECT c.id AS contrato_id
  FROM public.contratos c
  JOIN public.cotacoes co ON co.id = c.cotacao_id
  WHERE c.status = 'assinado'
    AND c.cadastro_aprovado = true
    AND co.tipo_vistoria = 'agendada'
    AND co.vistoria_data_agendada IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.instalacoes i WHERE i.cotacao_id = c.cotacao_id
        AND i.status IN ('agendada','em_andamento','em_analise','em_rota','concluida'))
    AND NOT EXISTS (
      SELECT 1 FROM public.vistorias v WHERE v.cotacao_id = c.cotacao_id
        AND v.status IN ('agendada','pendente','aprovada','em_analise','em_rota','em_andamento'))
    AND NOT EXISTS (
      SELECT 1 FROM public.agendamentos_base ab WHERE ab.cotacao_id = c.cotacao_id
        AND ab.status IN ('agendado','confirmado','realizado'))
), upd AS (
  UPDATE public.contratos c
  SET cadastro_aprovado = false,
      aprovado_por = NULL,
      aprovado_em = NULL,
      updated_at = now()
  FROM limbo
  WHERE c.id = limbo.contrato_id
  RETURNING c.id
)
INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao)
SELECT 'editar', 'contratos', 'contratos', upd.id,
       'Recuperação limbo agendamento: cadastro_aprovado revertido (cotação sem instalação/vistoria/agendamento real — fluxo externo). Contrato volta a Propostas Pendentes para concluir vistoria.'
FROM upd;
