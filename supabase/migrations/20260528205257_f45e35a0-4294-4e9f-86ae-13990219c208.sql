UPDATE public.rastreadores
SET status = 'instalado',
    associado_id = '900f9e27-6d58-4483-b197-94066683b64c',
    updated_at = now()
WHERE imei = '863829079450860'
  AND veiculo_id = '7bbd9ca1-49ec-4be2-957f-cd7fe5804847';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, dados_anteriores, dados_novos, descricao)
VALUES (
  'criar',
  'troca_titularidade',
  'rastreadores',
  'edd92c76-ce58-4f9c-aea8-5e9055c7da7a',
  jsonb_build_object('status','estoque','associado_id','0c43955a-a63e-45a5-884b-c34f7b2e60ea'),
  jsonb_build_object('status','instalado','associado_id','900f9e27-6d58-4483-b197-94066683b64c'),
  '[FALHA_LOG_AUDITORIA] [TROCA-TITULARIDADE-SOFTRUCK-FIX] Promoção manual de rastreador para instalado + reaponte ao novo titular (SRZ2E82 / IMEI 863829079450860)'
);