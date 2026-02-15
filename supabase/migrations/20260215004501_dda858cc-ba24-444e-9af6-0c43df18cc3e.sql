
ALTER TABLE public.processos_audiencias
  ADD COLUMN IF NOT EXISTS modalidade varchar DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS forum varchar,
  ADD COLUMN IF NOT EXISTS vara varchar,
  ADD COLUMN IF NOT EXISTS sala varchar,
  ADD COLUMN IF NOT EXISTS endereco_completo text,
  ADD COLUMN IF NOT EXISTS advogado_id uuid REFERENCES advogados(id),
  ADD COLUMN IF NOT EXISTS juiz_orgao varchar,
  ADD COLUMN IF NOT EXISTS testemunhas_lista jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS documentos_necessarios jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS resultado_tipo varchar,
  ADD COLUMN IF NOT EXISTS resultado_valor numeric,
  ADD COLUMN IF NOT EXISTS resultado_condicoes text,
  ADD COLUMN IF NOT EXISTS resultado_prazo_pagamento date,
  ADD COLUMN IF NOT EXISTS resultado_prazo_recurso date,
  ADD COLUMN IF NOT EXISTS resultado_nova_data timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_motivo_adiamento text,
  ADD COLUMN IF NOT EXISTS resultado_resumo text,
  ADD COLUMN IF NOT EXISTS prazo_automatico_criado boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS registrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS registrado_por uuid;

-- Index for performance on common queries
CREATE INDEX IF NOT EXISTS idx_audiencias_data_hora ON public.processos_audiencias(data_hora);
CREATE INDEX IF NOT EXISTS idx_audiencias_status ON public.processos_audiencias(status);
CREATE INDEX IF NOT EXISTS idx_audiencias_advogado ON public.processos_audiencias(advogado_id);
