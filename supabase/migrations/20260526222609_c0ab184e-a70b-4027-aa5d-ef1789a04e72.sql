
UPDATE public.rastreadores
SET status = 'instalado',
    updated_at = now()
WHERE id = '2732f76d-d1fc-4662-a406-7531b67cd9ce'
  AND imei = '354522186314659'
  AND veiculo_id = 'd53acb36-0e8c-4683-8537-0651c724d454'
  AND status = 'estoque';

INSERT INTO public.logs_auditoria (
  acao, modulo, tabela, registro_id, descricao,
  dados_anteriores, dados_novos, created_at
)
VALUES (
  'editar',
  'rastreadores',
  'rastreadores',
  '2732f76d-d1fc-4662-a406-7531b67cd9ce',
  '[CORRECAO_RESIDUO_ROLLBACK_KPJ4994] Rastreador IMEI 354522186314659 voltou para status=instalado. Vínculo físico ao veículo KPJ4994 (d53acb36) nunca mudou; status estoque era resíduo do rollback da troca de titularidade Gabriel→Anderson (cotação COT-20260525-162758561-177). Próximo passo: rede-veiculos-vincular-cliente.',
  jsonb_build_object('status','estoque'),
  jsonb_build_object('status','instalado','imei','354522186314659','placa','KPJ4994','associado_id','5f51682f-7be6-45c5-baf2-b695711ddf3a','motivo','residuo_rollback_troca_titularidade'),
  now()
);
