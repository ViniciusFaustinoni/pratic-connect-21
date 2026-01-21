-- Drop the table if it was partially created
DROP TABLE IF EXISTS public.sinistro_mensagens;

-- Create table for sinistro messages/chat
CREATE TABLE public.sinistro_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sinistro_id UUID NOT NULL REFERENCES sinistros(id) ON DELETE CASCADE,
  remetente_tipo VARCHAR(20) NOT NULL CHECK (remetente_tipo IN ('associado', 'analista', 'sistema')),
  remetente_id UUID REFERENCES profiles(id),
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sinistro_mensagens ENABLE ROW LEVEL SECURITY;

-- Policy: associado can view messages from their own sinistros
CREATE POLICY "Associado ve mensagens do seu sinistro"
ON public.sinistro_mensagens FOR SELECT
USING (
  sinistro_id IN (
    SELECT s.id FROM sinistros s
    JOIN associados a ON s.associado_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- Policy: associado can insert messages
CREATE POLICY "Associado envia mensagens no seu sinistro"
ON public.sinistro_mensagens FOR INSERT
WITH CHECK (
  remetente_tipo = 'associado' AND
  sinistro_id IN (
    SELECT s.id FROM sinistros s
    JOIN associados a ON s.associado_id = a.id
    WHERE a.user_id = auth.uid()
  )
);

-- Policy: funcionarios can view all messages
CREATE POLICY "Funcionario ve todas mensagens"
ON public.sinistro_mensagens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND tipo = 'funcionario'
  )
);

-- Policy: funcionarios can insert messages as analista
CREATE POLICY "Funcionario envia mensagens como analista"
ON public.sinistro_mensagens FOR INSERT
WITH CHECK (
  remetente_tipo IN ('analista', 'sistema') AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND tipo = 'funcionario'
  )
);

-- Policy: mark as read (anyone can update their messages)
CREATE POLICY "Atualizar mensagem"
ON public.sinistro_mensagens FOR UPDATE
USING (true)
WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_sinistro_mensagens_sinistro_id ON public.sinistro_mensagens(sinistro_id);
CREATE INDEX idx_sinistro_mensagens_created_at ON public.sinistro_mensagens(created_at);