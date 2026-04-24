-- Remove role 'vendedor_externo' indevido de profile do tipo 'associado'.
-- Constraint: associados NUNCA devem participar da esteira comercial.
-- Caso identificado: THIAGO ALVES (adm.thiagoalves@hotmail.com).
DELETE FROM public.user_roles
WHERE role = 'vendedor_externo'
  AND user_id IN (
    SELECT user_id FROM public.profiles WHERE tipo = 'associado'
  );
