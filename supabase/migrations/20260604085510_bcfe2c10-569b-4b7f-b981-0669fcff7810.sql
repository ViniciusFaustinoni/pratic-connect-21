
-- =====================================================================
-- 1) ia_habilidades
-- =====================================================================
CREATE TABLE public.ia_habilidades (
  slug TEXT PRIMARY KEY,
  nome_exibicao TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  nome_agente TEXT NOT NULL,
  persona TEXT NOT NULL DEFAULT '',
  regras_absolutas TEXT NOT NULL DEFAULT '',
  tom_voz TEXT NOT NULL DEFAULT '',
  saudacao_inicial TEXT NOT NULL DEFAULT '',
  audiencias_elegiveis TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ferramentas_habilitadas TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  prioridade_roteamento INT NOT NULL DEFAULT 100,
  horario_atendimento JSONB,
  mensagem_fora_horario TEXT,
  atualizado_por UUID,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_habilidades TO authenticated;
GRANT ALL ON public.ia_habilidades TO service_role;

ALTER TABLE public.ia_habilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_habilidades autenticados leitura"
  ON public.ia_habilidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "ia_habilidades autenticados escrita"
  ON public.ia_habilidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_ia_habilidades_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ia_habilidades_touch
BEFORE UPDATE ON public.ia_habilidades
FOR EACH ROW EXECUTE FUNCTION public.tg_ia_habilidades_touch();

-- =====================================================================
-- 2) ia_habilidade_conhecimento
-- =====================================================================
CREATE TABLE public.ia_habilidade_conhecimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habilidade_slug TEXT NOT NULL REFERENCES public.ia_habilidades(slug) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'geral',
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  palavras_chave TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  revisar BOOLEAN NOT NULL DEFAULT false,
  atualizado_por UUID,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ia_conhecimento_habilidade ON public.ia_habilidade_conhecimento(habilidade_slug, ativo, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_habilidade_conhecimento TO authenticated;
GRANT ALL ON public.ia_habilidade_conhecimento TO service_role;

ALTER TABLE public.ia_habilidade_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_conhecimento autenticados leitura"
  ON public.ia_habilidade_conhecimento FOR SELECT TO authenticated USING (true);
CREATE POLICY "ia_conhecimento autenticados escrita"
  ON public.ia_habilidade_conhecimento FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ia_conhecimento_touch
BEFORE UPDATE ON public.ia_habilidade_conhecimento
FOR EACH ROW EXECUTE FUNCTION public.tg_ia_habilidades_touch();

-- =====================================================================
-- 3) ia_habilidade_exemplos
-- =====================================================================
CREATE TABLE public.ia_habilidade_exemplos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habilidade_slug TEXT NOT NULL REFERENCES public.ia_habilidades(slug) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  entrada_usuario TEXT NOT NULL,
  resposta_ideal TEXT NOT NULL,
  notas TEXT,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_por UUID,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ia_exemplos_habilidade ON public.ia_habilidade_exemplos(habilidade_slug, ativo, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_habilidade_exemplos TO authenticated;
GRANT ALL ON public.ia_habilidade_exemplos TO service_role;

ALTER TABLE public.ia_habilidade_exemplos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_exemplos autenticados leitura"
  ON public.ia_habilidade_exemplos FOR SELECT TO authenticated USING (true);
CREATE POLICY "ia_exemplos autenticados escrita"
  ON public.ia_habilidade_exemplos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ia_exemplos_touch
BEFORE UPDATE ON public.ia_habilidade_exemplos
FOR EACH ROW EXECUTE FUNCTION public.tg_ia_habilidades_touch();

-- =====================================================================
-- 4) Auditoria: qual habilidade atendeu cada contato
-- =====================================================================
ALTER TABLE public.agente_ia_contatos
  ADD COLUMN IF NOT EXISTS ultima_habilidade_atendeu TEXT,
  ADD COLUMN IF NOT EXISTS ultima_habilidade_atendeu_em TIMESTAMPTZ;

-- =====================================================================
-- 5) Seed inicial — 2 habilidades canônicas
-- =====================================================================
INSERT INTO public.ia_habilidades (
  slug, nome_exibicao, descricao, ativa, nome_agente,
  persona, regras_absolutas, tom_voz, saudacao_inicial,
  audiencias_elegiveis, ferramentas_habilitadas,
  prioridade_roteamento, horario_atendimento, mensagem_fora_horario
) VALUES
(
  'vendas',
  'Vendas (Vinicius)',
  'Atendimento comercial para leads — cotação, planos, conversão.',
  true,
  'Vinicius',
  'Você é Vinicius, consultor de vendas da Praticcar.',
  'Nunca prometa proteção ativada antes da aprovação. Nunca invente valores. Use as ferramentas para cotação real.',
  'Profissional, consultivo, claro. Sem emojis em excesso.',
  'Olá! Sou o Vinicius, consultor de vendas da Praticcar. Como posso te ajudar?',
  ARRAY['lead'],
  ARRAY['consultar_placa','calcular_cotacao','registrar_cotacao','obter_opcoes_vencimento','salvar_dados_cliente','solicitar_atendente_humano'],
  100,
  jsonb_build_object(
    'dias', ARRAY['seg','ter','qua','qui','sex'],
    'inicio', '08:00',
    'fim', '18:00',
    'timezone', 'America/Sao_Paulo'
  ),
  'No momento estamos fora do horário comercial (seg–sex, 8h–18h). Assim que abrir, retornamos pra você!'
),
(
  'relacionamento',
  'Relacionamento (Maya)',
  'Atendimento receptivo para associados ativos — boletos, status de processos, suporte.',
  true,
  'Maya',
  'Você é Maya, atendente de relacionamento da Praticcar.',
  'Nunca prometa ação humana sem chamar solicitar_atendente_humano. Nunca deixe vácuo — toda mensagem do cliente recebe resposta. Use FAQ e ferramentas; em dúvida, escale.',
  'Acolhedor, direto, empático. Emoji moderado (😊 👋).',
  'Olá! Tudo bem? Pra te atender melhor, me confirma seu *nome completo* ou *CPF*. 😁',
  ARRAY['associado','diretor'],
  ARRAY['consultar_boletos_associado','solicitar_atendente_humano'],
  100,
  NULL,
  NULL
);
