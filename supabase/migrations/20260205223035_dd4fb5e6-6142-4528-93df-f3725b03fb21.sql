-- ============================================
-- TABELA: blacklist_veiculos
-- Armazena veículos reprovados que não podem 
-- ser associados novamente
-- ============================================

-- Criar tipo enum para tipo de reprovação
DO $$ BEGIN
  CREATE TYPE tipo_reprovacao AS ENUM ('vistoria_reprovada', 'proposta_reprovada');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar tabela blacklist_veiculos
CREATE TABLE IF NOT EXISTS public.blacklist_veiculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placa TEXT NOT NULL,
  chassi TEXT,
  motivo TEXT NOT NULL,
  justificativa TEXT,
  tipo_reprovacao tipo_reprovacao NOT NULL,
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
  associado_id UUID REFERENCES public.associados(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  cotacao_id UUID,
  adicionado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  removido_em TIMESTAMP WITH TIME ZONE,
  removido_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_blacklist_veiculos_placa ON public.blacklist_veiculos(placa);
CREATE INDEX IF NOT EXISTS idx_blacklist_veiculos_ativo ON public.blacklist_veiculos(ativo);
CREATE INDEX IF NOT EXISTS idx_blacklist_veiculos_placa_ativo ON public.blacklist_veiculos(placa, ativo);

-- Habilitar RLS
ALTER TABLE public.blacklist_veiculos ENABLE ROW LEVEL SECURITY;

-- Policy: Funcionários podem visualizar
CREATE POLICY "Funcionários podem visualizar blacklist"
  ON public.blacklist_veiculos
  FOR SELECT
  USING (public.is_funcionario(auth.uid()));

-- Policy: Diretor/Desenvolvedor pode inserir
CREATE POLICY "Diretor pode inserir na blacklist"
  ON public.blacklist_veiculos
  FOR INSERT
  WITH CHECK (
    public.is_diretor(auth.uid()) OR 
    public.is_desenvolvedor(auth.uid()) OR
    public.is_gerencia(auth.uid())
  );

-- Policy: Diretor/Desenvolvedor pode atualizar (para remover da blacklist)
CREATE POLICY "Diretor pode atualizar blacklist"
  ON public.blacklist_veiculos
  FOR UPDATE
  USING (
    public.is_diretor(auth.uid()) OR 
    public.is_desenvolvedor(auth.uid())
  );

-- Comentário na tabela
COMMENT ON TABLE public.blacklist_veiculos IS 'Veículos reprovados em vistoria ou proposta que não podem ser associados novamente';