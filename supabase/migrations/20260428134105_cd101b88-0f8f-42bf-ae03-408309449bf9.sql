-- Frente 2 + 3 unificadas: para cada veiculo_id, atualizar se existir, senão inserir
DO $$
DECLARE
  v_ids uuid[] := ARRAY[
    'cde763e9-eb0e-4c23-bbb2-8a38de21264b'::uuid,
    '04a5ca1f-c01f-4a95-9d58-a4c8bf713d96'::uuid,
    'dc8c73bf-7bd9-45a8-9950-5453e23fe632'::uuid,
    '3d78f886-77f4-4db8-927b-820d905b1f26'::uuid,
    '55c2f9bc-9c16-4e63-a838-d2fbe143d5aa'::uuid,
    '0357a7f9-bcaf-434c-a89b-e90528269b63'::uuid,
    '2f162355-b89d-462b-92ce-a76f7e979049'::uuid,
    'a1765caa-3bcb-4160-b655-98fadd6dacf8'::uuid,
    '0cfc9a89-ac7b-4e65-af7d-cb6b81f8afc1'::uuid
  ];
  v_id uuid;
  v_assoc uuid;
  v_count int;
BEGIN
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT associado_id INTO v_assoc FROM public.veiculos WHERE id = v_id;
    IF v_assoc IS NULL THEN
      RAISE NOTICE 'Veículo % não encontrado, pulando.', v_id;
      CONTINUE;
    END IF;

    UPDATE public.sga_sync_queue
       SET status='pendente', tentativas=0, proximo_reenvio_em=now(),
           etapa_parou=NULL,
           erro_ultimo='Resetado — diagnóstico planilha 33 placas (pós-fix TDZ)'
     WHERE veiculo_id = v_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO public.sga_sync_queue (veiculo_id, associado_id, status, tentativas, proximo_reenvio_em, erro_ultimo)
      VALUES (v_id, v_assoc, 'pendente', 0, now(), 'Enfileirado — diagnóstico planilha 33 placas');
    END IF;
  END LOOP;
END $$;