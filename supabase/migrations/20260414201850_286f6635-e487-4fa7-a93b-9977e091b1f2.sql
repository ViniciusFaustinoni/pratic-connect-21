UPDATE public.agente_ia_contatos 
SET status = 'novo', 
    dados_cotacao = NULL, 
    resetado_em = now() 
WHERE id = 'a218c04c-45ac-4bb3-af1d-3e7c5eb43bec';