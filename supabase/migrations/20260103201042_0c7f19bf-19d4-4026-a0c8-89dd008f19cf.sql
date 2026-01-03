-- =============================================
-- MÓDULO ASSISTÊNCIA 24H - TABELAS COMPLEMENTARES
-- =============================================

-- 1. PRESTADORES DE SERVIÇO (Guinchos, Chaveiros, etc.)
CREATE TABLE public.prestadores_assistencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(18),
    cpf VARCHAR(14),
    tipo_pessoa VARCHAR(10) DEFAULT 'pj' CHECK (tipo_pessoa IN ('pf', 'pj')),
    
    -- Contato
    telefone VARCHAR(20) NOT NULL,
    whatsapp VARCHAR(20),
    email VARCHAR(255),
    
    -- Endereço base
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    bairro VARCHAR(100),
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL,
    
    -- Área de atuação
    raio_atendimento_km INTEGER DEFAULT 50,
    cidades_atendidas TEXT[] DEFAULT '{}',
    
    -- Tipos de serviço
    tipos_servico TEXT[] DEFAULT '{}',
    
    -- Dados bancários
    banco VARCHAR(100),
    agencia VARCHAR(20),
    conta VARCHAR(30),
    pix_chave VARCHAR(255),
    pix_tipo VARCHAR(20) CHECK (pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
    
    -- Avaliação
    nota_media DECIMAL(3,2) DEFAULT 0,
    total_atendimentos INTEGER DEFAULT 0,
    total_avaliacoes INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'suspenso', 'bloqueado')),
    disponivel BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. HISTÓRICO DE CHAMADOS (Timeline de eventos)
CREATE TABLE public.chamados_assistencia_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chamado_id UUID NOT NULL REFERENCES public.chamados_assistencia(id) ON DELETE CASCADE,
    
    status_anterior VARCHAR(30),
    status_novo VARCHAR(30) NOT NULL,
    usuario_id UUID REFERENCES public.profiles(id),
    observacao TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ATENDIMENTOS (Registro de cada atendimento do prestador)
CREATE TABLE public.chamados_assistencia_atendimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chamado_id UUID NOT NULL REFERENCES public.chamados_assistencia(id) ON DELETE CASCADE,
    prestador_id UUID REFERENCES public.prestadores_assistencia(id),
    
    -- Valores
    valor_servico DECIMAL(10,2),
    valor_km_extra DECIMAL(10,2) DEFAULT 0,
    valor_total DECIMAL(10,2),
    
    -- Tempos
    hora_acionamento TIMESTAMPTZ,
    hora_aceite TIMESTAMPTZ,
    hora_chegada TIMESTAMPTZ,
    hora_conclusao TIMESTAMPTZ,
    
    -- Distâncias
    km_origem_destino DECIMAL(8,2),
    km_extra DECIMAL(8,2),
    
    -- Status do atendimento
    status VARCHAR(20) DEFAULT 'acionado' CHECK (status IN (
        'acionado', 'aceito', 'recusado', 'a_caminho', 
        'no_local', 'em_andamento', 'concluido', 'cancelado'
    )),
    
    motivo_recusa TEXT,
    observacao TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ADICIONAR FK NA TABELA chamados_assistencia
ALTER TABLE public.chamados_assistencia 
ADD COLUMN IF NOT EXISTS prestador_id UUID REFERENCES public.prestadores_assistencia(id);

-- 5. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_prestadores_cidade ON public.prestadores_assistencia(cidade, estado);
CREATE INDEX idx_prestadores_tipos ON public.prestadores_assistencia USING GIN(tipos_servico);
CREATE INDEX idx_chamados_hist_chamado ON public.chamados_assistencia_historico(chamado_id);
CREATE INDEX idx_chamados_atend_chamado ON public.chamados_assistencia_atendimentos(chamado_id);
CREATE INDEX idx_chamados_atend_prestador ON public.chamados_assistencia_atendimentos(prestador_id);

-- 6. TRIGGER PARA REGISTRAR HISTÓRICO AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.fn_chamado_historico()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.chamados_assistencia_historico (
      chamado_id, status_anterior, status_novo
    ) VALUES (
      NEW.id, OLD.status::text, NEW.status::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_chamado_status_change
  AFTER UPDATE ON public.chamados_assistencia
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_chamado_historico();

-- 7. RLS POLICIES

-- prestadores_assistencia
ALTER TABLE public.prestadores_assistencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage prestadores"
  ON public.prestadores_assistencia FOR ALL
  USING (is_funcionario(auth.uid()));

CREATE POLICY "Public can view active prestadores"
  ON public.prestadores_assistencia FOR SELECT
  USING (status = 'ativo');

-- chamados_assistencia_historico
ALTER TABLE public.chamados_assistencia_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Associates can view own chamado history"
  ON public.chamados_assistencia_historico FOR SELECT
  USING (chamado_id IN (
    SELECT id FROM public.chamados_assistencia 
    WHERE associado_id = get_my_associado_id(auth.uid())
  ));

CREATE POLICY "Staff can manage chamado history"
  ON public.chamados_assistencia_historico FOR ALL
  USING (is_funcionario(auth.uid()));

CREATE POLICY "System can insert chamado history"
  ON public.chamados_assistencia_historico FOR INSERT
  WITH CHECK (true);

-- chamados_assistencia_atendimentos
ALTER TABLE public.chamados_assistencia_atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Associates can view own atendimentos"
  ON public.chamados_assistencia_atendimentos FOR SELECT
  USING (chamado_id IN (
    SELECT id FROM public.chamados_assistencia 
    WHERE associado_id = get_my_associado_id(auth.uid())
  ));

CREATE POLICY "Staff can manage atendimentos"
  ON public.chamados_assistencia_atendimentos FOR ALL
  USING (is_funcionario(auth.uid()));