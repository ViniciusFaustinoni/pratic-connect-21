-- Tabela para armazenar mensagens do chat com IA
CREATE TABLE public.chat_mensagens_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar mensagens por associado
CREATE INDEX idx_chat_mensagens_ia_associado ON public.chat_mensagens_ia(associado_id, created_at DESC);

-- Habilitar RLS
ALTER TABLE public.chat_mensagens_ia ENABLE ROW LEVEL SECURITY;

-- Política: Associados podem ver suas próprias mensagens
CREATE POLICY "Associados podem ver suas mensagens"
ON public.chat_mensagens_ia FOR SELECT TO authenticated
USING (associado_id IN (SELECT id FROM associados WHERE user_id = auth.uid()));

-- Política: Associados podem criar mensagens
CREATE POLICY "Associados podem criar mensagens"
ON public.chat_mensagens_ia FOR INSERT TO authenticated
WITH CHECK (associado_id IN (SELECT id FROM associados WHERE user_id = auth.uid()));

-- Tabela para armazenar solicitações geradas pela IA (pendentes de aprovação)
CREATE TABLE public.chat_solicitacoes_ia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('sinistro', 'assistencia')),
    dados JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'executado')),
    aprovador_id UUID REFERENCES public.profiles(id),
    aprovado_em TIMESTAMPTZ,
    motivo_rejeicao TEXT,
    resultado_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_chat_solicitacoes_ia_associado ON public.chat_solicitacoes_ia(associado_id);
CREATE INDEX idx_chat_solicitacoes_ia_status ON public.chat_solicitacoes_ia(status);

-- Habilitar RLS
ALTER TABLE public.chat_solicitacoes_ia ENABLE ROW LEVEL SECURITY;

-- Política: Associados podem ver suas próprias solicitações
CREATE POLICY "Associados podem ver suas solicitacoes"
ON public.chat_solicitacoes_ia FOR SELECT TO authenticated
USING (associado_id IN (SELECT id FROM associados WHERE user_id = auth.uid()));

-- Política: Diretores podem ver todas as solicitações
CREATE POLICY "Diretores podem ver todas solicitacoes"
ON public.chat_solicitacoes_ia FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretor'));

-- Política: Diretores podem atualizar solicitações
CREATE POLICY "Diretores podem atualizar solicitacoes"
ON public.chat_solicitacoes_ia FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'diretor'));

-- Trigger para updated_at
CREATE TRIGGER update_chat_solicitacoes_ia_updated_at
BEFORE UPDATE ON public.chat_solicitacoes_ia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();