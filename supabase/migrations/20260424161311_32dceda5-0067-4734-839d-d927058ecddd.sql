-- Reclassificar perfis incorretamente marcados como 'funcionario' (ou outro tipo) que na verdade são associados.
-- Critério (qualquer um basta):
--   1) Existe registro em public.associados com mesmo user_id;
--   2) Existe role 'associado' em public.user_roles para esse user_id;
--   3) Email termina com '@associado.pratic.com.br'.
UPDATE public.profiles p
SET tipo = 'associado',
    updated_at = now()
WHERE p.tipo <> 'associado'
  AND (
    (p.user_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.associados a WHERE a.user_id = p.user_id
    ))
    OR (p.user_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.user_id AND ur.role = 'associado'
    ))
    OR (p.email IS NOT NULL AND p.email ILIKE '%@associado.pratic.com.br')
  );