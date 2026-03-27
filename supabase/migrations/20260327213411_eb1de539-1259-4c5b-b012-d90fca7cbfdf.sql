
INSERT INTO public.planos_regioes (plano_id, regiao_id)
SELECT p.id, r.id
FROM planos p
CROSS JOIN regioes r
WHERE p.ativo = true AND r.ativa = true;
