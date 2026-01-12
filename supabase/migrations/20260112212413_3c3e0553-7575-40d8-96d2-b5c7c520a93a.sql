-- Permitir vistoria avulsa (sem veículo vinculado inicialmente)
ALTER TABLE public.vistorias 
ALTER COLUMN veiculo_id DROP NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.vistorias.veiculo_id IS 'ID do veículo (opcional para vistorias avulsas, será vinculado posteriormente)';