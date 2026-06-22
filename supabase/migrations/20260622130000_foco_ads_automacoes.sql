-- =============================================================================
-- Foco Ads — Onda 5: Automacoes de guarda-corpo
-- =============================================================================
-- Regras que podem AGIR SOZINHAS (ex.: pausar anuncio que estourou custo).
-- REGRA DE OURO: so existem com FLAG EXPLICITA (ativo) e PADRAO DESLIGADO, e
-- sempre NOTIFICANDO o usuario. modo='executar' age sozinho; 'sinalizar' so avisa.
-- =============================================================================

CREATE TABLE public.ads_automacoes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  plataforma         text NOT NULL DEFAULT 'meta' CHECK (plataforma IN ('meta','google','todas')),
  gatilho            text NOT NULL CHECK (gatilho IN ('custo_conversa','custo_lead','with_issues')),
  -- 'sinalizar' = apenas notifica (seguro). 'executar' = age sozinho (sensivel).
  modo               text NOT NULL DEFAULT 'sinalizar' CHECK (modo IN ('sinalizar','executar')),
  -- FLAG EXPLICITA. Padrao FALSE: nenhuma automacao age sem ser ligada de proposito.
  ativo              boolean NOT NULL DEFAULT false,
  -- Sempre notificar por padrao (Regra de Ouro).
  notificar          boolean NOT NULL DEFAULT true,
  acao_tipo          text NOT NULL DEFAULT 'pausar' CHECK (acao_tipo IN ('pausar','reativar','ajustar_verba','duplicar')),
  parametros         jsonb,
  ultima_execucao_em timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_automacoes_ativo ON public.ads_automacoes(ativo, gatilho);

-- Seeds: automacoes padrao DESLIGADAS e em modo apenas-sinalizar.
INSERT INTO public.ads_automacoes (nome, plataforma, gatilho, modo, acao_tipo) VALUES
  ('Custo por conversa estourado', 'todas', 'custo_conversa', 'sinalizar', 'pausar'),
  ('Custo por lead estourado',     'todas', 'custo_lead',     'sinalizar', 'pausar'),
  ('Anuncio com problema (WITH_ISSUES)', 'meta', 'with_issues', 'sinalizar', 'pausar');

ALTER TABLE public.ads_automacoes ENABLE ROW LEVEL SECURITY;

-- Ver: quem tem foco_ads.ver. Gerenciar (ligar/desligar): foco_ads.aprovar.
CREATE POLICY "foco_ads_automacoes_select" ON public.ads_automacoes
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.ver'));
CREATE POLICY "foco_ads_automacoes_insert" ON public.ads_automacoes
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'foco_ads.aprovar'));
CREATE POLICY "foco_ads_automacoes_update" ON public.ads_automacoes
  FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'foco_ads.aprovar'));

CREATE TRIGGER trg_ads_automacoes_updated
  BEFORE UPDATE ON public.ads_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
