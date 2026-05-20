DO $$
DECLARE
  v_solic uuid := 'da35dfbd-5dc5-4df6-95aa-dac017d40546';
  v_cotacao uuid := '6073e982-64b2-494f-b1dc-335a128f0d16';
  v_contrato uuid := 'f3036ac5-5a71-4df7-a68d-6dd5b63da778';
  v_novo_assoc uuid := '1adfb352-5696-470f-9cba-4343f934ad28';
  v_antigo_assoc uuid := '9c05d3c4-ad93-47d6-88ff-f793959fae7d';
  v_veiculo uuid := 'd5181403-22c0-4f2a-b22e-b6e7d821376c';
BEGIN
  UPDATE public.veiculos
     SET em_troca_titularidade = false,
         associado_id = v_antigo_assoc,
         updated_at = now()
   WHERE id = v_veiculo;

  DELETE FROM public.solicitacoes_troca_titularidade WHERE id = v_solic;

  DELETE FROM public.contratos_documentos WHERE contrato_id = v_contrato OR cotacao_id = v_cotacao;
  DELETE FROM public.contratos_historico WHERE contrato_id = v_contrato;
  DELETE FROM public.associados_historico WHERE associado_id = v_novo_assoc OR contrato_id = v_contrato;
  DELETE FROM public.cotacoes_historico WHERE cotacao_id = v_cotacao;
  DELETE FROM public.documento_gerados WHERE associado_id = v_novo_assoc;

  -- Ordem correta: cotação aponta para contrato via contrato_gerado_id
  DELETE FROM public.cotacoes WHERE id = v_cotacao;
  DELETE FROM public.contratos WHERE id = v_contrato;
  DELETE FROM public.associados WHERE id = v_novo_assoc;
END $$;