-- Criar VIEW para acompanhamento de leads pós-contrato
CREATE OR REPLACE VIEW public.view_acompanhamento AS
SELECT 
    l.id AS lead_id,
    l.nome,
    l.telefone,
    l.cpf,
    l.vendedor_id,
    a.id AS associado_id,
    a.status AS associado_status,
    v.id AS veiculo_id,
    v.marca AS veiculo_marca,
    v.modelo AS veiculo_modelo,
    v.ano_modelo AS veiculo_ano,
    v.placa AS veiculo_placa,
    v.status AS veiculo_status,
    i.id AS instalacao_id,
    i.status AS instalacao_status,
    i.data_agendada AS instalacao_data,
    -- Contagem de documentos
    COALESCE((
        SELECT COUNT(*) 
        FROM documentos d 
        WHERE d.associado_id = a.id
    ), 0)::integer AS docs_total,
    COALESCE((
        SELECT COUNT(*) 
        FROM documentos d 
        WHERE d.associado_id = a.id AND d.status = 'aprovado'
    ), 0)::integer AS docs_aprovados,
    -- Fase calculada automaticamente
    CASE 
        WHEN a.id IS NULL THEN 'documentacao'
        WHEN EXISTS (
            SELECT 1 FROM documentos d 
            WHERE d.associado_id = a.id 
            AND d.status IN ('pendente', 'reprovado')
        ) THEN 'documentacao'
        WHEN EXISTS (
            SELECT 1 FROM documentos d 
            WHERE d.associado_id = a.id 
            AND d.status = 'em_analise'
        ) THEN 'analise_cadastro'
        WHEN a.status = 'em_analise' THEN 'analise_cadastro'
        WHEN a.status IN ('aprovado', 'aguardando_instalacao') 
             AND (i.id IS NULL OR i.status IS NULL) THEN 'aprovado'
        WHEN i.status IN ('agendada', 'em_rota', 'em_andamento', 'reagendada') THEN 'instalacao_agendada'
        WHEN i.status = 'concluida' AND v.status = 'instalacao_pendente' THEN 'instalacao_concluida'
        WHEN v.status = 'ativo' AND a.status != 'ativo' THEN 'ativacao_pendente'
        WHEN a.status = 'ativo' THEN 'ativo'
        ELSE 'documentacao'
    END AS fase_acompanhamento,
    -- Dados do vendedor
    p.nome AS vendedor_nome,
    -- Updated at mais recente
    GREATEST(l.updated_at, COALESCE(a.updated_at, l.updated_at)) AS updated_at
FROM leads l
LEFT JOIN associados a ON a.id = l.associado_id
LEFT JOIN veiculos v ON v.associado_id = a.id AND v.ativo = true
LEFT JOIN instalacoes i ON i.veiculo_id = v.id
LEFT JOIN profiles p ON p.user_id = l.vendedor_id
WHERE l.etapa IN ('contrato_assinado', 'instalacao_agendada', 'ganho');