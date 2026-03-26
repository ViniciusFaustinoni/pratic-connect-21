ALTER TABLE coberturas ALTER COLUMN codigo TYPE varchar(100);

UPDATE coberturas 
SET codigo = codigo || '-' || substr(gen_random_uuid()::text, 1, 8)
WHERE codigo NOT LIKE '%-%-%-%';