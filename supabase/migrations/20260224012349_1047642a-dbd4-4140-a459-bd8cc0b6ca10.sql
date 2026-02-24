
-- Adicionar telefone_extra na tabela principal
ALTER TABLE public.prestadores_assistencia ADD COLUMN telefone_extra VARCHAR;

-- Adicionar 4 campos na tabela de valores
ALTER TABLE public.prestadores_assistencia_valores ADD COLUMN km_franquia NUMERIC;
ALTER TABLE public.prestadores_assistencia_valores ADD COLUMN hr_trabalhada NUMERIC;
ALTER TABLE public.prestadores_assistencia_valores ADD COLUMN hr_parada NUMERIC;
ALTER TABLE public.prestadores_assistencia_valores ADD COLUMN diaria_base NUMERIC;
