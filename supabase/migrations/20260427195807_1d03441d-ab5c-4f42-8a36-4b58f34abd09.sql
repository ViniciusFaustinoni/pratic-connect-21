UPDATE public.error_reports
SET status = 'em_tratamento',
    tratado_em = COALESCE(tratado_em, now()),
    tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
    observacao_diretor = 'Causa raiz: sobreposição de overlays do Radix (Sheet z-1100 + AlertDialog z-1200) em "Testar correções" deixava o body com pointer-events bloqueado em alguns navegadores, dando a impressão de tela travada/preta. Correção aplicada: ao clicar em "Não foi resolvido" o Sheet agora fecha automaticamente antes do AlertDialog aparecer; ao cancelar, o Sheet reabre. Pronto para teste.'
WHERE id = '295dbde9-6639-4b87-89f9-0aaf2fa7155a';