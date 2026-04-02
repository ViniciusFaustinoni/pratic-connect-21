-- 1. Update fipe_range rules for the 3 target coverages to match source (Furto)
UPDATE entity_eligibility_rules
SET rule_config = '{"faixas":[{"ate":5000,"de":0,"valor":1.5},{"ate":10000,"de":5000,"valor":1.5},{"ate":15000,"de":10000,"valor":2.25},{"ate":20000,"de":15000,"valor":3},{"ate":25000,"de":20000,"valor":3.75},{"ate":30000,"de":25000,"valor":4.5},{"ate":35000,"de":30000,"valor":5.25},{"ate":40000,"de":35000,"valor":6},{"ate":45000,"de":40000,"valor":6.75},{"ate":50000,"de":45000,"valor":7.5},{"ate":55000,"de":50000,"valor":8.25},{"ate":60000,"de":55000,"valor":9},{"ate":65000,"de":60000,"valor":9.75},{"ate":70000,"de":65000,"valor":10.5},{"ate":75000,"de":70000,"valor":11.25},{"ate":80000,"de":75000,"valor":12},{"ate":85000,"de":80000,"valor":12.75},{"ate":90000,"de":85000,"valor":13.5},{"ate":95000,"de":90000,"valor":14.25},{"ate":100000,"de":95000,"valor":15},{"ate":105000,"de":100000,"valor":15.75},{"ate":110000,"de":105000,"valor":16.5},{"ate":115000,"de":110000,"valor":17.25},{"ate":120000,"de":115000,"valor":18},{"ate":125000,"de":120000,"valor":18.75},{"ate":130000,"de":125000,"valor":19.5},{"ate":135000,"de":130000,"valor":20.25},{"ate":140000,"de":135000,"valor":21},{"ate":145000,"de":140000,"valor":21.75},{"ate":150000,"de":145000,"valor":22.5},{"ate":155000,"de":150000,"valor":23.25},{"ate":160000,"de":155000,"valor":24},{"ate":165000,"de":160000,"valor":24.75},{"ate":170000,"de":165000,"valor":25.5},{"ate":175000,"de":170000,"valor":26.25},{"ate":180000,"de":175000,"valor":27}],"intervalo":5000,"max":180000,"min":0}'::jsonb,
    updated_at = now()
WHERE id IN (
  '9fb38a46-c48f-44b8-9c1a-294d533a91ba',
  '636e0fa7-5ea6-4f2a-917e-05041a75dd4b',
  'bab734c7-6e4f-4899-a7af-615c13a67aff'
);

-- 2. Delete redundant fipe_eligibility rules from targets (source doesn't have them)
DELETE FROM entity_eligibility_rules
WHERE id IN (
  '15ec982f-83e9-4589-8724-083d720e5579',
  'f5003c57-3b81-4dce-9500-78eff093958e'
);