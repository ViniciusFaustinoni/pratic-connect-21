DELETE FROM public.vistoria_fotos
WHERE vistoria_id = 'a9329637-aae6-4c5f-8fdc-6701c5a8b1b6';

DELETE FROM public.vistorias
WHERE id = 'a9329637-aae6-4c5f-8fdc-6701c5a8b1b6';

DELETE FROM public.cotacoes_vistoria_fotos
WHERE cotacao_id = 'b50180dc-e4f0-420f-8f08-a07175ef0212';

UPDATE public.servicos
SET status = 'cancelada'
WHERE id = '526b7da0-a2c3-43bb-86e7-96eb363215b3'
  AND status NOT IN ('concluida','aprovada','reprovada','aprovada_ressalvas');

UPDATE public.cotacoes
SET tipo_vistoria = NULL,
    vistoria_data_agendada = NULL,
    vistoria_horario_agendado = NULL,
    vistoria_periodo = NULL,
    vistoria_completa_data_agendada = NULL,
    vistoria_completa_horario_agendado = NULL,
    vistoria_completa_periodo = NULL
WHERE id = 'b50180dc-e4f0-420f-8f08-a07175ef0212';

UPDATE public.contratos
SET cadastro_aprovado = false
WHERE id = '226eacc0-1938-4b5e-9ae1-fa9c209875d8'
  AND cadastro_aprovado IS DISTINCT FROM false;