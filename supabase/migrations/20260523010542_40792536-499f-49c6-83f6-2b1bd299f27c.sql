UPDATE public.veiculos
SET troca_titularidade_id = NULL,
    troca_titularidade_iniciada_em = NULL,
    cobertura_suspensa = false,
    cobertura_suspensa_em = NULL,
    cobertura_suspensa_motivo = NULL
WHERE id = '9e42bc9b-d1ae-4482-866f-d828c8c119f4'
  AND cobertura_suspensa_motivo = 'troca_titularidade_em_andamento';