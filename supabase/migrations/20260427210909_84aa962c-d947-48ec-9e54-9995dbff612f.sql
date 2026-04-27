UPDATE error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = COALESCE(observacao_diretor, '') ||
      E'\n[2026-04-27] Corrigido: edge function gerar-link-prestador estava tentando inserir coluna inexistente vistoriador_prestador_id em instalacao_prestador_links. Agora sempre usa prestador_id (paridade com o schema da tabela).',
    updated_at = now()
WHERE status IN ('aberto','em_tratamento')
  AND (descricao ILIKE '%atribuir%prestador%'
       OR descricao ILIKE '%non-2xx%prestador%'
       OR descricao ILIKE '%gerar%link%prestador%');