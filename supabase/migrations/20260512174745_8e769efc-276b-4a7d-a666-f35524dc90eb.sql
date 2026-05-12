
UPDATE public.servicos s
   SET associado_id = sol.novo_associado_id,
       contrato_id  = COALESCE(s.contrato_id, c.id),
       updated_at   = now()
  FROM public.solicitacoes_troca_titularidade sol
  LEFT JOIN public.contratos c
    ON c.cotacao_id = sol.cotacao_id
   AND c.associado_id = sol.novo_associado_id
   AND c.status IN ('assinado', 'pendente', 'pendente_assinatura', 'ativo')
 WHERE sol.novo_associado_id IS NOT NULL
   AND sol.efetivada_em IS NULL
   AND (s.cotacao_id = sol.cotacao_id
        OR s.vistoria_origem_id IN (
             SELECT v.id FROM public.vistorias v
              WHERE v.veiculo_id = sol.veiculo_id
           ))
   AND s.associado_id IS DISTINCT FROM sol.novo_associado_id;
