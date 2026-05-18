UPDATE public.servicos
SET status = 'em_analise', updated_at = now(),
    observacoes = COALESCE(observacoes,'') || E'\n[2026-05-18] Reanimado: sub-FIPE deve permanecer em_analise ate Cadastro liberar R/F.'
WHERE id = 'fc91afa8-f786-46d7-90b7-64d66bda22b2';

UPDATE public.contratos
SET cadastro_aprovado = false, aprovado_em = NULL, aprovado_por = NULL, updated_at = now()
WHERE id = 'ae3b10af-100a-462d-8394-6be39a54d801';

UPDATE public.veiculos
SET cobertura_roubo_furto = false, cobertura_total = false, cobertura_suspensa = true, updated_at = now()
WHERE id = '6a60b9b6-e6df-47e6-bb14-b82852383d03';

UPDATE public.associados
SET status = 'em_analise', updated_at = now()
WHERE id = 'e1823797-eaf9-4e97-8f20-dd1e7276f485';