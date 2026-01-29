-- Criar tabela para armazenar credenciais de integração de forma segura
CREATE TABLE integracoes_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao VARCHAR(50) NOT NULL UNIQUE,
  credenciais_encrypted TEXT NOT NULL,
  iv TEXT NOT NULL,
  configurado BOOLEAN DEFAULT FALSE,
  testado_em TIMESTAMPTZ,
  teste_sucesso BOOLEAN,
  teste_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Índice para busca por integração
CREATE INDEX idx_integracoes_credenciais_integracao ON integracoes_credenciais(integracao);

-- Habilitar RLS
ALTER TABLE integracoes_credenciais ENABLE ROW LEVEL SECURITY;

-- Apenas diretores e desenvolvedores podem gerenciar credenciais
CREATE POLICY "Diretores e desenvolvedores podem gerenciar credenciais" 
ON integracoes_credenciais
FOR ALL TO authenticated
USING (public.is_diretor(auth.uid()) OR public.is_desenvolvedor(auth.uid()))
WITH CHECK (public.is_diretor(auth.uid()) OR public.is_desenvolvedor(auth.uid()));

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_integracoes_credenciais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para updated_at
CREATE TRIGGER trigger_update_integracoes_credenciais_updated_at
BEFORE UPDATE ON integracoes_credenciais
FOR EACH ROW
EXECUTE FUNCTION update_integracoes_credenciais_updated_at();