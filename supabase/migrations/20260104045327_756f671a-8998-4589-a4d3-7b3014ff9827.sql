-- =============================================
-- TABELA PREÇOS - Histórico de preços por plano
-- =============================================

CREATE TABLE public.tabela_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES public.planos(id) ON DELETE CASCADE NOT NULL,
  faixa_valor_min NUMERIC(14,2) NOT NULL,
  faixa_valor_max NUMERIC(14,2) NOT NULL,
  valor_mensalidade NUMERIC(14,2) NOT NULL,
  valor_adesao NUMERIC(14,2) DEFAULT 0,
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tabela_precos ENABLE ROW LEVEL SECURITY;

-- Funcionários podem visualizar
CREATE POLICY "tabela_precos_select_funcionario" ON public.tabela_precos
FOR SELECT USING (is_funcionario(auth.uid()));

-- Gerência pode gerenciar
CREATE POLICY "tabela_precos_all_gerencia" ON public.tabela_precos
FOR ALL USING (is_gerencia(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_tabela_precos_updated_at
  BEFORE UPDATE ON public.tabela_precos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- NOTIFICAÇÕES SISTEMA - Broadcast notifications
-- =============================================

CREATE TABLE public.notificacoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT NOT NULL,
  tipo VARCHAR(50) DEFAULT 'info', -- info, alerta, urgente
  destino VARCHAR(50) NOT NULL, -- todos, perfil, usuario
  destino_id UUID, -- user_id se destino = 'usuario'
  destino_role public.app_role, -- role específico se destino = 'perfil'
  link VARCHAR(500),
  ativo BOOLEAN DEFAULT true,
  expira_em TIMESTAMPTZ,
  criado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notificacoes_sistema ENABLE ROW LEVEL SECURITY;

-- Usuários veem notificações destinadas a eles
CREATE POLICY "notificacoes_sistema_select" ON public.notificacoes_sistema
FOR SELECT USING (
  ativo = true AND (
    expira_em IS NULL OR expira_em > now()
  ) AND (
    destino = 'todos'
    OR (destino = 'usuario' AND destino_id = auth.uid())
    OR (destino = 'perfil' AND destino_role IN (
      SELECT role FROM public.user_roles WHERE user_id = auth.uid()
    ))
  )
);

-- Gerência pode criar e gerenciar
CREATE POLICY "notificacoes_sistema_all_gerencia" ON public.notificacoes_sistema
FOR ALL USING (is_gerencia(auth.uid()));