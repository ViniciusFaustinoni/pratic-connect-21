-- Hotfix RVZ8J79 / IVAN GOMES DIAS
-- Reabre a autovistoria da cotação COT-20260601-162322366-662 zerando
-- vistoria_concluida_em. Após esta migration o roteador do link público
-- devolve o cliente para a etapa de Autovistoria/Análise (em vez de
-- empurrar para Agendar Instalação). Sem regravar vídeo, sem alterar
-- status_contratacao, sem mexer em documentos_solicitados.
UPDATE public.cotacoes
SET vistoria_concluida_em = NULL,
    updated_at = now()
WHERE id = 'cabedc1d-81e6-4d30-a111-320cfd9f5c86'
  AND vistoria_concluida_em IS NOT NULL;