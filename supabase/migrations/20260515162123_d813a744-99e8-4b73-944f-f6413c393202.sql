UPDATE public.agendamentos_base
   SET status = 'agendado', atendido_por = NULL, updated_at = now()
 WHERE id = '2f692c79-27b5-4585-9724-9bd4b55cef92' AND status = 'realizado';

UPDATE public.vistorias
   SET status = 'aprovada', analisado_em = now()
 WHERE id = '4573c24b-f1e4-4f84-aed1-994c023a5616' AND status = 'pendente';

UPDATE public.veiculos
   SET cobertura_roubo_furto = true, updated_at = now()
 WHERE id = 'c723a6ac-b0ff-4f58-8edf-a852d0de042c';

INSERT INTO public.associados_historico (associado_id, contrato_id, tipo, descricao)
VALUES (
  'cb1b162e-5c3a-4282-81bd-d0349dc7ab85',
  '842c835d-674d-462e-bd5f-982fd4dd6c94',
  'status_alterado',
  'Correção retroativa: Cobertura Roubo/Furto liberada via autovistoria antecipada (placa LTB4J74). Agendamento base reaberto para a fila de Atribuição.'
);