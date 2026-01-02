-- =====================================================
-- ENUMS para novos status
-- =====================================================

CREATE TYPE status_rastreador AS ENUM ('estoque', 'instalado', 'manutencao', 'baixado');
CREATE TYPE status_rota AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE status_instalacao AS ENUM ('agendada', 'em_rota', 'em_andamento', 'concluida', 'reagendada', 'cancelada');
CREATE TYPE status_vistoria AS ENUM ('pendente', 'aprovada', 'reprovada', 'em_analise');
CREATE TYPE status_chamado AS ENUM ('aberto', 'em_atendimento', 'em_deslocamento', 'concluido', 'cancelado');
CREATE TYPE status_sinistro AS ENUM ('em_analise', 'aprovado', 'reprovado', 'indenizado', 'cancelado');
CREATE TYPE tipo_vistoria AS ENUM ('entrada', 'saida', 'sinistro');
CREATE TYPE tipo_sinistro AS ENUM ('roubo', 'furto', 'colisao', 'incendio', 'alagamento', 'outro');
CREATE TYPE periodo_instalacao AS ENUM ('manha', 'tarde', 'noite');

-- =====================================================
-- Tabela: rastreadores
-- =====================================================

CREATE TABLE public.rastreadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT NOT NULL UNIQUE,
    numero_serie TEXT UNIQUE,
    imei TEXT UNIQUE,
    chip_iccid TEXT,
    plataforma TEXT NOT NULL DEFAULT 'rede_veiculos',
    id_plataforma TEXT,
    status status_rastreador NOT NULL DEFAULT 'estoque',
    veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
    ultima_comunicacao TIMESTAMPTZ,
    ultima_posicao_lat DECIMAL(10,8),
    ultima_posicao_lng DECIMAL(11,8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rastreadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage trackers"
ON public.rastreadores FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view their vehicle tracker"
ON public.rastreadores FOR SELECT
USING (
    veiculo_id IN (
        SELECT v.id FROM public.veiculos v 
        WHERE v.associado_id = get_my_associado_id(auth.uid())
    )
);

CREATE TRIGGER update_rastreadores_updated_at
BEFORE UPDATE ON public.rastreadores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Tabela: rotas
-- =====================================================

CREATE TABLE public.rotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT NOT NULL UNIQUE,
    data_rota DATE NOT NULL,
    instalador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    coordenador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    regiao TEXT,
    cidade TEXT,
    status status_rota NOT NULL DEFAULT 'pendente',
    total_servicos INTEGER NOT NULL DEFAULT 0,
    total_concluidos INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage routes"
ON public.rotas FOR ALL
USING (is_funcionario(auth.uid()));

CREATE TRIGGER update_rotas_updated_at
BEFORE UPDATE ON public.rotas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence para código de rota
CREATE SEQUENCE IF NOT EXISTS rota_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_rota_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.codigo := 'ROT-' || TO_CHAR(NEW.data_rota, 'YYYYMMDD') || '-' || LPAD(nextval('rota_seq')::text, 3, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_rota_codigo_trigger
BEFORE INSERT ON public.rotas
FOR EACH ROW EXECUTE FUNCTION public.generate_rota_codigo();

-- =====================================================
-- Tabela: instalacoes
-- =====================================================

CREATE TABLE public.instalacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
    veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
    rastreador_id UUID REFERENCES public.rastreadores(id) ON DELETE SET NULL,
    rota_id UUID REFERENCES public.rotas(id) ON DELETE SET NULL,
    instalador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    data_agendada DATE NOT NULL,
    periodo periodo_instalacao NOT NULL DEFAULT 'manha',
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    status status_instalacao NOT NULL DEFAULT 'agendada',
    observacoes TEXT,
    assinatura_cliente_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instalacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage installations"
ON public.instalacoes FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own installations"
ON public.instalacoes FOR SELECT
USING (associado_id = get_my_associado_id(auth.uid()));

CREATE TRIGGER update_instalacoes_updated_at
BEFORE UPDATE ON public.instalacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Tabela: instalacao_fotos
-- =====================================================

CREATE TABLE public.instalacao_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instalacao_id UUID NOT NULL REFERENCES public.instalacoes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    arquivo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instalacao_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage installation photos"
ON public.instalacao_fotos FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own installation photos"
ON public.instalacao_fotos FOR SELECT
USING (
    instalacao_id IN (
        SELECT i.id FROM public.instalacoes i 
        WHERE i.associado_id = get_my_associado_id(auth.uid())
    )
);

-- =====================================================
-- Tabela: vistorias
-- =====================================================

CREATE TABLE public.vistorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
    veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
    instalacao_id UUID REFERENCES public.instalacoes(id) ON DELETE SET NULL,
    vistoriador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tipo tipo_vistoria NOT NULL DEFAULT 'entrada',
    km_atual INTEGER,
    avarias TEXT,
    status status_vistoria NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage inspections"
ON public.vistorias FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own inspections"
ON public.vistorias FOR SELECT
USING (associado_id = get_my_associado_id(auth.uid()));

CREATE TRIGGER update_vistorias_updated_at
BEFORE UPDATE ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Tabela: vistoria_fotos
-- =====================================================

CREATE TABLE public.vistoria_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vistoria_id UUID NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    arquivo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vistoria_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage inspection photos"
ON public.vistoria_fotos FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own inspection photos"
ON public.vistoria_fotos FOR SELECT
USING (
    vistoria_id IN (
        SELECT v.id FROM public.vistorias v 
        WHERE v.associado_id = get_my_associado_id(auth.uid())
    )
);

-- =====================================================
-- Tabela: chamados_assistencia
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS chamado_seq START 1;

CREATE TABLE public.chamados_assistencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
    veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
    atendente_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    protocolo TEXT NOT NULL UNIQUE,
    tipo_servico TEXT NOT NULL,
    descricao TEXT,
    origem_cep TEXT,
    origem_logradouro TEXT,
    origem_cidade TEXT,
    origem_uf TEXT,
    origem_lat DECIMAL(10,8),
    origem_lng DECIMAL(11,8),
    destino_cep TEXT,
    destino_logradouro TEXT,
    destino_cidade TEXT,
    destino_uf TEXT,
    destino_lat DECIMAL(10,8),
    destino_lng DECIMAL(11,8),
    prestador_nome TEXT,
    prestador_telefone TEXT,
    status status_chamado NOT NULL DEFAULT 'aberto',
    data_abertura TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_conclusao TIMESTAMPTZ,
    avaliacao_nota INTEGER CHECK (avaliacao_nota >= 1 AND avaliacao_nota <= 5),
    canal TEXT NOT NULL DEFAULT 'app',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chamados_assistencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage assistance calls"
ON public.chamados_assistencia FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own assistance calls"
ON public.chamados_assistencia FOR SELECT
USING (associado_id = get_my_associado_id(auth.uid()));

CREATE POLICY "Associates can insert assistance calls"
ON public.chamados_assistencia FOR INSERT
WITH CHECK (associado_id = get_my_associado_id(auth.uid()));

CREATE TRIGGER update_chamados_updated_at
BEFORE UPDATE ON public.chamados_assistencia
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_chamado_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.protocolo := 'ASS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('chamado_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_chamado_protocolo_trigger
BEFORE INSERT ON public.chamados_assistencia
FOR EACH ROW EXECUTE FUNCTION public.generate_chamado_protocolo();

-- =====================================================
-- Tabela: sinistros
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS sinistro_seq START 1;

CREATE TABLE public.sinistros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
    veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
    protocolo TEXT NOT NULL UNIQUE,
    tipo tipo_sinistro NOT NULL,
    data_ocorrencia TIMESTAMPTZ NOT NULL,
    local_descricao TEXT,
    descricao TEXT,
    bo_numero TEXT,
    bo_arquivo_url TEXT,
    valor_fipe DECIMAL(12,2),
    valor_indenizacao DECIMAL(12,2),
    status status_sinistro NOT NULL DEFAULT 'em_analise',
    analista_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    canal TEXT NOT NULL DEFAULT 'app',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sinistros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage claims"
ON public.sinistros FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own claims"
ON public.sinistros FOR SELECT
USING (associado_id = get_my_associado_id(auth.uid()));

CREATE POLICY "Associates can insert claims"
ON public.sinistros FOR INSERT
WITH CHECK (associado_id = get_my_associado_id(auth.uid()));

CREATE TRIGGER update_sinistros_updated_at
BEFORE UPDATE ON public.sinistros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_sinistro_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.protocolo := 'SIN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('sinistro_seq')::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_sinistro_protocolo_trigger
BEFORE INSERT ON public.sinistros
FOR EACH ROW EXECUTE FUNCTION public.generate_sinistro_protocolo();

-- =====================================================
-- Alterações na tabela tabelas_preco
-- =====================================================

ALTER TABLE public.tabelas_preco 
ADD COLUMN IF NOT EXISTS nome TEXT,
ADD COLUMN IF NOT EXISTS tipo_uso TEXT DEFAULT 'particular',
ADD COLUMN IF NOT EXISTS valor_assistencia DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vigencia_inicio DATE,
ADD COLUMN IF NOT EXISTS vigencia_fim DATE;

-- =====================================================
-- Storage Buckets
-- =====================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('instalacoes', 'instalacoes', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('vistorias', 'vistorias', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('sinistros', 'sinistros', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('assinaturas', 'assinaturas', false);

-- Storage policies for instalacoes bucket
CREATE POLICY "Staff can manage instalacoes files"
ON storage.objects FOR ALL
USING (bucket_id = 'instalacoes' AND is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own instalacoes files"
ON storage.objects FOR SELECT
USING (bucket_id = 'instalacoes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for vistorias bucket
CREATE POLICY "Staff can manage vistorias files"
ON storage.objects FOR ALL
USING (bucket_id = 'vistorias' AND is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own vistorias files"
ON storage.objects FOR SELECT
USING (bucket_id = 'vistorias' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for sinistros bucket
CREATE POLICY "Staff can manage sinistros files"
ON storage.objects FOR ALL
USING (bucket_id = 'sinistros' AND is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own sinistros files"
ON storage.objects FOR SELECT
USING (bucket_id = 'sinistros' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Associates can upload own sinistros files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'sinistros' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for assinaturas bucket
CREATE POLICY "Staff can manage assinaturas files"
ON storage.objects FOR ALL
USING (bucket_id = 'assinaturas' AND is_funcionario(auth.uid()));

CREATE POLICY "Associates can upload own assinaturas"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assinaturas' AND auth.uid()::text = (storage.foldername(name))[1]);