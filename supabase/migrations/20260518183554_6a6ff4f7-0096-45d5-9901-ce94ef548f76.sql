
DO $$
DECLARE
  v_diretor uuid := '0b78778b-d82c-434b-a981-f8a9f26353b4';  -- profiles.id do Diretor
  v_contratos uuid[] := ARRAY[
    '5be6bc5d-3e76-4fdf-ba33-9b33af058f35'::uuid,  -- ANDRE
    '8641bf11-f0ff-4b8b-954f-6e58ad49c456'::uuid   -- ROMARIO
  ];
  v_associados uuid[];
  v_veiculos uuid[];
BEGIN
  SELECT array_agg(associado_id), array_agg(veiculo_id)
    INTO v_associados, v_veiculos
    FROM contratos WHERE id = ANY(v_contratos);

  UPDATE contratos
     SET cadastro_aprovado = true,
         aprovado_por      = v_diretor,
         aprovado_em       = now()
   WHERE id = ANY(v_contratos);

  UPDATE associados
     SET status = 'aguardando_instalacao'
   WHERE id = ANY(v_associados);

  UPDATE integration_retry_queue
     SET status = 'dead_letter',
         last_error = COALESCE(last_error,'') || ' | saneamento_revertido_caso_legitimo_2026-05-18'
   WHERE status = 'pending'
     AND (correlation_id::text = ANY(SELECT unnest(v_associados)::text)
       OR correlation_id::text = ANY(SELECT unnest(v_veiculos)::text)
       OR correlation_id::text = ANY(SELECT unnest(v_contratos)::text));
END $$;
