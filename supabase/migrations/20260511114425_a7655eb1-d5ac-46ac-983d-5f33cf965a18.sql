-- Backfill: corrigir profiles de associados que ficaram com tipo='funcionario'
-- por causa do bug em cotacao-criar-senha (UPDATE não restaurava o tipo).
UPDATE public.profiles p
   SET tipo = 'associado'
  FROM public.associados a
 WHERE a.user_id = p.user_id
   AND p.tipo <> 'associado';

-- Garantir que esses mesmos usuários tenham a role 'associado'
INSERT INTO public.user_roles (user_id, role)
SELECT a.user_id, 'associado'::app_role
  FROM public.associados a
 WHERE a.user_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = a.user_id AND ur.role = 'associado'
   );