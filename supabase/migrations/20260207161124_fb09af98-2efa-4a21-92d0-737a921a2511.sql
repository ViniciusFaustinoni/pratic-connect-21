-- Permitir chamados de assistência sem associado cadastrado (modo manual)
ALTER TABLE public.chamados_assistencia 
ALTER COLUMN associado_id DROP NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.chamados_assistencia.associado_id IS 
'ID do associado. Pode ser NULL para chamados manuais (clientes não cadastrados)';