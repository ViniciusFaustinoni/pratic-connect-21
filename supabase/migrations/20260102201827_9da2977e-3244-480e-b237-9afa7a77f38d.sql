-- =============================================
-- SGA PRATIC 2.0 - Estrutura Completa Fase 1
-- =============================================

-- 1. ENUMS
-- =============================================

-- Enum para perfis de acesso
CREATE TYPE public.app_role AS ENUM (
  'diretor',
  'gerente_comercial',
  'supervisor_vendas',
  'vendedor_clt',
  'vendedor_externo',
  'analista_cadastro',
  'coordenador_monitoramento',
  'analista_plataforma',
  'instalador_vistoriador',
  'associado'
);

-- Enum para tipo de usuário
CREATE TYPE public.tipo_usuario AS ENUM ('funcionario', 'associado', 'prestador');

-- Enum para etapas do funil de leads
CREATE TYPE public.etapa_lead AS ENUM (
  'novo',
  'contato_inicial',
  'apresentacao',
  'cotacao_enviada',
  'negociacao',
  'ganho',
  'perdido'
);

-- Enum para origem do lead
CREATE TYPE public.origem_lead AS ENUM (
  'indicacao',
  'site',
  'facebook',
  'instagram',
  'google',
  'telefone',
  'presencial',
  'parceiro',
  'outro'
);

-- Enum para status de associado
CREATE TYPE public.status_associado AS ENUM (
  'em_analise',
  'documentacao_pendente',
  'aguardando_instalacao',
  'ativo',
  'inadimplente',
  'suspenso',
  'cancelado'
);

-- Enum para status de documento
CREATE TYPE public.status_documento AS ENUM (
  'pendente',
  'em_analise',
  'aprovado',
  'reprovado'
);

-- Enum para tipo de documento
CREATE TYPE public.tipo_documento AS ENUM (
  'cnh',
  'crlv',
  'comprovante_residencia',
  'foto_frontal_veiculo',
  'foto_traseira_veiculo',
  'foto_lateral_esquerda',
  'foto_lateral_direita',
  'foto_painel',
  'foto_hodometro',
  'outro'
);

-- Enum para status de cotação
CREATE TYPE public.status_cotacao AS ENUM (
  'rascunho',
  'enviada',
  'aceita',
  'recusada',
  'expirada'
);

-- Enum para status de contrato
CREATE TYPE public.status_contrato AS ENUM (
  'pendente',
  'ativo',
  'suspenso',
  'cancelado'
);

-- =============================================
-- 2. TABELAS CORE
-- =============================================

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cpf TEXT,
  tipo tipo_usuario NOT NULL DEFAULT 'funcionario',
  ativo BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de roles (separada conforme instrução de segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- =============================================
-- 3. TABELAS COMERCIAL
-- =============================================

-- Planos de proteção
CREATE TABLE public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo_uso TEXT NOT NULL DEFAULT 'passeio',
  fipe_minima NUMERIC(12,2) DEFAULT 0,
  fipe_maxima NUMERIC(12,2) DEFAULT 999999999,
  valor_adesao NUMERIC(10,2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de preços por faixa FIPE
CREATE TABLE public.tabelas_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES public.planos(id) ON DELETE CASCADE NOT NULL,
  fipe_de NUMERIC(12,2) NOT NULL,
  fipe_ate NUMERIC(12,2) NOT NULL,
  valor_cota NUMERIC(10,2) NOT NULL,
  taxa_administrativa NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_rastreamento NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads (prospects)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  
  -- Dados do veículo
  veiculo_marca TEXT,
  veiculo_modelo TEXT,
  veiculo_ano INTEGER,
  veiculo_placa TEXT,
  veiculo_fipe NUMERIC(12,2),
  
  -- Controle
  origem origem_lead NOT NULL DEFAULT 'telefone',
  etapa etapa_lead NOT NULL DEFAULT 'novo',
  vendedor_id UUID REFERENCES auth.users(id),
  
  -- Observações
  observacoes TEXT,
  motivo_perda TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cotações
CREATE TABLE public.cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  plano_id UUID REFERENCES public.planos(id) NOT NULL,
  
  -- Valores
  valor_fipe NUMERIC(12,2) NOT NULL,
  valor_cota NUMERIC(10,2) NOT NULL,
  taxa_administrativa NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_rastreamento NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_adesao NUMERIC(10,2) NOT NULL,
  valor_total_mensal NUMERIC(10,2) NOT NULL,
  
  -- Status
  status status_cotacao NOT NULL DEFAULT 'rascunho',
  validade_dias INTEGER NOT NULL DEFAULT 7,
  
  vendedor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contratos
CREATE TABLE public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  cotacao_id UUID REFERENCES public.cotacoes(id),
  plano_id UUID REFERENCES public.planos(id) NOT NULL,
  associado_id UUID,
  
  -- Valores
  valor_adesao NUMERIC(10,2) NOT NULL,
  valor_mensal NUMERIC(10,2) NOT NULL,
  
  -- Datas
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  
  -- Status
  status status_contrato NOT NULL DEFAULT 'pendente',
  
  vendedor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 4. TABELAS ASSOCIADOS
-- =============================================

-- Associados
CREATE TABLE public.associados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id),
  
  -- Dados pessoais
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  rg TEXT,
  data_nascimento DATE,
  sexo TEXT,
  estado_civil TEXT,
  profissao TEXT,
  
  -- Contato
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  telefone_secundario TEXT,
  
  -- Endereço
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  
  -- Controle
  status status_associado NOT NULL DEFAULT 'em_analise',
  plano_id UUID REFERENCES public.planos(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar FK no contrato
ALTER TABLE public.contratos 
ADD CONSTRAINT fk_contratos_associado 
FOREIGN KEY (associado_id) REFERENCES public.associados(id);

-- Veículos
CREATE TABLE public.veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID REFERENCES public.associados(id) ON DELETE CASCADE NOT NULL,
  
  -- Dados do veículo
  placa TEXT NOT NULL,
  chassi TEXT,
  renavam TEXT,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  ano_fabricacao INTEGER NOT NULL,
  ano_modelo INTEGER NOT NULL,
  cor TEXT,
  combustivel TEXT,
  
  -- Valores
  valor_fipe NUMERIC(12,2),
  codigo_fipe TEXT,
  
  -- Status
  ativo BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documentos
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id UUID REFERENCES public.associados(id) ON DELETE CASCADE NOT NULL,
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE CASCADE,
  
  tipo tipo_documento NOT NULL,
  nome_arquivo TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  tamanho_bytes INTEGER,
  
  -- Análise
  status status_documento NOT NULL DEFAULT 'pendente',
  analista_id UUID REFERENCES auth.users(id),
  data_analise TIMESTAMPTZ,
  motivo_reprovacao TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 5. TABELA DE NOTIFICAÇÕES
-- =============================================

CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info',
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 6. FUNÇÕES HELPER (SECURITY DEFINER)
-- =============================================

-- Função para verificar se usuário tem um role específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para obter o tipo do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_tipo(_user_id UUID)
RETURNS tipo_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tipo
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Função para verificar se é funcionário
CREATE OR REPLACE FUNCTION public.is_funcionario(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND tipo = 'funcionario'
  )
$$;

-- Função para verificar se é associado
CREATE OR REPLACE FUNCTION public.is_associado(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND tipo = 'associado'
  )
$$;

-- Função para obter ID do associado do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_associado_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.associados
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Função para verificar se é diretor ou gerente
CREATE OR REPLACE FUNCTION public.is_gerencia(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('diretor', 'gerente_comercial')
  )
$$;

-- Função para verificar se é vendedor
CREATE OR REPLACE FUNCTION public.is_vendedor(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('vendedor_clt', 'vendedor_externo', 'supervisor_vendas')
  )
$$;

-- =============================================
-- 7. TRIGGERS
-- =============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cotacoes_updated_at
  BEFORE UPDATE ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_associados_updated_at
  BEFORE UPDATE ON public.associados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_veiculos_updated_at
  BEFORE UPDATE ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar profile automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'tipo')::tipo_usuario, 'funcionario')
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar profile ao criar usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para gerar número de cotação
CREATE OR REPLACE FUNCTION public.generate_cotacao_numero()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero := 'COT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('cotacao_seq')::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE SEQUENCE IF NOT EXISTS cotacao_seq START 1;

CREATE TRIGGER set_cotacao_numero
  BEFORE INSERT ON public.cotacoes
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION public.generate_cotacao_numero();

-- Função para gerar número de contrato
CREATE OR REPLACE FUNCTION public.generate_contrato_numero()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero := 'CTR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('contrato_seq')::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE SEQUENCE IF NOT EXISTS contrato_seq START 1;

CREATE TRIGGER set_contrato_numero
  BEFORE INSERT ON public.contratos
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION public.generate_contrato_numero();

-- =============================================
-- 8. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabelas_preco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.associados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- PROFILES: Usuário vê seu próprio, funcionários veem todos
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_funcionario(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- USER_ROLES: Apenas gerência pode ver e gerenciar
CREATE POLICY "Staff can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_funcionario(auth.uid()));

CREATE POLICY "Management can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()));

-- PLANOS: Todos autenticados podem ver, gerência pode editar
CREATE POLICY "Anyone can view active plans"
  ON public.planos FOR SELECT
  TO authenticated
  USING (ativo = true OR public.is_funcionario(auth.uid()));

CREATE POLICY "Management can manage plans"
  ON public.planos FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()));

-- TABELAS_PRECO: Mesmo que planos
CREATE POLICY "Anyone can view price tables"
  ON public.tabelas_preco FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Management can manage price tables"
  ON public.tabelas_preco FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()));

-- LEADS: Vendedores veem seus leads, gerência vê todos
CREATE POLICY "Sales can view own leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    vendedor_id = auth.uid() 
    OR public.is_gerencia(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor_vendas')
  );

CREATE POLICY "Sales can insert leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_vendedor(auth.uid()) 
    OR public.is_gerencia(auth.uid())
  );

CREATE POLICY "Sales can update own leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    vendedor_id = auth.uid() 
    OR public.is_gerencia(auth.uid())
  );

-- COTACOES: Mesmo padrão de leads
CREATE POLICY "Sales can view own quotes"
  ON public.cotacoes FOR SELECT
  TO authenticated
  USING (
    vendedor_id = auth.uid() 
    OR public.is_gerencia(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor_vendas')
  );

CREATE POLICY "Sales can insert quotes"
  ON public.cotacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_vendedor(auth.uid()) 
    OR public.is_gerencia(auth.uid())
  );

CREATE POLICY "Sales can update own quotes"
  ON public.cotacoes FOR UPDATE
  TO authenticated
  USING (
    vendedor_id = auth.uid() 
    OR public.is_gerencia(auth.uid())
  );

-- CONTRATOS: Funcionários podem ver, gerência gerencia
CREATE POLICY "Staff can view contracts"
  ON public.contratos FOR SELECT
  TO authenticated
  USING (public.is_funcionario(auth.uid()));

CREATE POLICY "Management can manage contracts"
  ON public.contratos FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()));

-- ASSOCIADOS: Funcionários veem todos, associado vê só o seu
CREATE POLICY "Staff can view all associates"
  ON public.associados FOR SELECT
  TO authenticated
  USING (
    public.is_funcionario(auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Staff can manage associates"
  ON public.associados FOR ALL
  TO authenticated
  USING (
    public.is_funcionario(auth.uid())
  );

-- VEICULOS: Funcionários veem todos, associado vê os seus
CREATE POLICY "View vehicles"
  ON public.veiculos FOR SELECT
  TO authenticated
  USING (
    public.is_funcionario(auth.uid())
    OR associado_id = public.get_my_associado_id(auth.uid())
  );

CREATE POLICY "Staff can manage vehicles"
  ON public.veiculos FOR ALL
  TO authenticated
  USING (public.is_funcionario(auth.uid()));

-- DOCUMENTOS: Funcionários veem todos, associado vê os seus
CREATE POLICY "View documents"
  ON public.documentos FOR SELECT
  TO authenticated
  USING (
    public.is_funcionario(auth.uid())
    OR associado_id = public.get_my_associado_id(auth.uid())
  );

CREATE POLICY "Staff can manage documents"
  ON public.documentos FOR ALL
  TO authenticated
  USING (public.is_funcionario(auth.uid()));

CREATE POLICY "Associates can upload documents"
  ON public.documentos FOR INSERT
  TO authenticated
  WITH CHECK (
    associado_id = public.get_my_associado_id(auth.uid())
    OR public.is_funcionario(auth.uid())
  );

-- NOTIFICACOES: Usuário vê suas próprias
CREATE POLICY "Users can view own notifications"
  ON public.notificacoes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notificacoes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notificacoes FOR INSERT
  TO authenticated
  WITH CHECK (true);