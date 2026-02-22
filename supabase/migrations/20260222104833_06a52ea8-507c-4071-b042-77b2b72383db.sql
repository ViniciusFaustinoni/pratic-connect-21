
-- S01 Parte 2: Tabelas, triggers, RLS, storage

-- 1. Tabela empresas_sindicancia
CREATE TABLE public.empresas_sindicancia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj VARCHAR(18) UNIQUE NOT NULL,
  responsavel_nome TEXT NOT NULL,
  responsavel_cpf VARCHAR(14),
  responsavel_telefone VARCHAR(20),
  responsavel_email TEXT,
  especialidades TEXT[] DEFAULT '{}',
  regioes_atuacao TEXT[] DEFAULT '{}',
  valor_por_sindicancia NUMERIC(10,2),
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.empresas_sindicancia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem gerenciar empresas sindicancia"
  ON public.empresas_sindicancia FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'analista_eventos') OR public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Sindicante ve sua empresa"
  ON public.empresas_sindicancia FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sindicante') AND
    profile_id = public.get_my_profile_id()
  );

-- 2. Função para gerar número SIND-YYYYMMDD-XXX
CREATE OR REPLACE FUNCTION public.gerar_numero_sindicancia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date TEXT;
  v_seq INT;
BEGIN
  v_date := to_char(COALESCE(NEW.data_abertura, NOW()), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero FROM LENGTH('SIND-' || v_date || '-') + 1) AS INT)
  ), 0) + 1
  INTO v_seq
  FROM public.sindicancias
  WHERE numero LIKE 'SIND-' || v_date || '-%';
  
  NEW.numero := 'SIND-' || v_date || '-' || LPAD(v_seq::TEXT, 3, '0');
  
  IF NEW.data_limite IS NULL THEN
    NEW.data_limite := COALESCE(NEW.data_abertura, NOW()) + INTERVAL '30 days';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Tabela sindicancias
CREATE TABLE public.sindicancias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE,
  sinistro_id UUID NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  empresa_sindicancia_id UUID REFERENCES public.empresas_sindicancia(id),
  sindicante_profile_id UUID REFERENCES public.profiles(id),
  motivo TEXT NOT NULL,
  motivos_padronizados TEXT[] DEFAULT '{}',
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando_atribuicao',
  data_abertura TIMESTAMPTZ DEFAULT NOW(),
  data_atribuicao TIMESTAMPTZ,
  data_limite TIMESTAMPTZ,
  data_laudo TIMESTAMPTZ,
  data_encerramento TIMESTAMPTZ,
  laudo_conclusao TEXT,
  laudo_resumo TEXT,
  laudo_irregularidades TEXT,
  laudo_recomendacao TEXT,
  laudo_arquivo_url TEXT,
  decisao_analista TEXT,
  decisao_observacao TEXT,
  decisao_por UUID REFERENCES public.profiles(id),
  decisao_em TIMESTAMPTZ,
  aberto_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_sindicancia_numero
  BEFORE INSERT ON public.sindicancias
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_numero_sindicancia();

ALTER TABLE public.sindicancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios veem todas sindicancias"
  ON public.sindicancias FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'analista_eventos') OR public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Sindicante ve seus casos"
  ON public.sindicancias FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sindicante') AND
    sindicante_profile_id = public.get_my_profile_id()
  );

CREATE POLICY "Sindicante atualiza laudo"
  ON public.sindicancias FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sindicante') AND
    sindicante_profile_id = public.get_my_profile_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'sindicante') AND
    sindicante_profile_id = public.get_my_profile_id()
  );

-- 4. Tabela sindicancia_diligencias
CREATE TABLE public.sindicancia_diligencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sindicancia_id UUID NOT NULL REFERENCES public.sindicancias(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  data_diligencia DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT NOT NULL,
  resultado TEXT,
  local TEXT,
  registrado_por UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sindicancia_diligencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios veem diligencias"
  ON public.sindicancia_diligencias FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'analista_eventos') OR public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Sindicante ve suas diligencias"
  ON public.sindicancia_diligencias FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sindicante') AND
    sindicancia_id IN (SELECT id FROM public.sindicancias WHERE sindicante_profile_id = public.get_my_profile_id())
  );

CREATE POLICY "Sindicante insere diligencias"
  ON public.sindicancia_diligencias FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'sindicante') AND
    sindicancia_id IN (SELECT id FROM public.sindicancias WHERE sindicante_profile_id = public.get_my_profile_id()) AND
    registrado_por = public.get_my_profile_id()
  );

-- 5. Tabela sindicancia_solicitacoes
CREATE TABLE public.sindicancia_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sindicancia_id UUID NOT NULL REFERENCES public.sindicancias(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  resposta TEXT,
  resposta_anexo_url TEXT,
  solicitado_por UUID REFERENCES public.profiles(id),
  respondido_por UUID REFERENCES public.profiles(id),
  solicitado_em TIMESTAMPTZ DEFAULT NOW(),
  respondido_em TIMESTAMPTZ
);

ALTER TABLE public.sindicancia_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios gerenciam solicitacoes"
  ON public.sindicancia_solicitacoes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'analista_eventos') OR public.has_role(auth.uid(), 'admin_master') OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Sindicante ve solicitacoes"
  ON public.sindicancia_solicitacoes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sindicante') AND
    sindicancia_id IN (SELECT id FROM public.sindicancias WHERE sindicante_profile_id = public.get_my_profile_id())
  );

CREATE POLICY "Sindicante cria solicitacoes"
  ON public.sindicancia_solicitacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'sindicante') AND
    sindicancia_id IN (SELECT id FROM public.sindicancias WHERE sindicante_profile_id = public.get_my_profile_id()) AND
    solicitado_por = public.get_my_profile_id()
  );

-- 6. Atualizar sindicancia_evidencias
ALTER TABLE public.sindicancia_evidencias 
  ADD COLUMN IF NOT EXISTS sindicancia_id UUID REFERENCES public.sindicancias(id),
  ADD COLUMN IF NOT EXISTS diligencia_id UUID REFERENCES public.sindicancia_diligencias(id);

CREATE POLICY "Sindicante ve evidencias seus casos"
  ON public.sindicancia_evidencias FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sindicante') AND
    (
      sindicancia_id IN (SELECT id FROM public.sindicancias WHERE sindicante_profile_id = public.get_my_profile_id())
      OR sinistro_id IN (SELECT sinistro_id FROM public.sindicancias WHERE sindicante_profile_id = public.get_my_profile_id())
    )
  );

CREATE POLICY "Sindicante insere evidencias seus casos"
  ON public.sindicancia_evidencias FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'sindicante') AND
    (
      sindicancia_id IN (SELECT id FROM public.sindicancias WHERE sindicante_profile_id = public.get_my_profile_id())
      OR sinistro_id IN (SELECT sinistro_id FROM public.sindicancias WHERE sindicante_profile_id = public.get_my_profile_id())
    )
  );

-- 7. Bucket storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sindicancia-evidencias', 'sindicancia-evidencias', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Upload sindicancia evidencias"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sindicancia-evidencias' AND (
    public.has_role(auth.uid(), 'sindicante') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'analista_eventos') OR
    public.has_role(auth.uid(), 'admin_master') OR
    public.has_role(auth.uid(), 'desenvolvedor')
  ));

CREATE POLICY "Leitura sindicancia evidencias"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'sindicancia-evidencias' AND (
    public.has_role(auth.uid(), 'sindicante') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'analista_eventos') OR
    public.has_role(auth.uid(), 'admin_master') OR
    public.has_role(auth.uid(), 'desenvolvedor')
  ));

-- 8. Triggers updated_at
CREATE TRIGGER update_sindicancias_updated_at
  BEFORE UPDATE ON public.sindicancias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_empresas_sindicancia_updated_at
  BEFORE UPDATE ON public.empresas_sindicancia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Índices
CREATE INDEX idx_sindicancias_sinistro ON public.sindicancias(sinistro_id);
CREATE INDEX idx_sindicancias_sindicante ON public.sindicancias(sindicante_profile_id);
CREATE INDEX idx_sindicancias_status ON public.sindicancias(status);
CREATE INDEX idx_sindicancias_empresa ON public.sindicancias(empresa_sindicancia_id);
CREATE INDEX idx_diligencias_sindicancia ON public.sindicancia_diligencias(sindicancia_id);
CREATE INDEX idx_solicitacoes_sindicancia ON public.sindicancia_solicitacoes(sindicancia_id);
CREATE INDEX idx_evidencias_sindicancia_id ON public.sindicancia_evidencias(sindicancia_id);
CREATE INDEX idx_evidencias_diligencia_id ON public.sindicancia_evidencias(diligencia_id);
