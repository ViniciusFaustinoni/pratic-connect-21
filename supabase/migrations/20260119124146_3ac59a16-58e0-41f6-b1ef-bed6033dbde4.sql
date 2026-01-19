-- Tabela de relacionamento N:N entre rotas e instaladores
CREATE TABLE public.rota_instaladores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID REFERENCES rotas(id) ON DELETE CASCADE NOT NULL,
  instalador_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rota_id, instalador_id)
);

-- Enable RLS
ALTER TABLE public.rota_instaladores ENABLE ROW LEVEL SECURITY;

-- Policies para rota_instaladores
CREATE POLICY "Usuários autenticados podem ver rota_instaladores"
ON public.rota_instaladores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir rota_instaladores"
ON public.rota_instaladores
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar rota_instaladores"
ON public.rota_instaladores
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem deletar rota_instaladores"
ON public.rota_instaladores
FOR DELETE
TO authenticated
USING (true);

-- Adicionar campo instalador_responsavel_id em instalacoes se não existir
-- Este campo indica qual instalador específico é responsável pela instalação dentro de uma rota compartilhada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'instalacoes' 
    AND column_name = 'instalador_responsavel_id'
  ) THEN
    ALTER TABLE public.instalacoes 
    ADD COLUMN instalador_responsavel_id UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Comentários para documentação
COMMENT ON TABLE public.rota_instaladores IS 'Relacionamento N:N entre rotas e instaladores para rotas compartilhadas';
COMMENT ON COLUMN public.rota_instaladores.rota_id IS 'ID da rota';
COMMENT ON COLUMN public.rota_instaladores.instalador_id IS 'ID do instalador atribuído à rota';