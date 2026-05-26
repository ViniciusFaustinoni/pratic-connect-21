
DO $$
DECLARE
  v_rast_id uuid := '7a4b13ab-da6c-4e8f-ab7e-38b8803d8fdb';
  v_veic_id uuid := '55c2f9bc-9c16-4e63-a838-d2fbe143d5aa';
  v_sys_user uuid := '37beadcf-284b-4a2c-88a0-6efa8cae60d9';
BEGIN
  UPDATE public.rastreadores
     SET plataforma = 'rede_veiculos',
         plataforma_device_id = NULL,
         plataforma_veiculo_id = NULL,
         softruck_integration_status = NULL,
         softruck_last_attempt_at = NULL,
         softruck_payload_sent = NULL,
         softruck_response_raw = NULL,
         softruck_chip_id = NULL,
         updated_at = now()
   WHERE id = v_rast_id;

  UPDATE public.veiculos
     SET softruck_vehicle_id = NULL,
         updated_at = now()
   WHERE id = v_veic_id;

  INSERT INTO public.logs_auditoria (usuario_id, acao, tabela, registro_id, descricao, dados_novos)
  VALUES (
    v_sys_user, 'editar', 'rastreadores', v_rast_id,
    '[CORRECAO_PLATAFORMA_RASTREADOR] TUM3D59 / EDGAR — plataforma corrigida de softruck para rede_veiculos. Vínculo físico do IMEI 869412072526525 é na Rede Veículos; registros Softruck (plataforma_device_id=K3VgZ9xApKQ5EYW, plataforma_veiculo_id=grADZV6qk3ZyqOk) eram resíduo do KPX3F78 antigo e foram limpos. Asset Softruck NÃO foi tocado para não bagunçar histórico do KPX3F78.',
    jsonb_build_object('plataforma_antiga','softruck','plataforma_nova','rede_veiculos','imei','869412072526525')
  );

  INSERT INTO public.logs_auditoria (usuario_id, acao, tabela, registro_id, descricao, dados_novos)
  VALUES (
    v_sys_user, 'editar', 'veiculos', v_veic_id,
    '[CORRECAO_PLATAFORMA_RASTREADOR] TUM3D59 — softruck_vehicle_id limpo (grADZV6qk3ZyqOk). Vínculo do rastreador é na Rede Veículos; rede_veiculos_veiculo_id/cliente_id serão preenchidos no próximo sync.',
    jsonb_build_object('softruck_vehicle_id_antigo','grADZV6qk3ZyqOk')
  );
END $$;
