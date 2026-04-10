
CREATE OR REPLACE FUNCTION pg_temp.apply_discount_faixas(config jsonb, pct numeric)
RETURNS jsonb AS $$
DECLARE
  faixas jsonb;
  new_faixas jsonb := '[]'::jsonb;
  faixa jsonb;
  i int;
BEGIN
  faixas := config->'faixas';
  IF faixas IS NULL THEN RETURN config; END IF;
  
  FOR i IN 0..jsonb_array_length(faixas)-1 LOOP
    faixa := faixas->i;
    new_faixas := new_faixas || jsonb_build_object(
      'de', (faixa->>'de')::numeric,
      'ate', (faixa->>'ate')::numeric,
      'valor', round(((faixa->>'valor')::numeric * (100 - pct) / 100)::numeric, 2)
    );
  END LOOP;
  
  RETURN jsonb_set(config, '{faixas}', new_faixas);
END;
$$ LANGUAGE plpgsql;

UPDATE entity_eligibility_rules
SET rule_config = pg_temp.apply_discount_faixas(rule_config, 10),
    updated_at = now()
WHERE id IN (
  'e5f0be82-b599-4a3e-8229-666075c94296',
  'cab5a1a4-3335-4477-a717-a1cc98178953',
  '9d88217d-a4ba-41df-b0b6-c8c80878f12f',
  'c0c47123-702b-443a-9815-1b532c5ccde0',
  'ec514b14-9114-42fe-8da8-48e082ca4d24',
  '52ec4d0c-7e77-4289-8ec2-2cfa8173cd39',
  '2b551442-fd0d-4cde-b602-beb4bc0fe5c5',
  '48dc243e-20b9-424e-8724-50b4bccef9ed',
  'e4e1794a-eca7-4076-a743-a6d228a95ae6'
)
AND rule_type = 'fipe_range';
