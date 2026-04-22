-- Reset completo da execução da vistoria/instalação do associado Wendel Luiz Pedro Santiago
-- Placa: 0KM376EB | Serviço em andamento do Wallace

UPDATE public.servicos
SET
  status = 'aprovada',
  etapa_atual = 1,
  em_rota_em = NULL,
  iniciada_em = NULL,
  concluida_em = NULL,
  rastreador_id = NULL,
  imei_rastreador = NULL,
  checklist_data = NULL,
  quilometragem = NULL,
  assinatura_cliente_url = NULL,
  km_atual = NULL,
  avarias = NULL,
  video_360_url = NULL,
  fotos_recusa = NULL,
  observacoes = NULL,
  ressalvas = NULL,
  motivo_reprovacao = NULL,
  decisao_instalador = NULL,
  ressalvas_instalador = NULL,
  fotos_ressalva = NULL,
  imprevisto_registrado_em = NULL,
  imprevisto_motivo = NULL,
  imprevisto_duplo_check = NULL,
  imprevisto_duplo_check_em = NULL,
  imprevisto_origem = NULL,
  assinatura_autentique_id = NULL,
  assinatura_status = NULL,
  assinatura_enviada_em = NULL,
  assinatura_concluida_em = NULL,
  assinatura_documento_url = NULL,
  laudo_autentique_id = NULL,
  laudo_autentique_url = NULL,
  laudo_assinado = NULL,
  laudo_assinado_em = NULL,
  laudo_pdf_url = NULL,
  laudo_pdf_assinado_url = NULL,
  updated_at = NOW()
WHERE id = 'a6580ea1-6da0-4c87-b211-1436c68b7664';

UPDATE public.vistorias
SET
  status = 'agendada',
  km_atual = NULL,
  avarias = NULL,
  observacoes = NULL,
  observacoes_analise = NULL,
  ressalvas = NULL,
  motivo_reprovacao = NULL,
  analisado_por = NULL,
  analisado_em = NULL,
  video_360_url = NULL,
  fotos_recusa = NULL,
  imei_rastreador = NULL,
  em_rota_em = NULL,
  iniciada_em = NULL,
  concluida_em = NULL,
  dados_parciais = NULL,
  updated_at = NOW()
WHERE id = 'f394c591-3f0d-4293-88dd-6a4d12cbeff3';

DELETE FROM public.vistoria_fotos
WHERE vistoria_id = 'f394c591-3f0d-4293-88dd-6a4d12cbeff3';

UPDATE public.agendamentos_base
SET
  status = 'confirmado',
  atendido_por = 'f6313b28-d376-4b82-8b1b-0b77d2c3c8dc',
  updated_at = NOW()
WHERE id = '50fcc551-7207-4019-808d-83376ed7f123';