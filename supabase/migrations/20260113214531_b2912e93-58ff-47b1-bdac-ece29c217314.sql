-- 1. Remover a FK que impede a alteração de tipo
ALTER TABLE public.asaas_cobrancas 
DROP CONSTRAINT IF EXISTS asaas_cobrancas_asaas_cliente_id_fkey;

-- 2. Alterar tipo de asaas_cliente_id de uuid para varchar
-- O Asaas retorna IDs como strings (ex: cus_000007347521), não UUIDs
ALTER TABLE public.asaas_cobrancas 
ALTER COLUMN asaas_cliente_id TYPE varchar USING asaas_cliente_id::varchar;