-- Criar bucket para documentos de contratos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contratos-documentos', 'contratos-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para contratos-documentos
CREATE POLICY "Authenticated users can upload contract documents" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'contratos-documentos');

CREATE POLICY "Authenticated users can view contract documents" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'contratos-documentos');

CREATE POLICY "Authenticated users can update contract documents" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'contratos-documentos');

CREATE POLICY "Authenticated users can delete contract documents" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'contratos-documentos');

-- Tabela para documentos de contratos
CREATE TABLE IF NOT EXISTS public.contratos_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  cotacao_id UUID REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('crlv', 'cnh', 'rg', 'comprovante_residencia')),
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT,
  ocr_resultado JSONB,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'aprovado', 'reprovado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas para dados do cliente no contrato
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS cliente_cpf VARCHAR(20);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(255);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(20);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS cliente_endereco TEXT;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS cliente_cep VARCHAR(10);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS cliente_cidade VARCHAR(100);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS cliente_uf VARCHAR(2);

-- Adicionar colunas para dados do veículo no contrato
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_placa VARCHAR(10);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_marca VARCHAR(100);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_modelo VARCHAR(100);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_ano INTEGER;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_cor VARCHAR(50);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_chassi VARCHAR(50);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_renavam VARCHAR(20);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS veiculo_valor_fipe NUMERIC(12,2);

-- Flag para indicar se documentos estão completos
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS documentos_completos BOOLEAN DEFAULT false;

-- RLS para contratos_documentos
ALTER TABLE public.contratos_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contract documents" 
ON public.contratos_documentos FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert contract documents" 
ON public.contratos_documentos FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update contract documents" 
ON public.contratos_documentos FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete contract documents" 
ON public.contratos_documentos FOR DELETE 
TO authenticated 
USING (true);

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER update_contratos_documentos_updated_at
BEFORE UPDATE ON public.contratos_documentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contratos_documentos_contrato_id ON public.contratos_documentos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_documentos_cotacao_id ON public.contratos_documentos(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_contratos_documentos_tipo ON public.contratos_documentos(tipo);