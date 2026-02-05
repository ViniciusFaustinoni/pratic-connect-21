-- Adicionar coluna de regiões de atendimento (array de UUIDs referenciando a tabela regioes)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS regioes_atendimento UUID[] DEFAULT '{}';

-- Adicionar coluna de capacidade diária de tarefas
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS capacidade_diaria INTEGER DEFAULT 5;

-- Comentários explicativos
COMMENT ON COLUMN public.profiles.regioes_atendimento IS 'IDs das regiões que o profissional atende (para instaladores/vistoriadores)';
COMMENT ON COLUMN public.profiles.capacidade_diaria IS 'Quantidade máxima de tarefas que o profissional pode realizar por dia';