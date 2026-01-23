-- ============================================
-- MIGRAÇÃO: Criação da Tabela Unificada SERVICOS
-- Unifica instalacoes + vistorias em uma única entidade
-- ============================================

-- 1. CRIAR ENUMS
-- ============================================

-- Tipo de serviço
CREATE TYPE tipo_servico AS ENUM (
  'instalacao',
  'vistoria_entrada',
  'vistoria_saida',
  'vistoria_sinistro',
  'vistoria_periodica',
  'vistoria_manutencao'
);

-- Status do serviço
CREATE TYPE status_servico AS ENUM (
  'pendente',
  'agendada',
  'em_rota',
  'em_andamento',
  'concluida',
  'aprovada',
  'reprovada',
  'aprovada_ressalvas',
  'em_analise',
  'reagendada',
  'cancelada'
);

-- Período do serviço
CREATE TYPE periodo_servico AS ENUM ('manha', 'tarde', 'noite');

-- 2. CRIAR TABELA SERVICOS
-- ============================================

CREATE TABLE servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo e Status
  tipo tipo_servico NOT NULL,
  status status_servico NOT NULL DEFAULT 'agendada',
  
  -- Agendamento
  data_agendada DATE NOT NULL,
  hora_agendada TIME,
  periodo periodo_servico NOT NULL DEFAULT 'manha',
  permite_encaixe BOOLEAN DEFAULT FALSE,
  local_vistoria TEXT DEFAULT 'cliente',
  
  -- Endereço (padronizado)
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  
  -- Relacionamentos principais
  associado_id UUID REFERENCES associados(id) ON DELETE SET NULL,
  veiculo_id UUID REFERENCES veiculos(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
  cotacao_id UUID REFERENCES cotacoes(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  sinistro_id UUID REFERENCES sinistros(id) ON DELETE SET NULL,
  
  -- Profissional responsável (UNIFICADO - antes era instalador_id/vistoriador_id)
  profissional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rota_id UUID REFERENCES rotas(id) ON DELETE SET NULL,
  
  -- Timestamps de workflow
  em_rota_em TIMESTAMPTZ,
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  
  -- Campos específicos de instalação
  rastreador_id UUID REFERENCES rastreadores(id) ON DELETE SET NULL,
  imei_rastreador TEXT,
  checklist_data JSONB DEFAULT '{}',
  quilometragem INTEGER,
  assinatura_cliente_url TEXT,
  
  -- Campos específicos de vistoria
  km_atual INTEGER,
  avarias TEXT,
  video_360_url TEXT,
  fotos_recusa TEXT[],
  modalidade VARCHAR(50) DEFAULT 'presencial',
  protocolo VARCHAR(50),
  
  -- Análise de vistoria
  analisado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  analisado_em TIMESTAMPTZ,
  observacoes_analise TEXT,
  ressalvas TEXT,
  motivo_reprovacao TEXT,
  
  -- Assinatura digital (Autentique)
  assinatura_autentique_id VARCHAR(255),
  assinatura_status VARCHAR(50) DEFAULT 'pendente',
  assinatura_enviada_em TIMESTAMPTZ,
  assinatura_concluida_em TIMESTAMPTZ,
  assinatura_documento_url TEXT,
  
  -- Campos gerais
  observacoes TEXT,
  origem TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Referências para migração (temporário - permite rastrear origem)
  instalacao_origem_id UUID,
  vistoria_origem_id UUID
);

-- 3. CRIAR ÍNDICES
-- ============================================

CREATE INDEX idx_servicos_tipo ON servicos(tipo);
CREATE INDEX idx_servicos_status ON servicos(status);
CREATE INDEX idx_servicos_data_agendada ON servicos(data_agendada);
CREATE INDEX idx_servicos_profissional_id ON servicos(profissional_id);
CREATE INDEX idx_servicos_associado_id ON servicos(associado_id);
CREATE INDEX idx_servicos_veiculo_id ON servicos(veiculo_id);
CREATE INDEX idx_servicos_cotacao_id ON servicos(cotacao_id);
CREATE INDEX idx_servicos_rota_id ON servicos(rota_id);
CREATE INDEX idx_servicos_status_data ON servicos(status, data_agendada);
CREATE INDEX idx_servicos_profissional_status ON servicos(profissional_id, status);

-- 4. CRIAR TRIGGER PARA UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_servicos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_servicos_updated_at
  BEFORE UPDATE ON servicos
  FOR EACH ROW EXECUTE FUNCTION update_servicos_updated_at();

-- 5. HABILITAR RLS E CRIAR POLICIES
-- ============================================

ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

-- Funcionários podem ver todos os serviços
CREATE POLICY "Funcionarios podem ver servicos"
ON servicos FOR SELECT
TO authenticated
USING (public.am_i_funcionario());

-- Funcionários podem gerenciar serviços
CREATE POLICY "Funcionarios podem gerenciar servicos"
ON servicos FOR ALL
TO authenticated
USING (public.am_i_funcionario())
WITH CHECK (public.am_i_funcionario());

-- 6. MIGRAR DADOS DE INSTALAÇÕES
-- ============================================

INSERT INTO servicos (
  tipo, status, data_agendada, hora_agendada, periodo,
  cep, logradouro, numero, complemento, bairro, cidade, uf,
  latitude, longitude,
  associado_id, veiculo_id, contrato_id, cotacao_id, lead_id,
  profissional_id, rota_id,
  em_rota_em, iniciada_em, concluida_em,
  rastreador_id, imei_rastreador, checklist_data, quilometragem,
  assinatura_cliente_url, permite_encaixe, local_vistoria,
  observacoes, created_at, updated_at, instalacao_origem_id
)
SELECT 
  'instalacao'::tipo_servico,
  CASE i.status::text
    WHEN 'pendente' THEN 'pendente'::status_servico
    WHEN 'agendada' THEN 'agendada'::status_servico
    WHEN 'em_rota' THEN 'em_rota'::status_servico
    WHEN 'em_andamento' THEN 'em_andamento'::status_servico
    WHEN 'concluida' THEN 'concluida'::status_servico
    WHEN 'reagendada' THEN 'reagendada'::status_servico
    WHEN 'cancelada' THEN 'cancelada'::status_servico
    ELSE 'agendada'::status_servico
  END,
  COALESCE(i.data_agendada, i.created_at::date),
  i.hora_agendada,
  COALESCE(i.periodo::text, 'manha')::periodo_servico,
  i.cep, i.logradouro, i.numero, i.complemento, i.bairro, i.cidade, i.uf,
  i.endereco_latitude, i.endereco_longitude,
  i.associado_id, i.veiculo_id, i.contrato_id, i.cotacao_id, i.lead_id,
  COALESCE(i.instalador_responsavel_id, i.instalador_id),
  i.rota_id,
  i.em_rota_em, i.iniciada_em, i.concluida_em,
  i.rastreador_id, i.imei_rastreador, i.checklist_data, i.quilometragem,
  i.assinatura_cliente_url, COALESCE(i.permite_encaixe, false), i.local_vistoria,
  i.observacoes, i.created_at, i.updated_at, i.id
FROM instalacoes i;

-- 7. MIGRAR DADOS DE VISTORIAS
-- ============================================

INSERT INTO servicos (
  tipo, status, data_agendada, hora_agendada, periodo,
  cep, logradouro, numero, bairro, cidade, uf,
  latitude, longitude,
  associado_id, veiculo_id, contrato_id, cotacao_id, lead_id, sinistro_id,
  profissional_id, rota_id,
  em_rota_em, iniciada_em, concluida_em,
  km_atual, avarias, video_360_url, fotos_recusa,
  modalidade, protocolo,
  analisado_por, analisado_em, observacoes_analise, ressalvas, motivo_reprovacao,
  assinatura_autentique_id, assinatura_status, assinatura_enviada_em,
  assinatura_concluida_em, assinatura_documento_url,
  imei_rastreador, permite_encaixe, local_vistoria,
  observacoes, origem, created_at, updated_at, vistoria_origem_id
)
SELECT 
  CASE v.tipo::text
    WHEN 'entrada' THEN 'vistoria_entrada'::tipo_servico
    WHEN 'saida' THEN 'vistoria_saida'::tipo_servico
    WHEN 'sinistro' THEN 'vistoria_sinistro'::tipo_servico
    WHEN 'periodica' THEN 'vistoria_periodica'::tipo_servico
    WHEN 'manutencao' THEN 'vistoria_manutencao'::tipo_servico
    ELSE 'vistoria_entrada'::tipo_servico
  END,
  CASE v.status::text
    WHEN 'pendente' THEN 'pendente'::status_servico
    WHEN 'agendada' THEN 'agendada'::status_servico
    WHEN 'em_rota' THEN 'em_rota'::status_servico
    WHEN 'em_andamento' THEN 'em_andamento'::status_servico
    WHEN 'concluida' THEN 'concluida'::status_servico
    WHEN 'em_analise' THEN 'em_analise'::status_servico
    WHEN 'aprovada' THEN 'aprovada'::status_servico
    WHEN 'reprovada' THEN 'reprovada'::status_servico
    WHEN 'aprovada_ressalvas' THEN 'aprovada_ressalvas'::status_servico
    WHEN 'cancelada' THEN 'cancelada'::status_servico
    ELSE 'agendada'::status_servico
  END,
  COALESCE(v.data_agendada::date, v.created_at::date),
  v.horario_agendado,
  'manha'::periodo_servico,
  v.endereco_cep, v.endereco_logradouro, v.endereco_numero,
  v.endereco_bairro, v.endereco_cidade, v.endereco_estado,
  v.endereco_latitude, v.endereco_longitude,
  v.associado_id, v.veiculo_id, v.contrato_id, v.cotacao_id, v.lead_id, v.sinistro_id,
  v.vistoriador_id, v.rota_id,
  v.em_rota_em, v.iniciada_em, v.concluida_em,
  v.km_atual, v.avarias, v.video_360_url, v.fotos_recusa,
  v.modalidade, v.protocolo,
  v.analisado_por, v.analisado_em, v.observacoes_analise, v.ressalvas, v.motivo_reprovacao,
  v.assinatura_autentique_id, v.assinatura_status, v.assinatura_enviada_em,
  v.assinatura_concluida_em, v.assinatura_documento_url,
  v.imei_rastreador, COALESCE(v.permite_encaixe, false), v.local_vistoria,
  v.observacoes, v.origem, v.created_at, v.updated_at, v.id
FROM vistorias v;

-- 8. CRIAR TABELA DE FOTOS UNIFICADA
-- ============================================

CREATE TABLE servico_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL,
  arquivo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_servico_fotos_servico_id ON servico_fotos(servico_id);

ALTER TABLE servico_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver fotos"
ON servico_fotos FOR SELECT
TO authenticated
USING (public.am_i_funcionario());

CREATE POLICY "Funcionarios podem gerenciar fotos"
ON servico_fotos FOR ALL
TO authenticated
USING (public.am_i_funcionario())
WITH CHECK (public.am_i_funcionario());

-- 9. MIGRAR FOTOS DE VISTORIAS
-- ============================================

INSERT INTO servico_fotos (servico_id, tipo, arquivo_url, created_at)
SELECT 
  s.id,
  vf.tipo,
  vf.arquivo_url,
  vf.created_at
FROM vistoria_fotos vf
JOIN servicos s ON s.vistoria_origem_id = vf.vistoria_id;

-- 10. CRIAR FUNÇÃO RPC UNIFICADA PARA BUSCAR TAREFA ATUAL
-- ============================================

CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_profissional(p_profissional_id UUID)
RETURNS TABLE (
  id UUID, 
  tipo TEXT, 
  status TEXT, 
  data_agendada DATE, 
  hora_agendada TIME, 
  periodo TEXT,
  associado_id UUID, 
  associado_nome TEXT, 
  associado_telefone TEXT,
  associado_whatsapp TEXT,
  veiculo_id UUID, 
  veiculo_placa TEXT, 
  veiculo_marca TEXT, 
  veiculo_modelo TEXT,
  veiculo_cor TEXT,
  logradouro TEXT, 
  numero TEXT, 
  bairro TEXT, 
  cidade TEXT, 
  uf TEXT,
  cep TEXT,
  latitude DOUBLE PRECISION, 
  longitude DOUBLE PRECISION, 
  rota_id UUID,
  cotacao_id UUID,
  contrato_id UUID,
  rastreador_id UUID,
  imei_rastreador TEXT,
  local_vistoria TEXT,
  observacoes TEXT,
  iniciada_em TIMESTAMPTZ,
  em_rota_em TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id, 
    s.tipo::TEXT, 
    s.status::TEXT, 
    s.data_agendada, 
    s.hora_agendada,
    s.periodo::TEXT,
    s.associado_id, 
    a.nome, 
    a.telefone,
    a.whatsapp,
    s.veiculo_id, 
    v.placa, 
    v.marca, 
    v.modelo,
    v.cor,
    s.logradouro, 
    s.numero, 
    s.bairro, 
    s.cidade, 
    s.uf,
    s.cep,
    s.latitude::DOUBLE PRECISION, 
    s.longitude::DOUBLE PRECISION, 
    s.rota_id,
    s.cotacao_id,
    s.contrato_id,
    s.rastreador_id,
    s.imei_rastreador,
    s.local_vistoria,
    s.observacoes,
    s.iniciada_em,
    s.em_rota_em
  FROM servicos s 
  LEFT JOIN associados a ON a.id = s.associado_id 
  LEFT JOIN veiculos v ON v.id = s.veiculo_id
  WHERE s.profissional_id = p_profissional_id 
    AND s.status::TEXT IN ('em_rota', 'em_andamento')
  ORDER BY 
    CASE WHEN s.status::TEXT = 'em_andamento' THEN 0 ELSE 1 END,
    s.data_agendada,
    s.hora_agendada
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. ADICIONAR REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE servicos;

-- 12. ADICIONAR COMENTÁRIOS
-- ============================================

COMMENT ON TABLE servicos IS 'Tabela unificada para instalações e vistorias. Substitui as tabelas instalacoes e vistorias.';
COMMENT ON COLUMN servicos.tipo IS 'Tipo do serviço: instalacao, vistoria_entrada, vistoria_saida, etc.';
COMMENT ON COLUMN servicos.profissional_id IS 'ID do profissional responsável (antes era instalador_id ou vistoriador_id)';
COMMENT ON COLUMN servicos.instalacao_origem_id IS 'ID da instalação original (para rastreabilidade na migração)';
COMMENT ON COLUMN servicos.vistoria_origem_id IS 'ID da vistoria original (para rastreabilidade na migração)';