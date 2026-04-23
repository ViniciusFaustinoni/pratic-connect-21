-- Corrige URL do botão do template termo_filiacao_assinatura_v2
-- De: https://app.praticcar.org/contrato/{{1}} (rota inexistente, link quebrado)
-- Para: https://assina.ae/{{1}} (link real Autentique, padrão Meta-aprovado)
UPDATE public.whatsapp_meta_templates
SET
  botoes = '[{"tipo":"url","texto":"Assinar termo","url":"https://assina.ae/{{1}}","exemplo":"https://assina.ae/abc123"}]'::jsonb,
  status = 'RASCUNHO',
  meta_template_id = NULL,
  motivo_rejeicao = NULL,
  enviado_em = NULL,
  aprovado_em = NULL,
  updated_at = now()
WHERE nome = 'termo_filiacao_assinatura_v2';