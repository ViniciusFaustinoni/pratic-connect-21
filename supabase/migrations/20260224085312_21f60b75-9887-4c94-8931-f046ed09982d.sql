
-- Fase 1: Adicionar colunas para bifurcação do fluxo de colisão

-- Destino do reboque
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS destino_reboque_tipo TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS destino_reboque_endereco TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS destino_reboque_oficina_id UUID REFERENCES public.oficinas(id);
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS assistencia_acionada_em TIMESTAMPTZ;

-- Agendamento de regulagem
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS agendamento_regulagem_data TIMESTAMPTZ;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS agendamento_regulagem_local TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS agendamento_regulagem_periodo TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS agendamento_regulagem_obs TEXT;

-- Dados da regulagem
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS regulagem_parecer TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS regulagem_tipo_dano TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS regulagem_concluida_em TIMESTAMPTZ;

-- Orçamento
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS orcamento_oficina_id UUID REFERENCES public.oficinas(id);
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS orcamento_valor_total NUMERIC;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS orcamento_detalhamento JSONB;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS orcamento_prazo_reparo TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS orcamento_status TEXT;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS orcamento_data TIMESTAMPTZ;

-- Entrada na oficina (caminho sem reboque)
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS agendamento_entrada_oficina_data TIMESTAMPTZ;
ALTER TABLE public.sinistros ADD COLUMN IF NOT EXISTS agendamento_entrada_oficina_obs TEXT;
