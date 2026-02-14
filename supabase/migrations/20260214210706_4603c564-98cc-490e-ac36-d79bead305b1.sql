
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS parte_contraria_tipo varchar DEFAULT 'pessoa_fisica',
  ADD COLUMN IF NOT EXISTS parte_contraria_telefone varchar,
  ADD COLUMN IF NOT EXISTS instancia varchar DEFAULT '1a_instancia',
  ADD COLUMN IF NOT EXISTS prioridade varchar DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS origem varchar DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS decisao varchar,
  ADD COLUMN IF NOT EXISTS decisao_observacoes text,
  ADD COLUMN IF NOT EXISTS decisao_valor numeric,
  ADD COLUMN IF NOT EXISTS decisao_parcelas integer,
  ADD COLUMN IF NOT EXISTS decisao_prazo_recurso date,
  ADD COLUMN IF NOT EXISTS decisao_registrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS decisao_registrada_por uuid REFERENCES auth.users(id);
