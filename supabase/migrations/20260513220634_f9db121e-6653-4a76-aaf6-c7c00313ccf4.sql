-- Reset cotação de teste de troca de titularidade para o passo Pagamento
UPDATE public.cotacoes
SET status_contratacao = 'contrato_assinado',
    updated_at = now()
WHERE id = 'd66e2a78-a3c8-4839-bfa7-742bcd7c2b5b'
  AND dados_extras->>'tipo_entrada' = 'troca_titularidade';