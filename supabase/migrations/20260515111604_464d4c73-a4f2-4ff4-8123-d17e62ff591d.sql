UPDATE public.agendamentos_base
SET status = 'cancelado',
    observacoes = COALESCE(observacoes, '') || ' [auto] Cancelado: agendamento órfão de cotação abandonada; cliente concluiu vistoria em outra cotação.',
    updated_at = now()
WHERE id IN (
  'a4e7e00b-abfd-4f7c-b790-7ae269f54546',
  '3a4a81b7-d35b-4940-a32f-495826c35ef9'
);