ALTER TABLE public.contratos
  ALTER COLUMN cliente_complemento TYPE varchar(255),
  ALTER COLUMN cliente_bairro      TYPE varchar(150),
  ALTER COLUMN cliente_cidade      TYPE varchar(150),
  ALTER COLUMN cliente_profissao   TYPE varchar(150),
  ALTER COLUMN veiculo_financeira  TYPE varchar(150);