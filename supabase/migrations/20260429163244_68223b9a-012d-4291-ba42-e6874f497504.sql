-- Correção de nomes duplicados/trocados causados por confusão de cadastro
-- Associado e4d9d1f8... é na verdade Rayslan Hudson Honorato Torres (CPF 161.678.967-04)
UPDATE public.associados
SET nome = 'RAYSLAN HUDSON HONORATO TORRES',
    updated_at = now()
WHERE id = 'e4d9d1f8-c146-4af5-b625-07c3f304c828';

-- Associado a1fac976... é na verdade Camilly Vitória Calixto Carneiro (CPF 127.235.327-39)
UPDATE public.associados
SET nome = 'CAMILLY VITÓRIA CALIXTO CARNEIRO',
    updated_at = now()
WHERE id = 'a1fac976-806d-48ec-b240-19b2a3d52e50';

-- Corrigir nome do cliente no contrato HPOGTC (Honda CG 125 / HBI8H51)
UPDATE public.contratos
SET cliente_nome = 'RAYSLAN HUDSON HONORATO TORRES',
    updated_at = now()
WHERE id = '5e62227f-34f2-43e5-9ca0-3d1d20998ae6';