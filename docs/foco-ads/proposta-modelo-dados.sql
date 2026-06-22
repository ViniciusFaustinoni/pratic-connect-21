-- =============================================================================
-- PROPOSTA DE MODELO DE DADOS — Foco Ads  (DOCUMENTO DE RACIONAL / NÃO APLICAR)
-- =============================================================================
-- >>> PROMOVIDO. A versão oficial e aplicável é a migration:
-- >>>   supabase/migrations/20260622120000_foco_ads_modelo_dados.sql
-- >>> que inclui correções: RLS completo nas 10 tabelas, CHECK constraints,
-- >>> tabela ads_guardrails_config e concessão de permissões a super-admins.
-- Este arquivo permanece apenas como racional anotado do desenho.
-- =============================================================================
-- Este arquivo está em docs/ de propósito: é um ARTEFATO DE REVISÃO.
-- NÃO está em supabase/migrations/ para evitar auto-aplicação pelo Lovable/Supabase.
--
-- Convenções seguidas (idênticas às migrations existentes do projeto):
--   - id uuid PRIMARY KEY DEFAULT gen_random_uuid()
--   - created_at / updated_at timestamptz NOT NULL DEFAULT now()
--   - RLS habilitado + policies via public.has_permission(auth.uid(), 'chave.pontilhada')
--   - trigger BEFORE UPDATE -> public.update_updated_at_column()
--
-- Princípios (ver CLAUDE.md):
--   - LGPD: SOMENTE métricas agregadas. Nenhum PII de lead.
--   - Regra de Ouro: nada que gaste dinheiro executa sem aprovação + auditoria.
--   - Segmentar objetivo: messaging (WhatsApp) vs. lead (formulário) — nunca somar cru.
--   - Token Meta NÃO vive aqui: fica em integracoes_credenciais (criptografado).
-- =============================================================================

-- Permissões novas a registrar em app_roles_config (proposta de chaves):
--   foco_ads.ver        -> Visualizador Ads (só vê dashboards/achados)
--   foco_ads.aprovar    -> Operador Ads (aprova/rejeita ações propostas)
--   foco_ads.executar   -> Operador Ads (dispara execução real na Meta)
-- (A escrita real na Meta é feita por edge function com service_role; o cliente
--  nunca escreve direto em ads_log_execucoes.)


-- =========================================================================
-- ONDA 1 — INGESTÃO (leitura Meta, agregada)
-- =========================================================================

-- Conta de anúncio (1 linha por ad account conectada)
CREATE TABLE public.ads_contas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma      text NOT NULL DEFAULT 'meta',          -- 'meta' | 'google'
  conta_externa   text NOT NULL,                          -- ex.: act_123456789
  nome            text,
  moeda           text NOT NULL DEFAULT 'BRL',
  status          text NOT NULL DEFAULT 'ativa',          -- 'ativa' | 'pausada' | 'erro'
  ultima_sync_em  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plataforma, conta_externa)
);

-- Campanha
CREATE TABLE public.ads_campanhas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id        uuid NOT NULL REFERENCES public.ads_contas(id) ON DELETE CASCADE,
  campanha_externa text NOT NULL,
  nome            text,
  objetivo        text,                                   -- objetivo bruto da plataforma
  objetivo_norm   text,                                   -- 'messaging' | 'lead' | 'outro'
  status          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, campanha_externa)
);

-- Conjunto de anúncios (ad set)
CREATE TABLE public.ads_conjuntos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id       uuid NOT NULL REFERENCES public.ads_campanhas(id) ON DELETE CASCADE,
  conjunto_externo  text NOT NULL,
  nome              text,
  objetivo_norm     text,                                 -- herda/normaliza messaging|lead|outro
  optimization_goal text,
  verba_diaria      numeric(14,2),
  status            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campanha_id, conjunto_externo)
);

-- Anúncio
CREATE TABLE public.ads_anuncios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conjunto_id       uuid NOT NULL REFERENCES public.ads_conjuntos(id) ON DELETE CASCADE,
  anuncio_externo   text NOT NULL,
  nome              text,
  status            text,
  effective_status  text,                                 -- captura WITH_ISSUES (guardrail)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conjunto_id, anuncio_externo)
);

-- Métricas agregadas por dia/entidade/objetivo (sem PII)
CREATE TABLE public.ads_insights_diarios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data             date NOT NULL,
  plataforma       text NOT NULL DEFAULT 'meta',
  entidade_tipo    text NOT NULL,                         -- 'conta'|'campanha'|'conjunto'|'anuncio'
  entidade_id      uuid NOT NULL,                          -- fk lógica p/ a tabela do tipo
  objetivo_norm    text NOT NULL DEFAULT 'outro',          -- 'messaging' | 'lead' | 'outro'
  impressoes       bigint NOT NULL DEFAULT 0,
  cliques          bigint NOT NULL DEFAULT 0,
  gasto            numeric(14,2) NOT NULL DEFAULT 0,
  conversas        bigint NOT NULL DEFAULT 0,              -- WhatsApp (messaging)
  leads            bigint NOT NULL DEFAULT 0,              -- formulário
  custo_por_conversa numeric(14,2),
  custo_por_lead     numeric(14,2),
  raw              jsonb,                                  -- payload bruto da plataforma (agregado)
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plataforma, entidade_tipo, entidade_id, data)
);

CREATE INDEX idx_ads_insights_data      ON public.ads_insights_diarios(data DESC);
CREATE INDEX idx_ads_insights_entidade  ON public.ads_insights_diarios(entidade_tipo, entidade_id);
CREATE INDEX idx_ads_insights_objetivo  ON public.ads_insights_diarios(objetivo_norm, data DESC);


-- =========================================================================
-- ONDA 2 — INTELIGÊNCIA (IA analista: crítica + sugestões, sem executar)
-- =========================================================================

-- Rodada de análise
CREATE TABLE public.ads_analises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id        uuid REFERENCES public.ads_contas(id) ON DELETE CASCADE,
  periodo_inicio  date NOT NULL,
  periodo_fim     date NOT NULL,
  modelo_ia       text,                                   -- ex.: anthropic/claude-opus
  status          text NOT NULL DEFAULT 'concluida',      -- 'processando'|'concluida'|'falha'
  resumo          text,
  criado_por      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Achado (cada crítica/sugestão gerada pela IA)
CREATE TABLE public.ads_achados (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id        uuid NOT NULL REFERENCES public.ads_analises(id) ON DELETE CASCADE,
  severidade        text NOT NULL DEFAULT 'media',        -- 'baixa'|'media'|'alta'|'critica'
  tipo              text NOT NULL,                         -- 'custo_conversa'|'custo_lead'|'with_issues'|...
  entidade_tipo     text,
  entidade_id       uuid,
  titulo            text NOT NULL,
  descricao         text,
  evidencia         jsonb,                                 -- MÉTRICAS REAIS (âncora anti-alucinação)
  sugestao          text,
  acao_sugerida     jsonb,                                 -- candidata a virar acao_proposta
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_achados_analise    ON public.ads_achados(analise_id);
CREATE INDEX idx_ads_achados_severidade ON public.ads_achados(severidade);


-- =========================================================================
-- ONDA 3 — EXECUÇÃO COM APROVAÇÃO (Meta)
-- =========================================================================

-- Ação proposta (IA sugere -> usuário aprova -> sistema executa)
CREATE TABLE public.ads_acoes_propostas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma         text NOT NULL DEFAULT 'meta',
  tipo               text NOT NULL,                        -- 'pausar'|'reativar'|'ajustar_verba'|'duplicar'
  entidade_tipo      text NOT NULL,                        -- 'campanha'|'conjunto'|'anuncio'
  entidade_id        uuid,                                 -- fk lógica local
  entidade_externa_id text NOT NULL,                       -- id na plataforma (alvo da escrita)
  payload_proposto   jsonb NOT NULL,                       -- diff/valores a aplicar
  justificativa_ia   text,
  achado_id          uuid REFERENCES public.ads_achados(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'proposta',     -- proposta|aprovada|rejeitada|executando|executada|falha|revertida
  idempotency_key    text UNIQUE,                          -- impede execução dupla
  criado_por         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_acoes_status ON public.ads_acoes_propostas(status, created_at DESC);

-- Decisão de aprovação (quem aprovou/rejeitou)
CREATE TABLE public.ads_aprovacoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id       uuid NOT NULL REFERENCES public.ads_acoes_propostas(id) ON DELETE CASCADE,
  aprovador_id  uuid NOT NULL,
  decisao       text NOT NULL,                             -- 'aprovou' | 'rejeitou'
  comentario    text,
  decidido_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_aprovacoes_acao ON public.ads_aprovacoes(acao_id);

-- Log de execução (resultado real na plataforma + como desfazer)
CREATE TABLE public.ads_log_execucoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id         uuid NOT NULL REFERENCES public.ads_acoes_propostas(id) ON DELETE CASCADE,
  request_payload jsonb,                                   -- NUNCA inclui o token
  response_meta   jsonb,
  sucesso         boolean NOT NULL DEFAULT false,
  erro            text,
  undo_payload    jsonb,                                   -- como reverter (estado anterior)
  executado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_log_execucoes_acao ON public.ads_log_execucoes(acao_id);


-- =========================================================================
-- RLS — habilitar e aplicar policies por permissão
-- =========================================================================
ALTER TABLE public.ads_contas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_campanhas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_conjuntos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_anuncios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_insights_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_analises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_achados          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_acoes_propostas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_aprovacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_log_execucoes    ENABLE ROW LEVEL SECURITY;

-- Leitura: quem tem foco_ads.ver enxerga tudo do módulo.
-- (repetir o bloco SELECT abaixo para cada tabela de leitura)
CREATE POLICY "foco_ads_select" ON public.ads_contas
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
-- ... (idem para ads_campanhas, ads_conjuntos, ads_anuncios, ads_insights_diarios,
--       ads_analises, ads_achados, ads_acoes_propostas, ads_aprovacoes, ads_log_execucoes)

-- Aprovação: só quem tem foco_ads.aprovar registra decisão e muda status.
CREATE POLICY "foco_ads_aprovar_insert" ON public.ads_aprovacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'foco_ads.aprovar'));

CREATE POLICY "foco_ads_acoes_update" ON public.ads_acoes_propostas
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'foco_ads.aprovar'));

-- Execução/ingestão: escrita feita por edge functions com service_role (bypassa RLS).
-- Cliente NÃO insere em ads_log_execucoes nem nas tabelas de ingestão.
-- (Sem policy de INSERT para authenticated nessas tabelas = negado por padrão.)


-- =========================================================================
-- Triggers updated_at
-- =========================================================================
CREATE TRIGGER trg_ads_contas_updated     BEFORE UPDATE ON public.ads_contas          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_campanhas_updated  BEFORE UPDATE ON public.ads_campanhas       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_conjuntos_updated  BEFORE UPDATE ON public.ads_conjuntos       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_anuncios_updated   BEFORE UPDATE ON public.ads_anuncios        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_acoes_updated      BEFORE UPDATE ON public.ads_acoes_propostas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- FIM DA PROPOSTA. Próximos passos após aprovação:
--   1. Registrar permissões foco_ads.* nos perfis (app_roles_config).
--   2. Promover este SQL para supabase/migrations/<timestamp>_foco_ads_modelo.sql.
--   3. Onda 1: edge function ads-meta-sync (cron) populando estas tabelas.
-- =============================================================================
