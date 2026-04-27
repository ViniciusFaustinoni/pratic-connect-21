UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = 'Causa raiz definitiva: a edge function gerar-link-vistoriador-prestador (fluxo de vistoria por prestador externo) ainda exigia valor > 0 para criar nova atribuição, mesmo com a UI já tratando o campo como opcional. Corrigido: valor agora é totalmente opcional em todo o fluxo (mapa, aba Atribuição Manual, Painel de Atribuição da instalação e edge function). Quando vazio, o link é gerado sem valor e a operação ajusta depois. Pode testar.',
    updated_at = now()
WHERE id = 'f4d2b5ba-3a2a-4f6c-ae0d-680f99511e05';