
UPDATE public.cotacoes
SET tipo_entrada = 'inclusao',
    vistoria_data_agendada = '2026-05-05',
    vistoria_periodo = 'tarde',
    vistoria_endereco_logradouro = 'UA LEANDRO PINTO',
    vistoria_endereco_numero = '49 AP 101 FD',
    vistoria_endereco_bairro = 'AGUA SANTA',
    vistoria_endereco_cidade = 'RIO DE JANEIRO',
    vistoria_endereco_estado = 'RJ',
    vistoria_responsavel_eu_mesmo = true,
    updated_at = now()
WHERE id = 'd60c6dec-f52a-427f-aa82-342fc6b6f7a5';

UPDATE public.contratos
SET tipo_entrada = 'inclusao',
    vistoria_completa_data_agendada = '2026-05-05',
    vistoria_completa_endereco_logradouro = 'UA LEANDRO PINTO',
    vistoria_completa_endereco_numero = '49 AP 101 FD',
    vistoria_completa_endereco_bairro = 'AGUA SANTA',
    vistoria_completa_endereco_cidade = 'RIO DE JANEIRO',
    vistoria_completa_endereco_estado = 'RJ',
    vistoria_completa_responsavel_eu_mesmo = true,
    updated_at = now()
WHERE id = 'ae3e0ac3-0506-4998-a4d5-bd270b70eabc';
