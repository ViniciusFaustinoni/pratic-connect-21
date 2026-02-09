
-- =============================================
-- Tabela substituicoes_veiculo
-- =============================================
CREATE TABLE public.substituicoes_veiculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  associado_id uuid NOT NULL REFERENCES public.associados(id),
  veiculo_antigo_id uuid NOT NULL REFERENCES public.veiculos(id),
  veiculo_novo_id uuid REFERENCES public.veiculos(id),
  servico_retirada_id uuid REFERENCES public.servicos(id),
  servico_instalacao_id uuid REFERENCES public.servicos(id),
  contrato_novo_id uuid REFERENCES public.contratos(id),
  
  status varchar(30) NOT NULL DEFAULT 'iniciada',
  
  veiculo_antigo_placa varchar(10),
  veiculo_antigo_modelo varchar(100),
  veiculo_antigo_fipe decimal(12,2),
  mensalidade_antiga decimal(10,2),
  cota_participacao_antiga decimal(10,2),
  
  veiculo_novo_placa varchar(10),
  veiculo_novo_modelo varchar(100),
  veiculo_novo_fipe decimal(12,2),
  mensalidade_nova decimal(10,2),
  cota_participacao_nova decimal(10,2),
  
  beneficios_novos jsonb DEFAULT '{}',
  
  taxa_substituicao decimal(10,2) DEFAULT 50.00,
  valor_prorata decimal(10,2),
  diferenca_mensalidade decimal(10,2),
  cobranca_taxa_asaas_id varchar(100),
  
  evento_bloqueante_id uuid,
  tipo_evento_bloqueante varchar(50),
  resolucao_evento varchar(50),
  termo_desistencia_evento_url text,
  
  data_inicio_carencia timestamptz,
  data_fim_carencia timestamptz,
  carencia_dias integer DEFAULT 120,
  
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  motivo_rejeicao text,
  rejeitado_por uuid REFERENCES auth.users(id),
  rejeitado_em timestamptz,
  
  consultor_id uuid,
  pontos_consultor decimal(3,1) DEFAULT 0.5,
  comissao_creditada boolean DEFAULT false,
  
  autentique_documento_id varchar(100),
  autentique_status varchar(30),
  
  observacoes text,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subst_associado ON public.substituicoes_veiculo(associado_id);
CREATE INDEX idx_subst_status ON public.substituicoes_veiculo(status);
CREATE INDEX idx_subst_veiculo_antigo ON public.substituicoes_veiculo(veiculo_antigo_id);

ALTER TABLE public.substituicoes_veiculo ENABLE ROW LEVEL SECURITY;

-- Uses existing is_funcionario function
CREATE POLICY "funcionario_full_access" ON public.substituicoes_veiculo
FOR ALL USING (public.is_funcionario(auth.uid()));

-- Security definer to get associado_id
CREATE OR REPLACE FUNCTION public.get_associado_id_for_user(p_auth_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id FROM public.associados a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE p.user_id = p_auth_user_id
  LIMIT 1
$$;

CREATE POLICY "associado_select_proprio" ON public.substituicoes_veiculo
FOR SELECT USING (
  associado_id = public.get_associado_id_for_user(auth.uid())
);

-- Novas colunas em veiculos
ALTER TABLE public.veiculos
ADD COLUMN IF NOT EXISTS principal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS substituido_por uuid REFERENCES public.veiculos(id),
ADD COLUMN IF NOT EXISTS data_inativacao timestamptz,
ADD COLUMN IF NOT EXISTS motivo_inativacao varchar(50),
ADD COLUMN IF NOT EXISTS substituicao_id uuid REFERENCES public.substituicoes_veiculo(id);

COMMENT ON COLUMN public.veiculos.principal IS 'Se é o veículo principal/ativo do associado';
COMMENT ON COLUMN public.veiculos.substituido_por IS 'ID do veículo que o substituiu';
COMMENT ON COLUMN public.veiculos.motivo_inativacao IS 'substituicao, cancelamento, exclusao, sinistro_perda_total';

UPDATE public.veiculos SET principal = true WHERE ativo = true AND principal IS NULL;
