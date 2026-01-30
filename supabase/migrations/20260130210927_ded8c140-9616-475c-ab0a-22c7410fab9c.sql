-- Criar tabela de campanhas de desconto
CREATE TABLE campanhas_desconto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo_beneficio VARCHAR(20) NOT NULL CHECK (tipo_beneficio IN ('percentual', 'valor_fixo')),
  valor_beneficio NUMERIC(10,2) NOT NULL CHECK (valor_beneficio > 0),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  meses_aplicacao INTEGER NOT NULL DEFAULT 1 CHECK (meses_aplicacao >= 1),
  status VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  criado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT data_fim_maior_inicio CHECK (data_fim >= data_inicio)
);

-- Adicionar campos na tabela cotacoes
ALTER TABLE cotacoes 
ADD COLUMN campanha_desconto_id UUID REFERENCES campanhas_desconto(id),
ADD COLUMN valor_mensal_promocional NUMERIC(10,2),
ADD COLUMN meses_desconto_campanha INTEGER;

-- Índices
CREATE INDEX idx_campanhas_desconto_status ON campanhas_desconto(status);
CREATE INDEX idx_campanhas_desconto_vigencia ON campanhas_desconto(data_inicio, data_fim);
CREATE INDEX idx_cotacoes_campanha ON cotacoes(campanha_desconto_id);

-- RLS
ALTER TABLE campanhas_desconto ENABLE ROW LEVEL SECURITY;

-- Política de leitura para todos autenticados
CREATE POLICY "Campanhas visíveis para autenticados" ON campanhas_desconto
  FOR SELECT TO authenticated USING (true);

-- Política de escrita usando função has_role existente
CREATE POLICY "Campanhas gerenciáveis por diretoria" ON campanhas_desconto
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'admin_master') OR
    public.has_role(auth.uid(), 'desenvolvedor')
  );

CREATE POLICY "Campanhas atualizáveis por diretoria" ON campanhas_desconto
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'admin_master') OR
    public.has_role(auth.uid(), 'desenvolvedor')
  );

CREATE POLICY "Campanhas deletáveis por diretoria" ON campanhas_desconto
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'admin_master') OR
    public.has_role(auth.uid(), 'desenvolvedor')
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_campanhas_desconto_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_campanhas_desconto_updated_at
  BEFORE UPDATE ON campanhas_desconto
  FOR EACH ROW
  EXECUTE FUNCTION update_campanhas_desconto_updated_at();