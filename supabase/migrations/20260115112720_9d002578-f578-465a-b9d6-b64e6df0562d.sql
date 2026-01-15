-- Tabela para registrar documentos solicitados ao cliente
CREATE TABLE IF NOT EXISTS public.documentos_solicitados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
  tipo_documento VARCHAR(50) NOT NULL,
  descricao TEXT,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'aprovado', 'reprovado')),
  solicitado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  solicitado_em TIMESTAMPTZ DEFAULT NOW(),
  enviado_em TIMESTAMPTZ,
  documento_id UUID REFERENCES documentos(id) ON DELETE SET NULL,
  observacao_solicitacao TEXT,
  observacao_cliente TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_docs_solicitados_associado ON documentos_solicitados(associado_id);
CREATE INDEX IF NOT EXISTS idx_docs_solicitados_status ON documentos_solicitados(status);
CREATE INDEX IF NOT EXISTS idx_docs_solicitados_contrato ON documentos_solicitados(contrato_id);

-- RLS
ALTER TABLE documentos_solicitados ENABLE ROW LEVEL SECURITY;

-- Funcionários autenticados podem gerenciar
CREATE POLICY "funcionarios_docs_solicitados" ON documentos_solicitados
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Acesso público para leitura (cliente via token)
CREATE POLICY "anon_read_docs_solicitados" ON documentos_solicitados
FOR SELECT TO anon USING (true);

-- Acesso público para atualizar status quando cliente envia
CREATE POLICY "anon_update_docs_solicitados" ON documentos_solicitados
FOR UPDATE TO anon 
USING (true) 
WITH CHECK (true);

-- Storage: Permitir upload anônimo no bucket documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para uploads públicos
CREATE POLICY "anon_upload_documentos" ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "public_read_documentos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'documentos');

CREATE POLICY "auth_manage_documentos" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'documentos')
WITH CHECK (bucket_id = 'documentos');