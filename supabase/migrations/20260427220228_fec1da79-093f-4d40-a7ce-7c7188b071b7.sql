UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = COALESCE(observacao_diretor, '') ||
      E'\n[2026-04-27] Causa raiz: o critério para mostrar o botão "Reativar" só considerava cobranças vencidas (cobrancas.status=vencido). Casos com veiculos.cobertura_suspensa=true (suspensão por 48h sem instalação ou suspensão manual) ou associados.bloqueado=true com status=ativo NÃO disparavam o botão. Corrigido em useInadimplenciaPorVeiculo (passa a incluir veículos com cobertura_suspensa=true) e no AssociadoHeroHeader (também considera associado.bloqueado). Pronto para teste.',
    updated_at = now()
WHERE id = '2afd4df1-6c6c-4036-b7e2-dbe9aaa35760';