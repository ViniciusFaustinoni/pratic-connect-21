UPDATE public.servicos
SET status = 'agendada',
    etapa_atual = 4,
    updated_at = now()
WHERE id = '39a5b00d-691c-40e6-ba1c-981f34d8d8e0';