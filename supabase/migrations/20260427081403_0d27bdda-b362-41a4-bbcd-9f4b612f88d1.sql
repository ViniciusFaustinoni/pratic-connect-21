
UPDATE public.error_reports
SET status = 'concluido',
    observacao_diretor = 'Dashboard do vendedor agora é escopado por vendedor_id (KPIs, leads, contratos, funil). Validar logando como vendedor não-gestor.',
    tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
    tratado_em = COALESCE(tratado_em, now()),
    concluido_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
    concluido_em = now(),
    updated_at = now()
WHERE id = 'fd943423-8bc6-4b65-8a30-2e4dd16b77c2';

UPDATE public.error_reports
SET status = 'concluido',
    observacao_diretor = 'Adicionada coluna cotacoes.tipo_entrada + backfill; useCotacao grava direto e contrato-gerar lê a coluna (com fallback). Cotações de substituição não viram mais nova venda.',
    tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
    tratado_em = COALESCE(tratado_em, now()),
    concluido_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
    concluido_em = now(),
    updated_at = now()
WHERE id = '2ef68bde-a080-4478-9eff-5c224cdbf846';

UPDATE public.error_reports
SET status = 'concluido',
    observacao_diretor = 'Adicionado step obrigatório de vínculo de rastreador (IMEI) na vistoria quando o veículo exige. Hook persiste rastreador_id em veículo/instalação e trigger conclui a instalação automaticamente.',
    concluido_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
    concluido_em = now(),
    updated_at = now()
WHERE id = 'a4578f89-697f-4bf7-9ed8-e422f5457b27';

UPDATE public.error_reports
SET status = 'descartado',
    motivo_descarte = 'Conteúdo de teste',
    descartado_em = now(),
    descartado_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
    updated_at = now()
WHERE id IN (
  '5c5e9e4a-3949-4569-892a-e1ea3cd93944',
  'b1a87eaa-71c6-4c85-97b7-d7910121d1fe'
);

UPDATE public.error_reports
SET status = 'descartado',
    motivo_descarte = 'Já validado em produção',
    descartado_em = now(),
    descartado_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
    updated_at = now()
WHERE id = 'ac275108-c213-47bc-90d6-fe0046f4fc89';
