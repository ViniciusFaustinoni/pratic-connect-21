-- Reabrir instalação do EDGAR DA SILVA SANTOS (TUM3D59) para Wallace executar fluxo completo
UPDATE public.vistorias 
SET status = 'em_analise', updated_at = now()
WHERE id = '79b80d0e-e31a-4fd1-8bc8-b15bd116d633';

UPDATE public.servicos 
SET tipo = 'instalacao',
    status = 'em_andamento',
    etapa_atual = 4,
    concluida_em = NULL,
    updated_at = now()
WHERE id = '70abc44a-8004-4b41-a468-4ead8d796b07';