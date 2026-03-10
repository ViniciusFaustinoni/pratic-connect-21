
-- Recriar view_acompanhamento com 12 fases granulares
DROP VIEW IF EXISTS view_acompanhamento;

CREATE OR REPLACE VIEW view_acompanhamento AS
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
  vis.id AS vistoria_id,
  vis.status AS vistoria_status,
  vis.data_agendada AS vistoria_data,
  vis.tipo AS vistoria_tipo,
  ct.id AS contrato_id,
  ct.status AS contrato_status,
  ct.data_assinatura AS contrato_data_assinatura,
  ct.adesao_paga AS contrato_adesao_paga,
  cp.id AS cotacao_publica_id,
  cp.status AS cotacao_publica_status,
  COALESCE((SELECT count(*) FROM documentos d WHERE d.associado_id = a.id), 0)::integer AS docs_total,
  COALESCE((SELECT count(*) FROM documentos d WHERE d.associado_id = a.id AND d.status = 'aprovado'), 0)::integer AS docs_aprovados,
  CASE
    WHEN a.status = 'ativo' THEN 'ativo'
    WHEN i.status IN ('em_rota', 'em_andamento') THEN 'instalacao_andamento'
    WHEN i.status IN ('agendada', 'reagendada') THEN 'instalacao_agendada'
    WHEN i.status = 'concluida' AND a.status <> 'ativo' THEN 'ativacao_pendente'
    WHEN ct.data_assinatura IS NOT NULL AND ct.status IN ('assinado', 'ativo') THEN 'contrato_assinado'
    WHEN ct.id IS NOT NULL AND ct.data_assinatura IS NULL AND ct.status NOT IN ('cancelado') THEN 'contrato_pendente'
    WHEN ct.id IS NOT NULL AND ct.adesao_paga = false THEN 'pagamento_pendente'
    WHEN vis.status = 'em_analise' THEN 'vistoria_analise'
    WHEN vis.status IN ('agendada', 'em_rota', 'em_andamento') THEN 'vistoria_agendada'
    WHEN a.status = 'pendente_vistoria' OR (a.status IN ('aprovado', 'aguardando_instalacao') AND vis.id IS NULL AND i.id IS NULL) THEN 'vistoria_pendente'
    WHEN EXISTS (SELECT 1 FROM documentos d WHERE d.associado_id = a.id AND d.status = 'em_analise') THEN 'documentacao_analise'
    WHEN a.id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM documentos d WHERE d.associado_id = a.id AND d.status IN ('pendente', 'reprovado'))
      OR a.status = 'documentacao_pendente'
    ) THEN 'documentacao_pendente'
    WHEN cp.id IS NOT NULL AND cp.status NOT IN ('aprovado', 'expirado', 'cancelado', 'recusado') THEN 'cotacao_pendente'
    WHEN a.id IS NOT NULL THEN 'documentacao_pendente'
    ELSE 'cotacao_pendente'
  END AS fase_acompanhamento,
  CASE
    WHEN a.status = 'ativo' THEN 'Associado totalmente ativo'
    WHEN i.status = 'em_rota' THEN 'Instalador a caminho'
    WHEN i.status = 'em_andamento' THEN 'Instalação em execução'
    WHEN i.status IN ('agendada', 'reagendada') THEN 'Agendada para ' || COALESCE(to_char(i.data_agendada, 'DD/MM'), 'data a definir')
    WHEN i.status = 'concluida' AND a.status <> 'ativo' THEN 'Instalação concluída, ativação pendente'
    WHEN ct.data_assinatura IS NOT NULL AND ct.status IN ('assinado', 'ativo') THEN 'Contrato assinado em ' || to_char(ct.data_assinatura, 'DD/MM')
    WHEN ct.id IS NOT NULL AND ct.data_assinatura IS NULL THEN 'Aguardando assinatura do contrato'
    WHEN ct.id IS NOT NULL AND ct.adesao_paga = false THEN 'Aguardando pagamento da adesão'
    WHEN vis.status = 'em_analise' THEN 'Fotos de vistoria em análise'
    WHEN vis.status = 'agendada' THEN 'Vistoria agendada para ' || COALESCE(to_char(vis.data_agendada, 'DD/MM'), 'data a definir')
    WHEN vis.status IN ('em_rota', 'em_andamento') THEN 'Vistoria em andamento'
    WHEN a.status = 'pendente_vistoria' THEN 'Precisa agendar vistoria'
    WHEN EXISTS (SELECT 1 FROM documentos d WHERE d.associado_id = a.id AND d.status = 'em_analise') THEN 'Documentos em análise pelo monitoramento'
    WHEN a.status = 'documentacao_pendente' THEN 'Aguardando envio de documentos'
    WHEN cp.status = 'documentos_ok' THEN 'Documentos enviados via cotação'
    WHEN cp.status = 'selfie_ok' THEN 'Verificação facial concluída'
    WHEN cp.status = 'vistoria_ok' THEN 'Vistoria concluída via cotação'
    WHEN cp.status = 'plano_escolhido' THEN 'Plano escolhido, aguardando proposta'
    WHEN cp.status = 'proposta_aceita' THEN 'Proposta aceita, enviando documentos'
    WHEN cp.status = 'visualizado' THEN 'Link visualizado pelo cliente'
    WHEN cp.status = 'aguardando' THEN 'Link enviado, aguardando acesso'
    ELSE NULL
  END AS detalhe_fase,
  p.nome AS vendedor_nome,
  GREATEST(l.updated_at, COALESCE(a.updated_at, l.updated_at), COALESCE(ct.updated_at, l.updated_at), COALESCE(vis.updated_at, l.updated_at)) AS updated_at
FROM leads l
LEFT JOIN associados a ON a.id = l.associado_id
LEFT JOIN veiculos v ON v.associado_id = a.id AND v.ativo = true
LEFT JOIN instalacoes i ON i.veiculo_id = v.id AND i.status NOT IN ('cancelada')
LEFT JOIN vistorias vis ON (vis.veiculo_id = v.id OR vis.lead_id = l.id) AND vis.tipo = 'entrada' AND vis.status NOT IN ('cancelada', 'reprovada')
LEFT JOIN contratos ct ON (ct.associado_id = a.id OR ct.lead_id = l.id) AND ct.status NOT IN ('cancelado')
LEFT JOIN cotacoes_publicas cp ON cp.lead_id = l.id AND cp.status NOT IN ('expirado', 'cancelado')
LEFT JOIN profiles p ON p.user_id = l.vendedor_id
WHERE l.etapa = ANY (ARRAY[
  'cotacao_enviada'::etapa_lead,
  'negociacao'::etapa_lead,
  'vistoria_agendada'::etapa_lead,
  'contrato_enviado'::etapa_lead,
  'contrato_assinado'::etapa_lead,
  'instalacao_agendada'::etapa_lead,
  'ganho'::etapa_lead
]);
