UPDATE public.contratos
SET cadastro_aprovado = false, aprovado_em = NULL, aprovado_por = NULL, documentos_aprovados_em = NULL
WHERE id = '68a8f28f-9251-4d48-be71-dbc75e70e3d0';

UPDATE public.cotacoes
SET status_contratacao = 'aguardando_aprovacao_cadastro'
WHERE id = 'fe7e833c-5d0b-49ab-9307-91346bc47758';