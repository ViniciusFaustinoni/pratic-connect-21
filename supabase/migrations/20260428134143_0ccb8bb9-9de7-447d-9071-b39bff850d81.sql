UPDATE public.sga_sync_queue SET
  status='pendente', tentativas=0, proximo_reenvio_em=now(),
  etapa_parou=NULL,
  erro_ultimo='Resetado pós-fix TDZ — diagnóstico planilha 33 placas'
WHERE veiculo_id IN (
  '8e37166b-aa18-4feb-b8e8-3909a13ef084', -- SRL5G88
  'cb13f693-4c24-42e0-a443-152bd81bd763'  -- TUF2F28 HUGO
);