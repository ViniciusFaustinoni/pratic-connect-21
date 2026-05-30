INSERT INTO public.vistoria_fotos (vistoria_id, tipo, arquivo_url, created_at)
SELECT
  '8a617730-9cce-4ca9-a1b0-c69f6b529801'::uuid,
  cvf.tipo,
  cvf.arquivo_url,
  cvf.created_at
FROM public.cotacoes_vistoria_fotos cvf
WHERE cvf.cotacao_id = 'fe7e833c-5d0b-49ab-9307-91346bc47758'
  AND NOT EXISTS (
    SELECT 1 FROM public.vistoria_fotos vf
    WHERE vf.vistoria_id = '8a617730-9cce-4ca9-a1b0-c69f6b529801'
      AND vf.tipo = cvf.tipo
  );

INSERT INTO public.logs_auditoria (acao, tabela, registro_id, descricao, dados_novos)
VALUES (
  'criar',
  'vistoria_fotos',
  '8a617730-9cce-4ca9-a1b0-c69f6b529801',
  '[HOTFIX] Materializou fotos faltantes (motor + video_360) de cotacoes_vistoria_fotos para vistoria_fotos. LUIZ FERNANDO / RVP0I41 / contrato 68a8f28f-9251-4d48-be71-dbc75e70e3d0. Desbloqueia sub-etapa 2 do Cadastro.',
  jsonb_build_object('hotfix', true, 'contrato_id', '68a8f28f-9251-4d48-be71-dbc75e70e3d0', 'cotacao_id', 'fe7e833c-5d0b-49ab-9307-91346bc47758')
);