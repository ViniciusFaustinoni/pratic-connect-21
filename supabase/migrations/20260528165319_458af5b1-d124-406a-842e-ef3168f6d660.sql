UPDATE public.rastreadores
SET
  id_plataforma = '865011032275324',
  plataforma_device_id = '865011032275324',
  dados_extras = COALESCE(dados_extras, '{}'::jsonb) || jsonb_build_object(
    'saneamento_manual', true,
    'saneamento_motivo', 'Vinculo manual no painel Rede Veiculos em conta nao visivel pela API; IDs internos pendentes',
    'saneamento_em', now(),
    'idCliente_pendente', true,
    'idVeiculo_pendente', true
  ),
  updated_at = now()
WHERE id = '096341f0-54e8-48cd-a83b-abe7cd91d09e';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_novos)
VALUES (
  'editar',
  'monitoramento',
  'rastreadores',
  '096341f0-54e8-48cd-a83b-abe7cd91d09e',
  '[SANEAMENTO_MANUAL] JOHNSON SOUZA DA SILVA / RFH7G28 / IMEI 865011032275324 — id_plataforma e plataforma_device_id preenchidos com IMEI (equipment ID Rede). idCliente/idVeiculo internos da Rede pendentes.',
  jsonb_build_object('id_plataforma','865011032275324','plataforma_device_id','865011032275324','saneamento_manual',true)
);