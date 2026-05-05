
UPDATE public.rastreadores
SET veiculo_id = 'f8d29a76-af70-496b-9078-bf67e36dc0e3',
    associado_id = 'd4138660-d5c7-40fe-bfdb-041a9588c589',
    status = 'instalado'::status_rastreador,
    updated_at = now()
WHERE id = '1b4b73e6-b330-4d0d-9d32-59502fb8f041';
