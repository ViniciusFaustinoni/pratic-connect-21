-- Estágio 3: Recriar View do Mapa Unificada (Corrigido v2)

DROP VIEW IF EXISTS view_vistorias_mapa;

CREATE VIEW view_vistorias_mapa AS
SELECT 
  v.id,
  v.tipo::text as tipo_vistoria,
  COALESCE(v.origem, 'vistoria') as tipo_servico,
  v.status::text,
  v.data_agendada,
  v.horario_agendado::text,
  v.endereco_logradouro,
  v.endereco_numero,
  v.endereco_bairro,
  v.endereco_cidade,
  v.endereco_cep,
  v.endereco_latitude as latitude,
  v.endereco_longitude as longitude,
  -- Dados do associado (pode vir de associados ou leads)
  COALESCE(a.nome, l.nome) as associado_nome,
  COALESCE(a.telefone, l.telefone) as associado_telefone,
  a.whatsapp as associado_whatsapp,
  -- Dados do veículo (pode vir de veiculos ou cotacoes ou contratos)
  COALESCE(ve.marca, cot.veiculo_marca, ctr.veiculo_marca) as veiculo_marca,
  COALESCE(ve.modelo, cot.veiculo_modelo, ctr.veiculo_modelo) as veiculo_modelo,
  COALESCE(ve.placa, cot.veiculo_placa, ctr.veiculo_placa) as veiculo_placa,
  COALESCE(ve.cor, ctr.veiculo_cor) as veiculo_cor,
  -- Vistoriador
  v.vistoriador_id,
  -- Dados da rota
  v.rota_id,
  r.codigo as rota_codigo,
  r.regiao as rota_regiao,
  r.cor as rota_cor,
  -- Nome do vistoriador via rota_instaladores ou profiles
  COALESCE(
    pv.nome,
    (SELECT p.nome FROM rota_instaladores ri 
     JOIN profiles p ON p.user_id = ri.instalador_id 
     WHERE ri.rota_id = v.rota_id LIMIT 1)
  ) as vistoriador_nome
FROM vistorias v
LEFT JOIN associados a ON a.id = v.associado_id
LEFT JOIN leads l ON l.id = v.lead_id
LEFT JOIN veiculos ve ON ve.id = v.veiculo_id
LEFT JOIN cotacoes cot ON cot.id = v.cotacao_id
LEFT JOIN contratos ctr ON ctr.id = v.contrato_id
LEFT JOIN rotas r ON r.id = v.rota_id
LEFT JOIN profiles pv ON pv.user_id = v.vistoriador_id
WHERE v.status IN ('pendente', 'em_analise');

-- Adicionar comentário na view
COMMENT ON VIEW view_vistorias_mapa IS 'View unificada de vistorias para exibição no mapa - busca dados de todas as origens';

-- Estágio 4: RLS para Coordenador de Monitoramento

-- Remover policy existente se houver
DROP POLICY IF EXISTS "Monitoring can update vistorias" ON vistorias;
DROP POLICY IF EXISTS "Monitoring can update vistorias route" ON vistorias;

-- Criar policy para permitir que coordenador atualize vistorias
CREATE POLICY "Monitoring can update vistorias route" ON vistorias
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento')
  OR has_role(auth.uid(), 'diretor')
  OR has_role(auth.uid(), 'admin_master')
  OR vistoriador_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_monitoramento')
  OR has_role(auth.uid(), 'diretor')
  OR has_role(auth.uid(), 'admin_master')
  OR vistoriador_id = auth.uid()
);