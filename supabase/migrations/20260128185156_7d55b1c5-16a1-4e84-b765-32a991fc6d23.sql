-- =============================================
-- Sistema de Confirmação de Agendamento WhatsApp
-- =============================================

-- Tabela para rastrear confirmações de agendamento
CREATE TABLE IF NOT EXISTS public.confirmacoes_agendamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE,
  instalacao_id UUID REFERENCES public.instalacoes(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviada', 'confirmada', 'reagendando', 'reagendada', 'cancelada', 'nao_respondeu')),
  mensagem_enviada_em TIMESTAMPTZ,
  resposta_recebida_em TIMESTAMPTZ,
  resposta_cliente TEXT,
  contexto_ia JSONB DEFAULT '{}',
  novo_servico_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_confirmacoes_agendamento_servico ON public.confirmacoes_agendamento(servico_id);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_agendamento_telefone ON public.confirmacoes_agendamento(telefone);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_agendamento_status ON public.confirmacoes_agendamento(status);

-- Habilitar RLS
ALTER TABLE public.confirmacoes_agendamento ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Funcionários podem ver e editar
CREATE POLICY "Funcionarios podem gerenciar confirmacoes" 
ON public.confirmacoes_agendamento 
FOR ALL 
USING (public.am_i_funcionario());

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.confirmacoes_agendamento;

-- Adicionar colunas na tabela servicos para confirmação WhatsApp
ALTER TABLE public.servicos 
ADD COLUMN IF NOT EXISTS confirmacao_whatsapp TEXT CHECK (confirmacao_whatsapp IN ('pendente', 'enviada', 'confirmada', 'reagendado', 'nao_respondeu')),
ADD COLUMN IF NOT EXISTS confirmado_via_whatsapp_em TIMESTAMPTZ;

-- Comentários
COMMENT ON TABLE public.confirmacoes_agendamento IS 'Rastreamento de confirmações de agendamento via WhatsApp';
COMMENT ON COLUMN public.confirmacoes_agendamento.contexto_ia IS 'Contexto da conversa de reagendamento com IA';
COMMENT ON COLUMN public.servicos.confirmacao_whatsapp IS 'Status da confirmação via WhatsApp: pendente, enviada, confirmada, reagendado, nao_respondeu';