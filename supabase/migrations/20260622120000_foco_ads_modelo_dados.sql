-- =============================================================================
-- Foco Ads — Modelo de dados (Ondas 1-3)
-- =============================================================================
-- Plataforma de gestao de trafego pago (Meta primeiro) com IA copiloto.
-- Principios (ver CLAUDE.md):
--   - LGPD: SOMENTE metricas agregadas. Nenhum PII de lead.
--   - Regra de Ouro: nada que gaste dinheiro executa sem aprovacao + auditoria.
--   - Segmentar objetivo: messaging (WhatsApp) vs lead (formulario) — nunca somar cru.
--   - Token Meta NAO vive aqui: fica em integracoes_credenciais (criptografado).
-- Convencoes: id uuid gen_random_uuid(); timestamptz now(); RLS via has_permission;
--             trigger update_updated_at_column().
-- =============================================================================


-- =========================================================================
-- ONDA 1 — INGESTAO (leitura Meta, agregada)
-- =========================================================================

CREATE TABLE public.ads_contas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma      text NOT NULL DEFAULT 'meta' CHECK (plataforma IN ('meta','google')),
  conta_externa   text NOT NULL,
  nome            text,
  moeda           text NOT NULL DEFAULT 'BRL',
  status          text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','erro')),
  ultima_sync_em  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plataforma, conta_externa)
);

CREATE TABLE public.ads_campanhas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id         uuid NOT NULL REFERENCES public.ads_contas(id) ON DELETE CASCADE,
  campanha_externa text NOT NULL,
  nome             text,
  objetivo         text,
  objetivo_norm    text NOT NULL DEFAULT 'outro' CHECK (objetivo_norm IN ('messaging','lead','outro')),
  status           text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, campanha_externa)
);

CREATE TABLE public.ads_conjuntos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id       uuid NOT NULL REFERENCES public.ads_campanhas(id) ON DELETE CASCADE,
  conjunto_externo  text NOT NULL,
  nome              text,
  objetivo_norm     text NOT NULL DEFAULT 'outro' CHECK (objetivo_norm IN ('messaging','lead','outro')),
  optimization_goal text,
  verba_diaria      numeric(14,2),
  status            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, conjunto_externo)
);

CREATE TABLE public.ads_anuncios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conjunto_id      uuid NOT NULL REFERENCES public.ads_conjuntos(id) ON DELETE CASCADE,
  anuncio_externo  text NOT NULL,
  nome             text,
  status           text,
  effective_status text,                                  -- captura WITH_ISSUES (guardrail)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conjunto_id, anuncio_externo)
);

CREATE TABLE public.ads_insights_diarios (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data               date NOT NULL,
  plataforma         text NOT NULL DEFAULT 'meta' CHECK (plataforma IN ('meta','google')),
  entidade_tipo      text NOT NULL CHECK (entidade_tipo IN ('conta','campanha','conjunto','anuncio')),
  entidade_id        uuid NOT NULL,
  objetivo_norm      text NOT NULL DEFAULT 'outro' CHECK (objetivo_norm IN ('messaging','lead','outro')),
  impressoes         bigint NOT NULL DEFAULT 0,
  cliques            bigint NOT NULL DEFAULT 0,
  gasto              numeric(14,2) NOT NULL DEFAULT 0,
  conversas          bigint NOT NULL DEFAULT 0,           -- WhatsApp (messaging)
  leads              bigint NOT NULL DEFAULT 0,           -- formulario
  custo_por_conversa numeric(14,2),
  custo_por_lead     numeric(14,2),
  raw                jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plataforma, entidade_tipo, entidade_id, data)
);

CREATE INDEX idx_ads_insights_data     ON public.ads_insights_diarios(data DESC);
CREATE INDEX idx_ads_insights_entidade ON public.ads_insights_diarios(entidade_tipo, entidade_id);
CREATE INDEX idx_ads_insights_objetivo ON public.ads_insights_diarios(objetivo_norm, data DESC);


-- =========================================================================
-- GUARDRAILS configuraveis (sem hardcode de regra de negocio)
-- =========================================================================
CREATE TABLE public.ads_guardrails_config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave        text NOT NULL UNIQUE,
  valor        numeric(14,2) NOT NULL,
  janela_horas integer NOT NULL DEFAULT 48,
  ativo        boolean NOT NULL DEFAULT true,
  descricao    text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ads_guardrails_config (chave, valor, janela_horas, descricao) VALUES
  ('custo_max_conversa_48h', 25.00, 48, 'Custo por conversa (WhatsApp) acima disso em 48h -> sinalizar'),
  ('custo_max_lead_48h',     30.00, 48, 'Custo por lead (formulario) acima disso em 48h -> sinalizar');


-- =========================================================================
-- ONDA 2 — INTELIGENCIA (IA analista: critica + sugestoes, sem executar)
-- =========================================================================
CREATE TABLE public.ads_analises (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id       uuid REFERENCES public.ads_contas(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim    date NOT NULL,
  modelo_ia      text,
  status         text NOT NULL DEFAULT 'concluida' CHECK (status IN ('processando','concluida','falha')),
  resumo         text,
  criado_por     uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ads_achados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id    uuid NOT NULL REFERENCES public.ads_analises(id) ON DELETE CASCADE,
  severidade    text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  tipo          text NOT NULL,
  entidade_tipo text,
  entidade_id   uuid,
  titulo        text NOT NULL,
  descricao     text,
  evidencia     jsonb,                                    -- METRICAS REAIS (ancora anti-alucinacao)
  sugestao      text,
  acao_sugerida jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_achados_analise    ON public.ads_achados(analise_id);
CREATE INDEX idx_ads_achados_severidade ON public.ads_achados(severidade);


-- =========================================================================
-- ONDA 3 — EXECUCAO COM APROVACAO (Meta)
-- =========================================================================
CREATE TABLE public.ads_acoes_propostas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma          text NOT NULL DEFAULT 'meta' CHECK (plataforma IN ('meta','google')),
  tipo                text NOT NULL CHECK (tipo IN ('pausar','reativar','ajustar_verba','duplicar')),
  entidade_tipo       text NOT NULL CHECK (entidade_tipo IN ('campanha','conjunto','anuncio')),
  entidade_id         uuid,
  entidade_externa_id text NOT NULL,
  payload_proposto    jsonb NOT NULL,
  justificativa_ia    text,
  achado_id           uuid REFERENCES public.ads_achados(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'proposta'
                        CHECK (status IN ('proposta','aprovada','rejeitada','executando','executada','falha','revertida')),
  idempotency_key     text UNIQUE,
  criado_por          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_acoes_status ON public.ads_acoes_propostas(status, created_at DESC);
CREATE INDEX idx_ads_acoes_achado ON public.ads_acoes_propostas(achado_id);

CREATE TABLE public.ads_aprovacoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id      uuid NOT NULL REFERENCES public.ads_acoes_propostas(id) ON DELETE CASCADE,
  aprovador_id uuid NOT NULL,
  decisao      text NOT NULL CHECK (decisao IN ('aprovou','rejeitou')),
  comentario   text,
  decidido_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_aprovacoes_acao ON public.ads_aprovacoes(acao_id);

CREATE TABLE public.ads_log_execucoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id         uuid NOT NULL REFERENCES public.ads_acoes_propostas(id) ON DELETE CASCADE,
  request_payload jsonb,                                  -- NUNCA inclui o token
  response_meta   jsonb,
  sucesso         boolean NOT NULL DEFAULT false,
  erro            text,
  undo_payload    jsonb,                                  -- como reverter (estado anterior)
  executado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_log_execucoes_acao ON public.ads_log_execucoes(acao_id);


-- =========================================================================
-- RLS — leitura para foco_ads.ver; aprovacao para foco_ads.aprovar.
-- Escrita de ingestao/execucao e feita por edge functions (service_role,
-- que bypassa RLS). Sem policy de INSERT p/ authenticated = negado por padrao.
-- =========================================================================
ALTER TABLE public.ads_contas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_campanhas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_conjuntos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_anuncios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_insights_diarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_guardrails_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_analises          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_achados           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_acoes_propostas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_aprovacoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_log_execucoes     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foco_ads_ver" ON public.ads_contas
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_campanhas
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_conjuntos
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_anuncios
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_insights_diarios
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_guardrails_config
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_analises
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_achados
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_acoes_propostas
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_aprovacoes
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_ver" ON public.ads_log_execucoes
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));

-- Guardrails: ajuste so por quem aprova.
CREATE POLICY "foco_ads_guardrails_update" ON public.ads_guardrails_config
  FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.aprovar'));

-- Aprovacao: registrar decisao e mudar status da acao.
CREATE POLICY "foco_ads_aprovar_insert" ON public.ads_aprovacoes
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'foco_ads.aprovar'));
CREATE POLICY "foco_ads_acoes_update" ON public.ads_acoes_propostas
  FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.aprovar'));


-- =========================================================================
-- Triggers updated_at
-- =========================================================================
CREATE TRIGGER trg_ads_contas_updated     BEFORE UPDATE ON public.ads_contas          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_campanhas_updated  BEFORE UPDATE ON public.ads_campanhas       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_conjuntos_updated  BEFORE UPDATE ON public.ads_conjuntos       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_anuncios_updated   BEFORE UPDATE ON public.ads_anuncios        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_acoes_updated      BEFORE UPDATE ON public.ads_acoes_propostas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_guardrails_updated BEFORE UPDATE ON public.ads_guardrails_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =========================================================================
-- Permissoes do modulo: concede acesso imediato a roles super-admin.
-- Idempotente (DISTINCT). Demais perfis sao configurados na UI de Perfis.
-- =========================================================================
UPDATE public.app_roles_config
SET permissions = (
  SELECT to_jsonb(array_agg(DISTINCT p))
  FROM jsonb_array_elements_text(
    COALESCE(permissions, '[]'::jsonb)
    || '["foco_ads.ver","foco_ads.aprovar","foco_ads.executar"]'::jsonb
  ) AS p
)
WHERE role IN ('admin_master','desenvolvedor');
