
-- ── Separação canônica por habilidade ────────────────────────────────────────
-- Objetivo:
--   1. Cada habilidade vira configuração fechada (apresentacao + instrucoes
--      próprios + FAQ próprio + exemplos próprios), sem vazamento.
--   2. Conteúdo aplicável a múltiplas audiências vira CÓPIAS independentes
--      por habilidade — editar uma nunca afeta a outra.
--   3. Legado (agente_ia_config / maya_ia_*) preservado como backup.
--      O agente passa a ler exclusivamente das tabelas ia_habilidade_*.

-- 1. Colunas editoriais por habilidade (substituem agente_ia_config global)
ALTER TABLE public.ia_habilidades
  ADD COLUMN IF NOT EXISTS apresentacao_inicial text,
  ADD COLUMN IF NOT EXISTS instrucoes_comportamento text;

COMMENT ON COLUMN public.ia_habilidades.apresentacao_inicial IS
  'Apresentação inicial da habilidade (1ª mensagem). Substitui o legado agente_ia_config.apresentacao_inicial — agora por habilidade, sem vazamento entre vendas/relacionamento.';
COMMENT ON COLUMN public.ia_habilidades.instrucoes_comportamento IS
  'Instruções gerais de comportamento da habilidade. Substitui o legado agente_ia_config.instrucoes_comportamento.';

-- 2. Backfill apresentacao/instrucoes — só onde a habilidade está vazia
--    (não sobrescreve ajustes recentes feitos via UI).
WITH cfg AS (
  SELECT
    max(valor) FILTER (WHERE chave = 'apresentacao_inicial')      AS apresentacao,
    max(valor) FILTER (WHERE chave = 'instrucoes_comportamento')  AS instrucoes
  FROM public.agente_ia_config
)
UPDATE public.ia_habilidades h SET
  apresentacao_inicial = COALESCE(NULLIF(h.apresentacao_inicial, ''), c.apresentacao),
  instrucoes_comportamento = COALESCE(NULLIF(h.instrucoes_comportamento, ''), c.instrucoes)
FROM cfg c
WHERE h.slug = 'relacionamento'
  AND (h.apresentacao_inicial IS NULL OR h.apresentacao_inicial = ''
       OR h.instrucoes_comportamento IS NULL OR h.instrucoes_comportamento = '');

-- vendas: herda apresentacao/instrucoes do mesmo legado (backup operacional)
WITH cfg AS (
  SELECT
    max(valor) FILTER (WHERE chave = 'apresentacao_inicial')      AS apresentacao,
    max(valor) FILTER (WHERE chave = 'instrucoes_comportamento')  AS instrucoes
  FROM public.agente_ia_config
)
UPDATE public.ia_habilidades h SET
  apresentacao_inicial = COALESCE(NULLIF(h.apresentacao_inicial, ''), c.apresentacao),
  instrucoes_comportamento = COALESCE(NULLIF(h.instrucoes_comportamento, ''), c.instrucoes)
FROM cfg c
WHERE h.slug = 'vendas'
  AND (h.apresentacao_inicial IS NULL OR h.apresentacao_inicial = ''
       OR h.instrucoes_comportamento IS NULL OR h.instrucoes_comportamento = '');

-- 3. Backfill editorial (persona/regras/tom/saudacao) — só onde estiver vazio.
--    relacionamento ← maya_ia_comportamento(audiencia='associado')  (base canônica da receptiva)
UPDATE public.ia_habilidades h SET
  persona            = COALESCE(NULLIF(h.persona,''),            m.persona),
  regras_absolutas   = COALESCE(NULLIF(h.regras_absolutas,''),   m.regras_absolutas),
  tom_voz            = COALESCE(NULLIF(h.tom_voz,''),            m.tom_voz),
  saudacao_inicial   = COALESCE(NULLIF(h.saudacao_inicial,''),   m.saudacao_inicial)
FROM public.maya_ia_comportamento m
WHERE h.slug = 'relacionamento' AND m.audiencia = 'associado';

--    vendas ← maya_ia_comportamento(audiencia='lead')  (preservado para futuro religar)
UPDATE public.ia_habilidades h SET
  persona            = COALESCE(NULLIF(h.persona,''),            m.persona),
  regras_absolutas   = COALESCE(NULLIF(h.regras_absolutas,''),   m.regras_absolutas),
  tom_voz            = COALESCE(NULLIF(h.tom_voz,''),            m.tom_voz),
  saudacao_inicial   = COALESCE(NULLIF(h.saudacao_inicial,''),   m.saudacao_inicial)
FROM public.maya_ia_comportamento m
WHERE h.slug = 'vendas' AND m.audiencia = 'lead';

-- 4. Backfill FAQ → ia_habilidade_conhecimento (cópias independentes por habilidade).
--    Toda FAQ cuja audiencias[] contenha 'associado' OU 'lead' vira UMA linha
--    independente em CADA habilidade que serve essa audiência. Dedupe por
--    (habilidade_slug, categoria, pergunta) para idempotência.
--    NUNCA migra FAQ exclusivamente 'diretor' (premissa do plano).

-- relacionamento atende lead+associado+diretor; pega audiencias com associado OU lead
INSERT INTO public.ia_habilidade_conhecimento
  (habilidade_slug, categoria, pergunta, resposta, palavras_chave, ordem, ativo, revisar)
SELECT
  'relacionamento',
  COALESCE(f.categoria, 'geral'),
  f.pergunta,
  f.resposta,
  COALESCE(f.palavras_chave, ARRAY[]::text[]),
  COALESCE(f.ordem, 0),
  f.ativo,
  false
FROM public.maya_ia_faq f
WHERE f.ativo = true
  AND (f.audiencias && ARRAY['associado','lead']::text[])
  AND NOT EXISTS (
    SELECT 1 FROM public.ia_habilidade_conhecimento k
    WHERE k.habilidade_slug = 'relacionamento'
      AND k.categoria = COALESCE(f.categoria,'geral')
      AND k.pergunta = f.pergunta
  );

-- vendas atende lead; copia FAQs que incluem 'lead' (cópias independentes — backup)
INSERT INTO public.ia_habilidade_conhecimento
  (habilidade_slug, categoria, pergunta, resposta, palavras_chave, ordem, ativo, revisar)
SELECT
  'vendas',
  COALESCE(f.categoria, 'geral'),
  f.pergunta,
  f.resposta,
  COALESCE(f.palavras_chave, ARRAY[]::text[]),
  COALESCE(f.ordem, 0),
  f.ativo,
  false
FROM public.maya_ia_faq f
WHERE f.ativo = true
  AND ('lead' = ANY(f.audiencias))
  AND NOT EXISTS (
    SELECT 1 FROM public.ia_habilidade_conhecimento k
    WHERE k.habilidade_slug = 'vendas'
      AND k.categoria = COALESCE(f.categoria,'geral')
      AND k.pergunta = f.pergunta
  );

-- 5. Regra absoluta de "central de direcionamento" para a receptiva.
--    Só APPENDA se a frase chave ainda não está no texto (idempotente).
UPDATE public.ia_habilidades
SET regras_absolutas = COALESCE(regras_absolutas,'') ||
  E'\n\n[Central de direcionamento]\n'
  || 'Pedidos fora do escopo da receptiva (cotação de novo veículo, novo plano, '
  || 'assuntos comerciais, RH, imprensa, etc.) NUNCA são executados aqui e NÃO '
  || 'são transbordados para atendente humano como primeira opção. Direcione o '
  || 'cliente usando a mensagem/link/contato cadastrado na categoria '
  || '"direcionamento" da BASE DE CONHECIMENTO. Se a categoria não tiver destino '
  || 'ativo para o caso, AÍ SIM ofereça transbordo.'
WHERE slug = 'relacionamento'
  AND COALESCE(regras_absolutas,'') NOT LIKE '%[Central de direcionamento]%';

-- 6. Seeds de direcionamento — TODOS inativos por padrão.
--    Política aprovada: só popular ativo com destino REAL confirmado.
--    Como nenhum link/contato foi confirmado nesta entrega (a memória de
--    app.praticcar.org NÃO confirma o link de cotação, que em produção é
--    cotacao.praticcar.com.br), todos entram ativo=false para o time preencher
--    em /relacionamento/config-ia. A regra de comportamento (item 5) já está
--    em vigor independente dos destinos.
INSERT INTO public.ia_habilidade_conhecimento
  (habilidade_slug, categoria, pergunta, resposta, palavras_chave, ordem, ativo, revisar)
SELECT * FROM (VALUES
  ('relacionamento','direcionamento',
   'Cotação de novo veículo / novo plano',
   '[PREENCHER DESTINO REAL] Quando o cliente pedir cotação para outro veículo ou novo plano, responder com o link oficial do cotador (produção: cotacao.praticcar.com.br) ou o contato comercial cadastrado. NÃO inventar URL.',
   ARRAY['cotação','cotar','novo veículo','outro carro','outra moto','novo plano','plano para outro'],
   10, false, true),
  ('relacionamento','direcionamento',
   'Indicação de amigo / programa de indicação',
   '[PREENCHER DESTINO REAL] Quando o cliente quiser indicar alguém, responder com o link/explicação oficial do programa de indicação.',
   ARRAY['indicar','indicação','amigo','programa de indicação'],
   20, false, true),
  ('relacionamento','direcionamento',
   'Trabalhe conosco / RH / vagas',
   '[PREENCHER DESTINO REAL] Quando o contato for sobre vagas, currículo ou trabalho, direcionar para o canal/email do RH.',
   ARRAY['vaga','trabalhar','rh','currículo','curriculo','emprego'],
   30, false, true),
  ('relacionamento','direcionamento',
   'Imprensa / parcerias',
   '[PREENCHER DESTINO REAL] Quando o contato for de imprensa ou parceria comercial, direcionar para o canal/email responsável.',
   ARRAY['imprensa','jornalista','parceria','parceiro','assessoria'],
   40, false, true),
  ('relacionamento','direcionamento',
   'Ouvidoria / reclamação formal',
   '[PREENCHER DESTINO REAL] Quando o cliente pedir ouvidoria ou reclamação formal, direcionar para o canal oficial de ouvidoria.',
   ARRAY['ouvidoria','reclamação formal','procon','denúncia'],
   50, false, true)
) AS s(habilidade_slug, categoria, pergunta, resposta, palavras_chave, ordem, ativo, revisar)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ia_habilidade_conhecimento k
  WHERE k.habilidade_slug = s.habilidade_slug
    AND k.categoria = s.categoria
    AND k.pergunta = s.pergunta
);

-- 7. Marcadores DEPRECATED (não remove — backup obrigatório).
COMMENT ON TABLE public.agente_ia_config IS
  'DEPRECATED (04/06/26). Migrado para ia_habilidades.{apresentacao_inicial,instrucoes_comportamento}. Mantido como backup; o agente NÃO lê mais daqui em runtime.';
COMMENT ON TABLE public.maya_ia_comportamento IS
  'DEPRECATED (04/06/26). Migrado para ia_habilidades (persona/regras/tom/saudacao por slug). Backup.';
COMMENT ON TABLE public.maya_ia_faq IS
  'DEPRECATED (04/06/26). Migrado para ia_habilidade_conhecimento (cópias independentes por habilidade). Backup.';
