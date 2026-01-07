-- Tabela para credenciais de acesso às plataformas de rastreamento
CREATE TABLE rastreadores_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma_id UUID REFERENCES rastreadores_config_plataformas(id) NOT NULL UNIQUE,
  
  -- Credenciais Softruck
  public_key TEXT,
  username TEXT,
  password_hash TEXT,
  
  -- Credenciais Rede Veículos
  bearer_token TEXT,
  
  -- Status
  configurado BOOLEAN DEFAULT FALSE,
  testado_em TIMESTAMPTZ,
  teste_sucesso BOOLEAN,
  teste_mensagem TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentário
COMMENT ON TABLE rastreadores_credenciais IS 'Armazena credenciais de acesso às APIs de rastreamento';

-- RLS: apenas diretores podem gerenciar
ALTER TABLE rastreadores_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretores gerenciam credenciais" ON rastreadores_credenciais
  FOR ALL USING (public.has_role(auth.uid(), 'diretor'));

-- Trigger para updated_at
CREATE TRIGGER update_rastreadores_credenciais_updated_at
  BEFORE UPDATE ON rastreadores_credenciais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir registros vazios para cada plataforma existente
INSERT INTO rastreadores_credenciais (plataforma_id, configurado)
SELECT id, FALSE FROM rastreadores_config_plataformas
ON CONFLICT (plataforma_id) DO NOTHING;