UPDATE public.asaas_cobrancas
SET invoice_url = 'https://www.asaas.com/i/fzap7eptk36ird03',
    status = 'RECEIVED',
    forma_pagamento = 'PIX',
    updated_at = now()
WHERE id = 'a813af2c-740c-4fab-aaf3-8b7052668a63';