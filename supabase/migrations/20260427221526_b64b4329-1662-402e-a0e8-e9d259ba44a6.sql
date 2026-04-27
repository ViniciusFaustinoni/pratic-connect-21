
UPDATE public.instalacoes
SET instalador_id = NULL,
    instalador_responsavel_id = NULL,
    updated_at = now()
WHERE id = '3a3ce140-fd0b-4960-8bc4-7fbf3e3c8df4';
