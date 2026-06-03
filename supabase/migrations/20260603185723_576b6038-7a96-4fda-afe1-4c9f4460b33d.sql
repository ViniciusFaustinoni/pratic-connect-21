-- Backfill: palavras-chave da pronta resposta de Assistência 24h
-- (estava vazia, fazendo a IA não casar "reboque/guincho/pane" com a FAQ).
UPDATE public.maya_ia_faq
SET palavras_chave = ARRAY['reboque','guincho','pane','socorro','assistencia','assistência','24h','24 horas','roubo','furto','colisao','colisão','batida','chaveiro','bateria','pneu']
WHERE id = '2e06c7c6-a89b-4f96-9e98-7453ed7b49f2'
  AND (palavras_chave IS NULL OR palavras_chave = ARRAY[]::text[]);