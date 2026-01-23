-- Add categoria_profissional to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS categoria_profissional TEXT DEFAULT 'rota' CHECK (categoria_profissional IN ('rota', 'base'));

-- Add local_vistoria to instalacoes
ALTER TABLE instalacoes
ADD COLUMN IF NOT EXISTS local_vistoria TEXT DEFAULT 'cliente' CHECK (local_vistoria IN ('cliente', 'base'));

-- Add local_vistoria to vistorias
ALTER TABLE vistorias
ADD COLUMN IF NOT EXISTS local_vistoria TEXT DEFAULT 'cliente' CHECK (local_vistoria IN ('cliente', 'base'));

-- Create agendamentos_base table
CREATE TABLE IF NOT EXISTS agendamentos_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_agendada DATE NOT NULL,
  horario TIME NOT NULL,
  cotacao_id UUID REFERENCES cotacoes(id),
  instalacao_id UUID REFERENCES instalacoes(id),
  vistoria_id UUID REFERENCES vistorias(id),
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  cliente_email TEXT,
  veiculo_placa TEXT,
  veiculo_descricao TEXT,
  status TEXT DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'em_atendimento', 'realizado', 'cancelado', 'nao_compareceu')),
  observacoes TEXT,
  atendido_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for searching available slots
CREATE INDEX IF NOT EXISTS idx_agendamentos_base_data_horario ON agendamentos_base(data_agendada, horario);
CREATE INDEX IF NOT EXISTS idx_agendamentos_base_status ON agendamentos_base(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_base_cotacao ON agendamentos_base(cotacao_id);

-- Enable RLS
ALTER TABLE agendamentos_base ENABLE ROW LEVEL SECURITY;

-- RLS policies for agendamentos_base
CREATE POLICY "Authenticated users can view agendamentos_base" 
ON agendamentos_base FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert agendamentos_base" 
ON agendamentos_base FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update agendamentos_base" 
ON agendamentos_base FOR UPDATE 
TO authenticated 
USING (true);

-- Anonymous users can insert (for public link flow)
CREATE POLICY "Anon users can insert agendamentos_base" 
ON agendamentos_base FOR INSERT 
TO anon 
WITH CHECK (true);

-- Insert base address configurations
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES
  ('base_cep', '', 'texto', 'empresa', 'CEP da base para vistorias'),
  ('base_logradouro', '', 'texto', 'empresa', 'Logradouro da base'),
  ('base_numero', '', 'texto', 'empresa', 'Número da base'),
  ('base_bairro', '', 'texto', 'empresa', 'Bairro da base'),
  ('base_cidade', '', 'texto', 'empresa', 'Cidade da base'),
  ('base_uf', '', 'texto', 'empresa', 'UF da base'),
  ('base_complemento', '', 'texto', 'empresa', 'Complemento do endereço da base'),
  ('base_horario_inicio', '08:00', 'texto', 'empresa', 'Horário de início de atendimento na base'),
  ('base_horario_fim', '17:30', 'texto', 'empresa', 'Horário de fim de atendimento na base'),
  ('base_capacidade_horario', '2', 'numero', 'empresa', 'Quantidade máxima de agendamentos por horário')
ON CONFLICT (chave) DO NOTHING;

-- Comment on table
COMMENT ON TABLE agendamentos_base IS 'Agendamentos de vistorias na base da Pratic - max 2 por slot de 30 min';