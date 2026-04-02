UPDATE entity_eligibility_rules
SET rule_config = jsonb_set(
  jsonb_set(
    rule_config::jsonb,
    '{faixas,0,valor}',
    '3.75'
  ),
  '{faixas,1,valor}',
  '3.75'
)
WHERE id IN (
  'de95d6bc-41ff-4597-b60a-562c1ad954a1',
  '3ec4aa1a-8542-46c3-9185-988ae34bc61c',
  '2b72554e-41bc-4236-ae49-1d9643179ce6',
  'ac8fe0ec-d0bc-4d58-a0a5-bceede10cda7',
  '98732bb8-e46e-4457-b8f1-ead70a975ea8'
);