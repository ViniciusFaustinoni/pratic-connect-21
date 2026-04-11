
DELETE FROM entity_eligibility_rules
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY entity_id, entity_type, rule_type 
      ORDER BY created_at DESC
    ) as rn
    FROM entity_eligibility_rules
    WHERE is_active = true
  ) sub
  WHERE rn > 1
);
