-- Backfill: encerrar agendamentos_base cuja vistoria já está em status terminal
UPDATE public.agendamentos_base ab
   SET status = 'realizado', updated_at = now()
  FROM public.vistorias v
 WHERE ab.vistoria_id = v.id
   AND v.status IN ('aprovada','reprovada')
   AND ab.status IN ('agendado','confirmado','em_andamento');

-- Backfill: encerrar serviços cuja vistoria de origem já está em status terminal
UPDATE public.servicos s
   SET status = CASE WHEN v.status = 'aprovada' THEN 'aprovada'::status_servico
                     ELSE 'reprovada'::status_servico END,
       concluida_em = COALESCE(s.concluida_em, now()),
       updated_at = now()
  FROM public.vistorias v
 WHERE s.vistoria_origem_id = v.id
   AND v.status IN ('aprovada','reprovada')
   AND s.status IN ('em_andamento','em_analise','em_rota','agendada');