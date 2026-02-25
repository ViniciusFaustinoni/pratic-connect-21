
-- =====================================================
-- FASE 1: Módulo de Cobertura de Terceiros
-- =====================================================

-- 1.1 Tabela sinistro_terceiros
CREATE TABLE public.sinistro_terceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id uuid NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  numero_sequencial integer NOT NULL DEFAULT 1,
  -- Dados pessoais
  nome text NOT NULL,
  cpf text NOT NULL,
  telefone text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  -- Dados do veículo
  veiculo_placa text NOT NULL,
  veiculo_marca text NOT NULL,
  veiculo_modelo text NOT NULL,
  veiculo_ano text NOT NULL,
  veiculo_cor text NOT NULL,
  veiculo_fipe numeric,
  -- Culpa e relação
  culpa text NOT NULL DEFAULT 'a_definir', -- associado_culpado, terceiro_culpado, compartilhada, a_definir
  parentesco boolean NOT NULL DEFAULT false,
  parentesco_descricao text,
  tipo_dano text NOT NULL DEFAULT 'veiculo', -- veiculo, nao_veicular
  observacoes text,
  -- Token para portal público
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  -- Status do fluxo
  status text NOT NULL DEFAULT 'cadastrado',
  -- Oficina
  oficina_tipo text, -- credenciada, propria
  oficina_nome text,
  oficina_endereco text,
  oficina_telefone text,
  -- Orçamento
  orcamento_valor numeric,
  -- Acordo
  acordo_valor numeric,
  acordo_justificativa text,
  acordo_status text, -- proposto, aceito, recusado
  acordo_respondido_em timestamptz,
  -- Termo de anuência
  termo_assinado_em timestamptz,
  termo_assinatura_ip text,
  termo_assinatura_nome text,
  -- Marcos temporais
  documentos_aprovados_em timestamptz,
  reparo_concluido_em timestamptz,
  entrega_em timestamptz,
  -- Auditoria
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_sinistro_terceiros_sinistro ON public.sinistro_terceiros(sinistro_id);
CREATE INDEX idx_sinistro_terceiros_token ON public.sinistro_terceiros(token);
CREATE INDEX idx_sinistro_terceiros_status ON public.sinistro_terceiros(status);

-- Trigger updated_at
CREATE TRIGGER update_sinistro_terceiros_updated_at
  BEFORE UPDATE ON public.sinistro_terceiros
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 1.2 Tabela sinistro_terceiro_documentos
CREATE TABLE public.sinistro_terceiro_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terceiro_id uuid NOT NULL REFERENCES public.sinistro_terceiros(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- cnh, crlv, bo, foto_dano, video, orcamento_1, orcamento_2, orcamento_3
  nome text NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pendente', -- pendente, aprovado, rejeitado
  motivo_rejeicao text,
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sinistro_terceiro_docs_terceiro ON public.sinistro_terceiro_documentos(terceiro_id);

-- 1.3 Novas colunas na tabela planos
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS limite_terceiros numeric,
  ADD COLUMN IF NOT EXISTS cota_terceiros numeric,
  ADD COLUMN IF NOT EXISTS cota_terceiros_isento boolean NOT NULL DEFAULT false;

-- 1.4 Nova coluna na tabela sinistros
ALTER TABLE public.sinistros
  ADD COLUMN IF NOT EXISTS tem_terceiro boolean NOT NULL DEFAULT false;

-- 1.5 Bucket de storage
INSERT INTO storage.buckets (id, name, public)
  VALUES ('sinistro-terceiros', 'sinistro-terceiros', true)
  ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- RLS: sinistro_terceiros
-- =====================================================
ALTER TABLE public.sinistro_terceiros ENABLE ROW LEVEL SECURITY;

-- Staff (funcionários) podem gerenciar tudo
CREATE POLICY "Staff gerencia terceiros"
  ON public.sinistro_terceiros
  FOR ALL
  TO authenticated
  USING (is_funcionario(auth.uid()))
  WITH CHECK (is_funcionario(auth.uid()));

-- Acesso público via token (para portal do terceiro)
CREATE POLICY "Acesso público por token terceiro"
  ON public.sinistro_terceiros
  FOR SELECT
  TO anon
  USING (token IS NOT NULL);

-- =====================================================
-- RLS: sinistro_terceiro_documentos
-- =====================================================
ALTER TABLE public.sinistro_terceiro_documentos ENABLE ROW LEVEL SECURITY;

-- Staff pode gerenciar documentos
CREATE POLICY "Staff gerencia docs terceiro"
  ON public.sinistro_terceiro_documentos
  FOR ALL
  TO authenticated
  USING (is_funcionario(auth.uid()))
  WITH CHECK (is_funcionario(auth.uid()));

-- Anon pode ler docs vinculados a um terceiro com token válido
CREATE POLICY "Anon lê docs por token"
  ON public.sinistro_terceiro_documentos
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.sinistro_terceiros st
      WHERE st.id = terceiro_id
      AND st.token IS NOT NULL
    )
  );

-- Anon pode inserir docs (upload pelo portal)
CREATE POLICY "Anon insere docs terceiro"
  ON public.sinistro_terceiro_documentos
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sinistro_terceiros st
      WHERE st.id = terceiro_id
      AND st.token IS NOT NULL
    )
  );

-- =====================================================
-- Storage RLS: sinistro-terceiros
-- =====================================================

-- Qualquer um pode ler (bucket público)
CREATE POLICY "Leitura pública sinistro-terceiros"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'sinistro-terceiros');

-- Anon pode fazer upload
CREATE POLICY "Upload anon sinistro-terceiros"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'sinistro-terceiros'
    AND (LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'mov', 'avi'))
  );

-- Staff pode fazer upload e deletar
CREATE POLICY "Staff gerencia storage sinistro-terceiros"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'sinistro-terceiros')
  WITH CHECK (bucket_id = 'sinistro-terceiros');
