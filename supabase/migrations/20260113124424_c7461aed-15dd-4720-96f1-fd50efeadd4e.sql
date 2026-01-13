-- Expandir campo regiao para comportar valores como 'rio_de_janeiro' (14 chars)
ALTER TABLE cotacoes ALTER COLUMN regiao TYPE varchar(30);