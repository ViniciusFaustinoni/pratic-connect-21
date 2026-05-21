
DO $$
DECLARE
  v_assoc uuid[] := ARRAY[
    'de5f0d04-2e69-464d-b681-98e7bc03dfc4'::uuid,
    '9c05d3c4-ad93-47d6-88ff-f793959fae7d'::uuid
  ];
  v_veic  uuid := 'd5181403-22c0-4f2a-b22e-b6e7d821376c'::uuid;
  v_user  uuid := 'f8bcd79c-e1f8-4f8d-aba2-11648c6b542e'::uuid;
  v_contratos uuid[];
  v_cotacoes  uuid[];
  v_instalac  uuid[];
  v_vistorias uuid[];
  v_servicos  uuid[];
BEGIN
  SET LOCAL session_replication_role = 'replica';

  SELECT COALESCE(array_agg(id), '{}') INTO v_contratos FROM contratos WHERE associado_id = ANY(v_assoc);
  SELECT COALESCE(array_agg(id), '{}') INTO v_cotacoes  FROM cotacoes
   WHERE cliente_cpf IN ('12493649737','14194896742') OR contrato_gerado_id = ANY(v_contratos);
  SELECT COALESCE(array_agg(id), '{}') INTO v_instalac  FROM instalacoes
   WHERE veiculo_id = v_veic OR contrato_id = ANY(v_contratos);
  SELECT COALESCE(array_agg(id), '{}') INTO v_vistorias FROM vistorias
   WHERE veiculo_id = v_veic OR associado_id = ANY(v_assoc)
      OR contrato_id = ANY(v_contratos) OR instalacao_id = ANY(v_instalac);
  SELECT COALESCE(array_agg(id), '{}') INTO v_servicos  FROM servicos
   WHERE veiculo_id = v_veic OR associado_id = ANY(v_assoc) OR contrato_id = ANY(v_contratos);

  UPDATE rastreadores
     SET veiculo_id = NULL, associado_id = NULL, associado_email = NULL,
         status = 'estoque', updated_at = now()
   WHERE veiculo_id = v_veic OR associado_id = ANY(v_assoc);

  BEGIN DELETE FROM vistoria_fotos WHERE vistoria_id = ANY(v_vistorias); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM cotacoes_vistoria_fotos WHERE cotacao_id = ANY(v_cotacoes); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM servicos_atribuicoes WHERE servico_id = ANY(v_servicos); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM agendamentos_base
         WHERE instalacao_id = ANY(v_instalac)
            OR vistoria_id   = ANY(v_vistorias)
            OR cotacao_id    = ANY(v_cotacoes);
        EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM vistorias   WHERE id = ANY(v_vistorias); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM servicos    WHERE id = ANY(v_servicos);  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM instalacoes WHERE id = ANY(v_instalac);  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM contratos_documentos  WHERE contrato_id = ANY(v_contratos); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM contratos_assinaturas WHERE contrato_id = ANY(v_contratos); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM cobrancas             WHERE contrato_id = ANY(v_contratos); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM solicitacoes_troca_titularidade
         WHERE associado_antigo_id = ANY(v_assoc) OR novo_associado_id = ANY(v_assoc) OR veiculo_id = v_veic;
        EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM sga_sync_queue
         WHERE associado_id = ANY(v_assoc) OR veiculo_id = v_veic OR contrato_id = ANY(v_contratos);
        EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM sga_fotos_enviadas
         WHERE associado_id = ANY(v_assoc) OR veiculo_id = v_veic;
        EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  BEGIN DELETE FROM cotacoes_documentos WHERE cotacao_id = ANY(v_cotacoes); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  UPDATE cotacoes SET contrato_gerado_id = NULL WHERE id = ANY(v_cotacoes);
  DELETE FROM contratos WHERE id = ANY(v_contratos);
  DELETE FROM cotacoes  WHERE id = ANY(v_cotacoes);
  BEGIN DELETE FROM historico_status_associado WHERE associado_id = ANY(v_assoc); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  DELETE FROM veiculos   WHERE id = v_veic;
  DELETE FROM associados WHERE id = ANY(v_assoc);
  BEGIN DELETE FROM user_roles WHERE user_id = v_user; EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;
  DELETE FROM profiles   WHERE user_id = v_user OR id = v_user;
  DELETE FROM auth.users WHERE id = v_user;
END $$;
