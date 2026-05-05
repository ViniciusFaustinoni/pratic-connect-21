UPDATE public.associados
SET sexo = 'feminino',
    data_cadastro_sga = COALESCE(data_cadastro_sga, sincronizado_hinova_em, now())
WHERE id = 'd4138660-d5c7-40fe-bfdb-041a9588c589';

UPDATE public.contratos
SET cliente_estado_civil = cliente_estado_civil
WHERE id = '64aae9db-6d0b-4f5a-a4de-d3fade330688';