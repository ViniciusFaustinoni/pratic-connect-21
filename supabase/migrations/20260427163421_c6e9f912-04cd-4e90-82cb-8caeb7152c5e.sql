UPDATE public.error_reports
SET
  status = 'concluido',
  concluido_em = now(),
  observacao_diretor = COALESCE(observacao_diretor, '') ||
    E'\n\n[Conclusão automática] Funcionalidade implementada: agora é possível alterar a forma de pagamento (PIX, Boleto ou Cartão) de cobranças pendentes, tanto no painel administrativo (Cadastro > Associado > Últimas Faturas > Alterar forma) quanto no app do associado (Boleto > Alterar forma de pagamento). Estratégia: atualização in-place via Asaas API com fallback para cancelar+recriar a cobrança preservando valor e vencimento.',
  updated_at = now()
WHERE id = '4a0a062a-9bac-4007-9b90-1abd6167faca'
  AND status = 'em_tratamento';