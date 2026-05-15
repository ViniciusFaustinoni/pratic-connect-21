-- Reconciliação one-shot: associado 988dbfa9 / troca 06037fb8
-- 1. Cancela contrato duplicado criado por aprovar-proposta (mantém TRC-20260515-7954)
UPDATE public.contratos
SET status = 'cancelado',
    data_cancelamento = now(),
    updated_at = now()
WHERE id = '06313261-c4c4-4a47-9a36-cf7875ff439e'
  AND status = 'ativo';

-- 2. Garante cadastro_aprovado=true no contrato vencedor da troca
UPDATE public.contratos
SET cadastro_aprovado = true,
    aprovado_em = COALESCE(aprovado_em, now()),
    aprovado_por = COALESCE(aprovado_por, '37beadcf-284b-4a2c-88a0-6efa8cae60d9'),
    updated_at = now()
WHERE id = 'a8e6e9b7-8010-4649-b9f6-7ad11be677f7';

-- 3. Limpa cobertura suspensa do veículo KOU6D37 (motivo era troca_titularidade_em_andamento)
UPDATE public.veiculos
SET cobertura_suspensa = false,
    cobertura_suspensa_motivo = NULL,
    cobertura_suspensa_em = NULL,
    em_troca_titularidade = false,
    troca_titularidade_id = NULL,
    troca_titularidade_iniciada_em = NULL,
    updated_at = now()
WHERE id = '2315cece-68e2-4ac2-96ce-6bf513b6d13f';

-- 4. Herda endereço do contrato anterior do MARCOS (titular antigo) para o novo associado VInicius,
--    apenas onde estiver NULL. Resolve "ESTADO inválido" no SGA.
UPDATE public.associados a
SET uf = COALESCE(a.uf, c.cliente_uf),
    cep = COALESCE(a.cep, regexp_replace(COALESCE(c.cliente_cep,''), '\D', '', 'g')),
    cidade = COALESCE(a.cidade, c.cliente_cidade),
    bairro = COALESCE(a.bairro, c.cliente_bairro),
    logradouro = COALESCE(a.logradouro, c.cliente_logradouro),
    numero = COALESCE(a.numero, c.cliente_numero),
    complemento = COALESCE(a.complemento, c.cliente_complemento),
    updated_at = now()
FROM public.contratos c
WHERE a.id = '988dbfa9-372f-4706-a84d-9275e647e00a'
  AND c.id = '272d2bb4-3f02-4e84-b6c7-48c54b73fcae';