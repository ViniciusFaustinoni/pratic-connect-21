-- Limpar usuários de teste (exceto admin@teste.com)
-- Passo 1: Remover leads atribuídos aos vendedores de teste
UPDATE public.leads 
SET vendedor_id = NULL 
WHERE vendedor_id IN (
  SELECT id FROM public.profiles 
  WHERE email IN ('consultor@teste.com', 'consultorexterno@teste.com')
);

-- Passo 2: Remover roles dos vendedores de teste
DELETE FROM public.user_roles 
WHERE user_id IN (
  SELECT user_id FROM public.profiles 
  WHERE email IN ('consultor@teste.com', 'consultorexterno@teste.com')
);

-- Passo 3: Remover profiles de teste
DELETE FROM public.profiles 
WHERE email IN ('consultor@teste.com', 'consultorexterno@teste.com');