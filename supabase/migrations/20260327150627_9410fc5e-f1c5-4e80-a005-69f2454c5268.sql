ALTER TABLE public.entity_eligibility_rules
  DROP CONSTRAINT IF EXISTS entity_eligibility_rules_rule_type_check;

ALTER TABLE public.entity_eligibility_rules
  ADD CONSTRAINT entity_eligibility_rules_rule_type_check
  CHECK (rule_type IN (
    'fipe_range','fipe_eligibility','ano_range','categoria_veiculo',
    'categoria_especial','regiao','marca_modelo','tipo_uso',
    'combustivel','tipo_placa'
  ));