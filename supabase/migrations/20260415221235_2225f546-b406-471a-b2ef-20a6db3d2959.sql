
-- Fix missing eligibility rules in duplicated lines (SP and Lagos)
-- Maps duplicated coverages to originals by stripping the region suffix from coverage names

DO $$
DECLARE
  v_inserted_count INT := 0;
  v_pair RECORD;
  v_rule RECORD;
  v_new_config JSONB;
  v_faixas JSONB;
  v_new_faixas JSONB;
  v_i INT;
  v_faixa JSONB;
BEGIN

  -- For each duplicated coverage, find its original and copy missing rules
  FOR v_pair IN (
    WITH dup_covs AS (
      -- All coverages in duplicated lines
      SELECT c.id AS dup_id, c.nome AS dup_nome, p.nome AS dup_plano, pl.id AS dup_line_id, pl.name AS dup_line_name,
             CASE
               WHEN pl.name ILIKE '% - São Paulo' THEN ' - SP'
               WHEN pl.name ILIKE '% - Região dos Lagos' THEN ' - Lagos'
             END AS suffix,
             CASE
               WHEN pl.name ILIKE '% - São Paulo' THEN REPLACE(pl.name, ' - São Paulo', '')
               WHEN pl.name ILIKE '% - Região dos Lagos' THEN REPLACE(pl.name, ' - Região dos Lagos', '')
             END AS orig_line_name
      FROM coberturas c
      JOIN planos_coberturas pc ON pc.cobertura_id = c.id
      JOIN planos p ON p.id = pc.plano_id
      JOIN product_lines pl ON pl.id = p.product_line_id
      WHERE pl.name ILIKE '% - São Paulo' OR pl.name ILIKE '% - Região dos Lagos'
    ),
    orig_covs AS (
      -- All coverages in original lines
      SELECT c.id AS orig_id, c.nome AS orig_nome, p.nome AS orig_plano, pl.name AS orig_line_name
      FROM coberturas c
      JOIN planos_coberturas pc ON pc.cobertura_id = c.id
      JOIN planos p ON p.id = pc.plano_id
      JOIN product_lines pl ON pl.id = p.product_line_id
      WHERE pl.name IN ('SELECT', 'LANÇAMENTO')
    )
    SELECT d.dup_id, d.dup_nome, o.orig_id, o.orig_nome, d.suffix, d.dup_line_name
    FROM dup_covs d
    JOIN orig_covs o ON o.orig_line_name = d.orig_line_name
      AND o.orig_nome = REPLACE(d.dup_nome, d.suffix, '')
  )
  LOOP
    -- For each matched pair, find rules that exist in original but not in duplicate
    FOR v_rule IN (
      SELECT r.rule_type, r.rule_mode, r.rule_config, r.is_active, r.entity_type
      FROM entity_eligibility_rules r
      WHERE r.entity_id = v_pair.orig_id
        AND r.entity_type = 'cobertura'
        AND NOT EXISTS (
          SELECT 1 FROM entity_eligibility_rules r2
          WHERE r2.entity_id = v_pair.dup_id
            AND r2.entity_type = 'cobertura'
            AND r2.rule_type = r.rule_type
        )
    )
    LOOP
      -- Apply 10% discount to fipe_range values
      IF v_rule.rule_type = 'fipe_range' THEN
        v_faixas := v_rule.rule_config->'faixas';
        IF v_faixas IS NOT NULL THEN
          v_new_faixas := '[]'::jsonb;
          FOR v_i IN 0..jsonb_array_length(v_faixas)-1 LOOP
            v_faixa := v_faixas->v_i;
            v_faixa := jsonb_set(v_faixa, '{valor}', 
              to_jsonb(ROUND(((v_faixa->>'valor')::numeric * 0.9)::numeric, 2)));
            v_new_faixas := v_new_faixas || jsonb_build_array(v_faixa);
          END LOOP;
          v_new_config := jsonb_set(v_rule.rule_config, '{faixas}', v_new_faixas);
        ELSE
          v_new_config := v_rule.rule_config;
        END IF;
      ELSE
        v_new_config := v_rule.rule_config;
      END IF;

      INSERT INTO entity_eligibility_rules (entity_type, entity_id, rule_type, rule_mode, rule_config, is_active)
      VALUES ('cobertura', v_pair.dup_id, v_rule.rule_type, v_rule.rule_mode, v_new_config, v_rule.is_active);
      
      v_inserted_count := v_inserted_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Inserted % missing eligibility rules', v_inserted_count;
END $$;
