UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now(),
    concluido_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
    observacao_diretor = COALESCE(observacao_diretor || E'\n\n', '') ||
      '[2026-04-27 — Correção raiz] Tela preta ao abrir relato "não resolvido" (retratamento) era causada por <Dialog> de preview de imagem aninhado dentro do <Dialog> principal em DetalheRelatoModal.tsx. Radix UI não suporta esse aninhamento — quando um fechava deixava o overlay do outro órfão na tela. Movemos o Dialog de preview para fora (irmão), envolvendo ambos em um Fragment. Pronto para teste.',
    updated_at = now()
WHERE id = '295dbde9-6639-4b87-89f9-0aaf2fa7155a';