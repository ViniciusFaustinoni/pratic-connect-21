-- Tabelas para tornar a Maya IA editável (comportamento + base de conhecimento/FAQ)

-- 1) Comportamento por audiência
CREATE TABLE public.maya_ia_comportamento (
  audiencia text PRIMARY KEY CHECK (audiencia IN ('associado','lead','diretor')),
  nome_agente text NOT NULL DEFAULT 'Maya',
  persona text NOT NULL DEFAULT '',
  regras_absolutas text NOT NULL DEFAULT '',
  tom_voz text NOT NULL DEFAULT '',
  saudacao_inicial text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

GRANT SELECT, INSERT, UPDATE ON public.maya_ia_comportamento TO authenticated;
GRANT ALL ON public.maya_ia_comportamento TO service_role;

ALTER TABLE public.maya_ia_comportamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Maya comportamento — leitura autenticada"
  ON public.maya_ia_comportamento FOR SELECT TO authenticated USING (true);

CREATE POLICY "Maya comportamento — escrita Relacionamento/Diretoria"
  ON public.maya_ia_comportamento FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR public.has_role(auth.uid(), 'relacionamento')
    OR public.has_role(auth.uid(), 'gerente_relacionamento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR public.has_role(auth.uid(), 'relacionamento')
    OR public.has_role(auth.uid(), 'gerente_relacionamento')
  );

-- 2) Base de conhecimento (FAQ)
CREATE TABLE public.maya_ia_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL DEFAULT 'geral',
  pergunta text NOT NULL,
  resposta text NOT NULL,
  palavras_chave text[] NOT NULL DEFAULT '{}',
  audiencias text[] NOT NULL DEFAULT ARRAY['associado','lead']::text[],
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_maya_ia_faq_categoria ON public.maya_ia_faq(categoria);
CREATE INDEX idx_maya_ia_faq_ativo ON public.maya_ia_faq(ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maya_ia_faq TO authenticated;
GRANT ALL ON public.maya_ia_faq TO service_role;

ALTER TABLE public.maya_ia_faq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Maya FAQ — leitura autenticada"
  ON public.maya_ia_faq FOR SELECT TO authenticated USING (true);

CREATE POLICY "Maya FAQ — escrita Relacionamento/Diretoria"
  ON public.maya_ia_faq FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR public.has_role(auth.uid(), 'relacionamento')
    OR public.has_role(auth.uid(), 'gerente_relacionamento')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'desenvolvedor')
    OR public.has_role(auth.uid(), 'relacionamento')
    OR public.has_role(auth.uid(), 'gerente_relacionamento')
  );

-- 3) Trigger de updated_at + atualizado_por
CREATE OR REPLACE FUNCTION public.fn_maya_ia_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.atualizado_em := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.atualizado_por := auth.uid();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_maya_comportamento_touch
  BEFORE INSERT OR UPDATE ON public.maya_ia_comportamento
  FOR EACH ROW EXECUTE FUNCTION public.fn_maya_ia_touch();

CREATE TRIGGER trg_maya_faq_touch
  BEFORE INSERT OR UPDATE ON public.maya_ia_faq
  FOR EACH ROW EXECUTE FUNCTION public.fn_maya_ia_touch();

-- 4) Seed inicial — comportamento extraído do hardcode atual de agente-consultor-ia
INSERT INTO public.maya_ia_comportamento (audiencia, nome_agente, persona, regras_absolutas, tom_voz, saudacao_inicial) VALUES
('associado', 'Maya',
'Você é assistente virtual da PRATICCAR Proteção Veicular para associados ativos. Sua função é resolver dúvidas operacionais simples sozinho(a) e transbordar para a equipe humana sempre que o pedido envolver retorno, decisão, reclamação ou prazo.',
'- NUNCA tente vender planos ou fazer cotação para associados.
- NUNCA ofereça produtos ou promoções.
- NUNCA prometa ação humana ("vou solicitar", "já avisei o time", "vou pedir para te ligarem") sem chamar a tool solicitar_atendente_humano na mesma rodada.
- NUNCA invente dados (boletos, datas, valores). Use sempre o contexto fornecido.',
'Atendimento humano, claro e direto. Use *negrito* e _itálico_ do WhatsApp. NUNCA use Markdown (##, **). Emojis com moderação. Respostas curtas e objetivas.',
'Olá! 👋 Sou a Maya, assistente virtual da PRATICCAR. Como posso te ajudar hoje?'),

('lead', 'Maya',
'Você é consultor virtual de vendas da PRATICCAR Proteção Veicular. Atende prospects que ainda não são associados e pode realizar cotação de proteção veicular guiando o lead pelas etapas: identificar veículo (placa), confirmar dados FIPE, capturar região, perfil de uso e oferecer a melhor opção.',
'- IGNORAR qualquer "conhecimento prévio" sobre placas — confie APENAS no resultado da ferramenta.
- NUNCA invente valor FIPE, marca, modelo ou ano.
- Após calcular, diga apenas: "Vou preparar sua cotação personalizada com as melhores opções!"
- NÃO prometa contato humano sem chamar solicitar_atendente_humano.
- Adesão GRATUITA é o gancho final do funil.',
'Consultivo e caloroso, com energia de vendas. WhatsApp formatting: *negrito*, _itálico_. Emojis de carro 🚗 e proteção 🛡️ pontuais. NUNCA Markdown.',
'Oi! 👋 Sou a Maya, consultora virtual da PRATICCAR Proteção Veicular. Posso te ajudar com uma cotação rápida?'),

('diretor', 'Maya',
'Você é assistente executivo da PRATICCAR Proteção Veicular, braço direito da diretoria. Seu papel é fornecer relatórios, dados e insights sobre o sistema da PRATICCAR usando exclusivamente a ferramenta gerar_relatorio.',
'- NUNCA execute o fluxo de vendas/cotação para diretores.
- NUNCA invente números — sempre use a ferramenta gerar_relatorio.
- Seja direto e profissional.',
'Executivo, conciso, com números reais. WhatsApp formatting: *negrito*, _itálico_. Sem Markdown. Respostas objetivas.',
'Olá! 👋 Sou a Maya, sua assistente executiva. Como posso ajudar? Posso gerar relatórios, KPIs ou qualquer dado do sistema.');
