BEGIN;

-- 1. Cancela instalação fictícia do Ícaro (dispensa_rastreador=true acima da FIPE)
UPDATE public.instalacoes
   SET status = 'cancelada',
       updated_at = now()
 WHERE id = 'a94dcfbd-1169-4d9f-8b30-931d0d10ff83'
   AND status = 'concluida'
   AND dispensa_rastreador = true;

UPDATE public.servicos
   SET status = 'cancelada',
       observacoes_analise = COALESCE(observacoes_analise, '') ||
         ' [BACKFILL] Servico de instalação anulado: dispensa_rastreador=true gerado indevidamente para veículo acima da FIPE.'
 WHERE instalacao_origem_id = 'a94dcfbd-1169-4d9f-8b30-931d0d10ff83'
    OR (cotacao_id = '5ce27b52-f2cd-48b9-9efb-07680c5cd39f' AND tipo = 'instalacao' AND status = 'concluida');

-- 2. Rebaixa para 'aprovada' as autovistorias indevidamente concluídas
UPDATE public.servicos s
   SET status = 'aprovada',
       concluida_em = NULL,
       analisado_em = COALESCE(s.analisado_em, now()),
       observacoes_analise = COALESCE(s.observacoes_analise, '') ||
         ' [BACKFILL] Rebaixado de concluida→aprovada: autovistoria opcional acima da FIPE não substitui instalação técnica.'
 WHERE s.id IN (
   '5c63c4fe-84bd-4c20-bfa4-9d84be8be705',
   'ff85de97-f47e-419d-9406-a8f578ac2e30',
   'ad135dfa-5d79-4bfe-85d1-bf04a7082f8f',
   'f7f34d8d-5523-40b8-9ae6-02f0729d1c8e',
   '5de084dc-22c8-41a8-a861-be6230582fdd',
   '6ab1d999-a2ec-4eb8-8edd-94e1de2dcb38'
 )
   AND s.status = 'concluida'
   AND s.tipo = 'vistoria_entrada';

-- 3. Auditoria
INSERT INTO public.logs_auditoria (acao, modulo, tabela, descricao)
VALUES (
  'editar',
  'monitoramento',
  'servicos',
  'Backfill autovistoria-acima-FIPE: rebaixou autovistorias concluida→aprovada (Caio, Francisco, Romario, Icaro, Rian) e cancelou instalação fictícia dispensa_rastreador do Icaro. Cobertura R/F preservada.'
);

COMMIT;