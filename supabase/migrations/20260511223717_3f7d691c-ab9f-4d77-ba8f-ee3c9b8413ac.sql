DO $$
DECLARE
  v_contratos uuid[] := ARRAY['f3343397-8607-4d10-b2f0-f7d140eead69','40a79217-85c1-4987-9c3a-b0dcbb9279f6']::uuid[];
  v_assocs uuid[] := ARRAY['3b8f4e96-71e6-4e96-9de7-b5a3f8ab56c3','79809db0-a25b-4518-accf-884274fafc08']::uuid[];
  v_veiculo uuid := 'a7552ca9-8e1d-4de8-b682-f7c07e612b04';
  s text;
BEGIN
  FOR s IN SELECT unnest(ARRAY[
    'UPDATE cotacoes SET contrato_gerado_id=NULL WHERE contrato_gerado_id = ANY($1)',
    'DELETE FROM mensalidades WHERE contrato_id = ANY($1) OR associado_id = ANY($2)',
    'DELETE FROM cobrancas WHERE contrato_id = ANY($1) OR associado_id = ANY($2)',
    'DELETE FROM pagamentos WHERE contrato_id = ANY($1) OR associado_id = ANY($2)',
    'DELETE FROM contrato_coberturas WHERE contrato_id = ANY($1)',
    'DELETE FROM contratos_historico WHERE contrato_id = ANY($1)',
    'DELETE FROM ativacao_status_log WHERE contrato_id = ANY($1) OR associado_id = ANY($2)',
    'DELETE FROM cotacoes WHERE cliente_cpf IN (''12493649737'',''14194896742'')',
    'DELETE FROM solicitacoes_troca_titularidade WHERE associado_antigo_id = ANY($2) OR novo_associado_id = ANY($2) OR veiculo_id = $3',
    'UPDATE rastreadores SET associado_id=NULL, veiculo_id=NULL WHERE associado_id = ANY($2) OR veiculo_id = $3',
    'DELETE FROM vistoria_fotos WHERE vistoria_id IN (SELECT id FROM vistorias WHERE veiculo_id = $3 OR associado_id = ANY($2))',
    'DELETE FROM vistorias WHERE veiculo_id = $3 OR associado_id = ANY($2)',
    'DELETE FROM instalacoes WHERE veiculo_id = $3 OR associado_id = ANY($2)',
    'DELETE FROM agendamentos_base WHERE veiculo_id = $3 OR associado_id = ANY($2)',
    'DELETE FROM servicos WHERE veiculo_id = $3 OR associado_id = ANY($2)',
    'DELETE FROM associado_documentos WHERE associado_id = ANY($2)',
    'DELETE FROM contratos WHERE id = ANY($1)',
    'DELETE FROM veiculos WHERE id = $3',
    'DELETE FROM associados WHERE id = ANY($2)'
  ]) LOOP
    BEGIN
      EXECUTE s USING v_contratos, v_assocs, v_veiculo;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'IGNORADO [%]: %', s, SQLERRM;
    END;
  END LOOP;
END $$;