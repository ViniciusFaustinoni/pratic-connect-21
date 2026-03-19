
-- Tabela de solicitações de migração
CREATE TABLE public.solicitacoes_migracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid REFERENCES public.cotacoes(id) NOT NULL,
  associado_cpf text NOT NULL,
  associado_nome text,
  veiculo_placa text,
  associacao_origem text NOT NULL,
  consultor_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','reprovada')),
  motivo_reprovacao text,
  aprovado_por uuid REFERENCES public.profiles(id),
  aprovado_em timestamptz,
  prazo_resposta_horas int NOT NULL DEFAULT 48,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.solicitacoes_migracao ENABLE ROW LEVEL SECURITY;

-- Documentos da solicitação de migração
CREATE TABLE public.solicitacoes_migracao_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid REFERENCES public.solicitacoes_migracao(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('comprovante_pagamento','boleto_referencia')),
  arquivo_url text NOT NULL,
  nome_arquivo text,
  cpf_detectado text,
  placa_detectada text,
  legivel boolean DEFAULT true,
  validacao_ok boolean,
  validacao_erro text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.solicitacoes_migracao_documentos ENABLE ROW LEVEL SECURITY;

-- RLS solicitacoes_migracao
CREATE POLICY "Consultor pode ver suas solicitacoes migracao"
  ON public.solicitacoes_migracao FOR SELECT
  TO authenticated
  USING (
    consultor_id = public.get_my_profile_id()
    OR public.is_gerencia(auth.uid())
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'admin_master')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR public.has_role(auth.uid(), 'analista_cadastro')
  );

CREATE POLICY "Consultor pode criar solicitacoes migracao"
  ON public.solicitacoes_migracao FOR INSERT
  TO authenticated
  WITH CHECK (consultor_id = public.get_my_profile_id());

CREATE POLICY "Gerencia pode atualizar solicitacoes migracao"
  ON public.solicitacoes_migracao FOR UPDATE
  TO authenticated
  USING (
    public.is_gerencia(auth.uid())
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'admin_master')
    OR public.has_role(auth.uid(), 'desenvolvedor')
  );

-- RLS documentos migracao
CREATE POLICY "Acesso documentos migracao"
  ON public.solicitacoes_migracao_documentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solicitacoes_migracao sm
      WHERE sm.id = solicitacao_id
      AND (
        sm.consultor_id = public.get_my_profile_id()
        OR public.is_gerencia(auth.uid())
        OR public.has_role(auth.uid(), 'diretor')
        OR public.has_role(auth.uid(), 'admin_master')
        OR public.has_role(auth.uid(), 'desenvolvedor')
      )
    )
  );

CREATE POLICY "Consultor pode inserir documentos migracao"
  ON public.solicitacoes_migracao_documentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.solicitacoes_migracao sm
      WHERE sm.id = solicitacao_id
      AND sm.consultor_id = public.get_my_profile_id()
    )
  );
