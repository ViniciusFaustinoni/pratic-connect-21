
-- Fix FIPE ranges for 7 coverages to match Alagamento por Água Doce (first two ranges both 2.5)
UPDATE entity_eligibility_rules 
SET rule_config = '{"max":180000,"min":0,"intervalo":5000,"faixas":[{"de":0,"ate":5000,"valor":2.5},{"de":5000,"ate":10000,"valor":2.5},{"de":10000,"ate":15000,"valor":3.75},{"de":15000,"ate":20000,"valor":5},{"de":20000,"ate":25000,"valor":6.25},{"de":25000,"ate":30000,"valor":7.5},{"de":30000,"ate":35000,"valor":8.75},{"de":35000,"ate":40000,"valor":10},{"de":40000,"ate":45000,"valor":11.25},{"de":45000,"ate":50000,"valor":12.5},{"de":50000,"ate":55000,"valor":13.75},{"de":55000,"ate":60000,"valor":15},{"de":60000,"ate":65000,"valor":16.25},{"de":65000,"ate":70000,"valor":17.5},{"de":70000,"ate":75000,"valor":18.75},{"de":75000,"ate":80000,"valor":20},{"de":80000,"ate":85000,"valor":21.25},{"de":85000,"ate":90000,"valor":22.5},{"de":90000,"ate":95000,"valor":23.75},{"de":95000,"ate":100000,"valor":25},{"de":100000,"ate":105000,"valor":26.25},{"de":105000,"ate":110000,"valor":27.5},{"de":110000,"ate":115000,"valor":28.75},{"de":115000,"ate":120000,"valor":30},{"de":120000,"ate":125000,"valor":31.25},{"de":125000,"ate":130000,"valor":32.5},{"de":130000,"ate":135000,"valor":33.75},{"de":135000,"ate":140000,"valor":35},{"de":140000,"ate":145000,"valor":36.25},{"de":145000,"ate":150000,"valor":37.5},{"de":150000,"ate":155000,"valor":38.75},{"de":155000,"ate":160000,"valor":40},{"de":160000,"ate":165000,"valor":41.25},{"de":165000,"ate":170000,"valor":42.5},{"de":170000,"ate":175000,"valor":43.75},{"de":175000,"ate":180000,"valor":45}]}'::jsonb,
    updated_at = now()
WHERE id IN (
  '72408651-ce48-4318-9e28-a2b0ac3c71e4',
  'c8148caf-a9a2-4345-acee-898c321442b1',
  'daf9d894-cf0f-464c-a6d8-38aa466970da',
  '2feb7673-f879-4fb8-a928-3743f28749b1',
  '5b601f3f-3c3c-4c85-a866-9632602c7771',
  'b5cea4ba-7cac-4bff-beb2-5ad6faf31c39',
  'c8a522cf-90b3-45e2-b332-3d3cc78a4fb6'
);
