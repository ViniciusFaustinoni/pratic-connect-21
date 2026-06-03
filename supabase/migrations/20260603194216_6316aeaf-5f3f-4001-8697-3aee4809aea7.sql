
UPDATE public.vistorias
SET status = 'concluida',
    concluida_em = COALESCE(concluida_em, now()),
    updated_at = now()
WHERE id IN (
  '54df07b9-a15d-4650-b063-5bf5ae69b8c7',
  'b5bd0872-e9cf-4451-9c1b-ce357537a425'
);

INSERT INTO public.sga_sync_queue (veiculo_id, associado_id, status, tentativas, proximo_reenvio_em, erro_ultimo, etapa_parou, origem)
VALUES
  ('4ab72263-1095-477a-aa46-244edd372560', 'b96ba63f-c91c-47b2-983b-85bab21aabf1', 'pendente', 0, now(), 'reenfileirado_saneamento_fotos_vistoria', 'saneamento_fotos_vistoria_cancelada', 'saneamento_manual'),
  ('97530643-05bd-4d22-a4e2-c445bb2a85b2', '5e60854a-0779-43db-b4d0-ea26d26d98a3', 'pendente', 0, now(), 'reenfileirado_saneamento_fotos_vistoria', 'saneamento_fotos_vistoria_cancelada', 'saneamento_manual')
ON CONFLICT DO NOTHING;

UPDATE public.sga_sync_queue
SET status = 'pendente',
    proximo_reenvio_em = now(),
    erro_ultimo = 'reenfileirado_saneamento_fotos_vistoria',
    etapa_parou = 'saneamento_fotos_vistoria_cancelada'
WHERE veiculo_id IN (
  '4ab72263-1095-477a-aa46-244edd372560',
  '97530643-05bd-4d22-a4e2-c445bb2a85b2'
) AND status <> 'pendente';

INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, dados_novos)
VALUES
  ('vistorias', '54df07b9-a15d-4650-b063-5bf5ae69b8c7', 'criar',
   '[SANEAMENTO] LQD7A71: vistoria autovistoria promovida cancelada→concluida para liberar 34 fotos físicas ao SGA Hinova',
   jsonb_build_object('placa','LQD7A71','fotos',34,'motivo','autovistoria_substituida_por_presencial_preservar_fotos','acao_real','update_vistoria_status')),
  ('vistorias', 'b5bd0872-e9cf-4451-9c1b-ce357537a425', 'criar',
   '[SANEAMENTO] LTY4F25: vistoria autovistoria promovida cancelada→concluida para liberar 32 fotos físicas ao SGA Hinova',
   jsonb_build_object('placa','LTY4F25','fotos',32,'motivo','autovistoria_substituida_por_presencial_preservar_fotos','acao_real','update_vistoria_status'));
