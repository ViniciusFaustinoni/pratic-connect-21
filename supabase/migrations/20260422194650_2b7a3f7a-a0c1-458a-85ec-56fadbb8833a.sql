-- Reabrir serviço de instalação do Edgar Da Silva Santos (VEN-2026-00006, Honda CG 160 Start, TUM3D59)
-- Serviço atribuído ao Wallace estava preso em etapa_atual=3 mesmo após reabertura no desktop,
-- causando divergência com o app mobile. Reset completo para nova execução limpa.

UPDATE public.servicos
SET
  status = 'aprovada',
  etapa_atual = 1,
  iniciada_em = NULL,
  em_rota_em = NULL,
  concluida_em = NULL,
  decisao_instalador = NULL,
  ressalvas_instalador = NULL,
  fotos_ressalva = NULL,
  checklist_data = NULL,
  assinatura_cliente_url = NULL,
  quilometragem = NULL,
  km_atual = NULL,
  avarias = NULL,
  video_360_url = NULL,
  fotos_recusa = NULL,
  rastreador_id = NULL,
  imei_rastreador = NULL,
  imprevisto_registrado_em = NULL,
  imprevisto_motivo = NULL,
  imprevisto_duplo_check = NULL,
  imprevisto_duplo_check_em = NULL,
  imprevisto_origem = NULL,
  data_agendada = CURRENT_DATE,
  updated_at = NOW()
WHERE id = '70abc44a-8004-4b41-a468-4ead8d796b07';

-- Limpar fotos da execução anterior
DELETE FROM public.servico_fotos
WHERE servico_id = '70abc44a-8004-4b41-a468-4ead8d796b07';

-- Limpar instalação relacionada (se houver registro em instalacoes pelo associado/veículo recente)
UPDATE public.instalacoes
SET status = 'agendada', concluida_em = NULL, updated_at = NOW()
WHERE associado_id = '4326b0f4-ba90-49fb-ad98-e58e3e298fbe'
  AND veiculo_id = '55c2f9bc-9c16-4e63-a838-d2fbe143d5aa'
  AND status = 'concluida';