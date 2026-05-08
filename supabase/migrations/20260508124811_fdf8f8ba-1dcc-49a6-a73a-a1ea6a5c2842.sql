DO $$
DECLARE
  v_inst_id uuid;
BEGIN
  INSERT INTO public.instalacoes (
    associado_id, veiculo_id, contrato_id, cotacao_id,
    status, data_agendada, periodo,
    cep, logradouro, numero, bairro, cidade, uf,
    local_vistoria, permite_encaixe, dispensa_rastreador
  ) VALUES (
    'd5603cc0-0955-4c34-ace3-27422a0dca87',
    'cfcec7e9-78a1-4a60-941b-36fa9fa50a2c',
    '43c0ee48-4db8-43fa-8286-def08761ab71',
    'f68f63d3-f5c2-48c5-9155-f7f035f436ee',
    'agendada',
    '2026-05-08',
    'manha',
    '25085-131', 'Av. Brg. Lima e Silva', '351',
    'Parque Duque', 'Duque de Caxias', 'RJ',
    'base', false, false
  ) RETURNING id INTO v_inst_id;

  UPDATE public.agendamentos_base
     SET instalacao_id = v_inst_id
   WHERE id = '1b226b65-3cad-45ca-a577-87a4ad4808d9';
END $$;