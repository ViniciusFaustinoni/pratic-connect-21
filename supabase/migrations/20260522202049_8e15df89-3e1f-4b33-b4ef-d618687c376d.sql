
UPDATE public.instalacoes
SET status = 'cancelada', updated_at = now(),
    observacoes = COALESCE(observacoes,'') || E'\n[REABERTURA MANUAL 2026-05-22] Cancelada por solicitação da diretoria para devolver a cotação à escolha do tipo de vistoria.'
WHERE id = 'cbbba23b-441d-4ea5-8d45-d6186c9e6ca7';

UPDATE public.servicos
SET status = 'cancelada', updated_at = now()
WHERE id = 'c65666a6-c662-44da-ba79-5fb48c7e5282';

UPDATE public.vistorias
SET status = 'cancelada', updated_at = now()
WHERE id = 'd0456af4-408a-4587-8f77-4c99da532f73';

UPDATE public.cotacoes
SET tipo_vistoria = NULL,
    tipo_instalacao = NULL,
    vistoria_data_agendada = NULL,
    vistoria_horario_agendado = NULL,
    vistoria_endereco_logradouro = NULL,
    vistoria_endereco_numero = NULL,
    vistoria_endereco_bairro = NULL,
    vistoria_endereco_cidade = NULL,
    vistoria_endereco_estado = NULL,
    vistoria_endereco_cep = NULL,
    vistoria_endereco_latitude = NULL,
    vistoria_endereco_longitude = NULL,
    vistoria_completa_data_agendada = NULL,
    vistoria_completa_horario_agendado = NULL,
    vistoria_completa_periodo = NULL,
    vistoria_completa_endereco_logradouro = NULL,
    vistoria_completa_endereco_numero = NULL,
    vistoria_completa_endereco_bairro = NULL,
    vistoria_completa_endereco_cidade = NULL,
    vistoria_completa_endereco_estado = NULL,
    vistoria_completa_endereco_cep = NULL,
    vistoria_completa_responsavel_nome = NULL,
    vistoria_completa_responsavel_telefone = NULL,
    status_contratacao = 'pagamento_ok',
    updated_at = now()
WHERE id = '1c4eedee-994d-4099-a02c-ab3b3826d334';

INSERT INTO public.logs_auditoria (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
VALUES (
  'cotacoes',
  '1c4eedee-994d-4099-a02c-ab3b3826d334',
  'editar',
  jsonb_build_object(
    'tipo_vistoria','agendada',
    'tipo_instalacao','rota',
    'vistoria_data_agendada','2026-05-25',
    'instalacao_id','cbbba23b-441d-4ea5-8d45-d6186c9e6ca7',
    'servico_id','c65666a6-c662-44da-ba79-5fb48c7e5282',
    'vistoria_id','d0456af4-408a-4587-8f77-4c99da532f73'
  ),
  jsonb_build_object(
    'operacao','reabertura_manual_tipo_vistoria',
    'tipo_vistoria',null,
    'tipo_instalacao',null,
    'vistoria_data_agendada',null,
    'status_contratacao','pagamento_ok',
    'motivo','Solicitação da diretoria — reabrir cotação na etapa de escolha do tipo de vistoria; agendamento original cancelado.'
  ),
  'ceaa9ea5-f8ef-4eaa-a4d3-5601a02bc28c'
);
