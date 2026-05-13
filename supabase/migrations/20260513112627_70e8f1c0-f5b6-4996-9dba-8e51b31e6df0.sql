
-- Atualizar URL do botão do assinatura_instalacao_v1
UPDATE whatsapp_meta_templates
SET botoes = '[{"tipo":"url","texto":"Assinar agora","url":"https://app.praticcar.org/acompanhar/{{1}}","telefone":""}]'::jsonb,
    status = 'DRAFT',
    motivo_rejeicao = NULL,
    updated_at = now()
WHERE nome = 'assinatura_instalacao_v1';

-- Adicionar botão URL ao documentacao_pendente
UPDATE whatsapp_meta_templates
SET botoes = '[{"tipo":"url","texto":"Enviar documentos","url":"https://app.praticcar.org/acompanhar/{{1}}","telefone":""}]'::jsonb,
    status = 'DRAFT',
    motivo_rejeicao = NULL,
    updated_at = now()
WHERE nome = 'documentacao_pendente';

-- Forçar reenvio dos templates de troca de titularidade
UPDATE whatsapp_meta_templates
SET status = 'DRAFT', motivo_rejeicao = NULL, updated_at = now()
WHERE nome IN ('troca_titularidade_aprovada','troca_titularidade_reprovada','troca_titularidade_termo_pendente');
