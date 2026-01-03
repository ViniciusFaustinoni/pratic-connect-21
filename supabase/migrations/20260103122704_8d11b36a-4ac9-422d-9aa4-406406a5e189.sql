-- =====================================================
-- MÓDULO 4 - PROMPT 05
-- ESTRUTURA DE POSIÇÕES GPS DOS RASTREADORES
-- =====================================================

-- =====================================================
-- PARTE 1: TABELA DE POSIÇÕES
-- =====================================================

CREATE TABLE IF NOT EXISTS rastreador_posicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rastreador (obrigatório)
  rastreador_id UUID NOT NULL REFERENCES rastreadores(id) ON DELETE CASCADE,
  
  -- Coordenadas GPS (obrigatório)
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  
  -- Dados do veículo
  velocidade INTEGER DEFAULT 0,
  ignicao BOOLEAN DEFAULT false,
  odometro INTEGER,
  direcao INTEGER,
  altitude INTEGER,
  
  -- Status do equipamento
  bateria_nivel INTEGER,
  sinal_gsm INTEGER,
  
  -- Endereço (preenchido via geocoding, opcional)
  endereco TEXT,
  
  -- Data/hora da posição (vinda da plataforma de rastreamento)
  data_posicao TIMESTAMPTZ NOT NULL,
  
  -- Data/hora de inserção no nosso banco
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE rastreador_posicoes IS 'Histórico de posições GPS dos rastreadores';

-- =====================================================
-- PARTE 2: ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pos_rastreador 
  ON rastreador_posicoes(rastreador_id);

CREATE INDEX IF NOT EXISTS idx_pos_data 
  ON rastreador_posicoes(data_posicao DESC);

CREATE INDEX IF NOT EXISTS idx_pos_rastreador_data 
  ON rastreador_posicoes(rastreador_id, data_posicao DESC);

CREATE INDEX IF NOT EXISTS idx_pos_created 
  ON rastreador_posicoes(created_at DESC);

-- =====================================================
-- PARTE 3: RLS (Row Level Security) - CORRIGIDO
-- =====================================================

ALTER TABLE rastreador_posicoes ENABLE ROW LEVEL SECURITY;

-- Funcionários podem ver todas as posições (usando função existente)
CREATE POLICY "Staff can view positions"
  ON rastreador_posicoes 
  FOR SELECT
  USING (is_funcionario(auth.uid()));

-- Associados podem ver posições dos seus veículos (JOIN CORRIGIDO)
CREATE POLICY "Associates can view own vehicle positions"
  ON rastreador_posicoes 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rastreadores r
      JOIN veiculos v ON r.veiculo_id = v.id
      WHERE r.id = rastreador_posicoes.rastreador_id
        AND v.associado_id = get_my_associado_id(auth.uid())
    )
  );

-- Sistema pode inserir posições (via Edge Function com service_role)
CREATE POLICY "System can insert positions"
  ON rastreador_posicoes 
  FOR INSERT
  WITH CHECK (is_funcionario(auth.uid()));

-- =====================================================
-- PARTE 4: ADICIONAR CAMPOS FALTANTES EM RASTREADORES
-- =====================================================

-- Apenas campos que não existem ainda
ALTER TABLE rastreadores 
ADD COLUMN IF NOT EXISTS ultima_velocidade INTEGER DEFAULT 0;

ALTER TABLE rastreadores 
ADD COLUMN IF NOT EXISTS ultima_ignicao BOOLEAN DEFAULT false;

COMMENT ON COLUMN rastreadores.ultima_velocidade IS 'Velocidade na última posição (km/h)';
COMMENT ON COLUMN rastreadores.ultima_ignicao IS 'Estado da ignição na última posição';

-- =====================================================
-- PARTE 5: VIEW CONSOLIDADA (JOINs CORRIGIDOS)
-- =====================================================

CREATE OR REPLACE VIEW view_rastreadores_posicao AS
SELECT 
  -- Dados do rastreador
  r.id AS rastreador_id,
  r.codigo,
  r.plataforma,
  r.id_plataforma,
  r.status,
  r.numero_serie,
  r.imei,
  
  -- Última posição
  r.ultima_comunicacao,
  r.ultima_posicao_lat AS latitude,
  r.ultima_posicao_lng AS longitude,
  r.ultima_velocidade AS velocidade,
  r.ultima_ignicao AS ignicao,
  
  -- Dados do veículo (JOIN CORRIGIDO: rastreador.veiculo_id → veiculos.id)
  v.id AS veiculo_id,
  v.placa,
  v.marca,
  v.modelo,
  v.ano_modelo,
  v.cor,
  
  -- Dados do associado
  a.id AS associado_id,
  a.nome AS associado_nome,
  a.telefone AS associado_telefone,
  a.email AS associado_email,
  
  -- Cálculo de tempo sem comunicação (em horas)
  CASE 
    WHEN r.ultima_comunicacao IS NULL THEN 9999
    ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - r.ultima_comunicacao)) / 3600, 2)
  END AS horas_sem_comunicacao,
  
  -- Status de comunicação
  CASE 
    WHEN r.ultima_comunicacao IS NULL THEN 'sem_dados'
    WHEN r.ultima_comunicacao > NOW() - INTERVAL '1 hour' THEN 'online'
    WHEN r.ultima_comunicacao > NOW() - INTERVAL '24 hours' THEN 'atencao'
    ELSE 'offline'
  END AS status_comunicacao

FROM rastreadores r
LEFT JOIN veiculos v ON r.veiculo_id = v.id
LEFT JOIN associados a ON v.associado_id = a.id
WHERE r.status = 'instalado';

COMMENT ON VIEW view_rastreadores_posicao IS 'Rastreadores instalados com última posição e dados do veículo/associado';

-- =====================================================
-- PARTE 6: FUNÇÃO PARA OBTER ÚLTIMAS POSIÇÕES
-- =====================================================

CREATE OR REPLACE FUNCTION get_ultimas_posicoes()
RETURNS TABLE (
  rastreador_id UUID,
  codigo TEXT,
  placa TEXT,
  associado_nome TEXT,
  associado_telefone TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  velocidade INTEGER,
  ignicao BOOLEAN,
  data_posicao TIMESTAMPTZ,
  horas_sem_comunicacao NUMERIC,
  status_comunicacao TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS rastreador_id,
    r.codigo,
    v.placa,
    a.nome AS associado_nome,
    a.telefone AS associado_telefone,
    r.ultima_posicao_lat AS latitude,
    r.ultima_posicao_lng AS longitude,
    r.ultima_velocidade AS velocidade,
    r.ultima_ignicao AS ignicao,
    r.ultima_comunicacao AS data_posicao,
    CASE 
      WHEN r.ultima_comunicacao IS NULL THEN 9999.0
      ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - r.ultima_comunicacao)) / 3600, 2)
    END AS horas_sem_comunicacao,
    CASE 
      WHEN r.ultima_comunicacao IS NULL THEN 'sem_dados'
      WHEN r.ultima_comunicacao > NOW() - INTERVAL '1 hour' THEN 'online'
      WHEN r.ultima_comunicacao > NOW() - INTERVAL '24 hours' THEN 'atencao'
      ELSE 'offline'
    END AS status_comunicacao
  FROM rastreadores r
  LEFT JOIN veiculos v ON r.veiculo_id = v.id
  LEFT JOIN associados a ON v.associado_id = a.id
  WHERE r.status = 'instalado'
  ORDER BY r.ultima_comunicacao DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION get_ultimas_posicoes IS 'Retorna últimas posições de todos os rastreadores instalados com status de comunicação';

-- =====================================================
-- PARTE 7: FUNÇÃO E TRIGGER PARA ATUALIZAR ÚLTIMA POSIÇÃO
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_ultima_posicao()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar campos de última posição no rastreador
  UPDATE rastreadores
  SET 
    ultima_comunicacao = NEW.data_posicao,
    ultima_posicao_lat = NEW.latitude,
    ultima_posicao_lng = NEW.longitude,
    ultima_velocidade = NEW.velocidade,
    ultima_ignicao = NEW.ignicao
  WHERE id = NEW.rastreador_id;
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar automaticamente
DROP TRIGGER IF EXISTS trg_atualizar_ultima_posicao ON rastreador_posicoes;

CREATE TRIGGER trg_atualizar_ultima_posicao
  AFTER INSERT ON rastreador_posicoes
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_ultima_posicao();