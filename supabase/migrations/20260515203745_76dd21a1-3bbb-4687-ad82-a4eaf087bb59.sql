UPDATE public.veiculos
   SET cobertura_suspensa = false,
       cobertura_suspensa_motivo = NULL,
       cobertura_suspensa_em = NULL,
       cobertura_total = true,
       cobertura_roubo_furto = true,
       updated_at = now()
 WHERE id = 'cdb3d209-a498-4093-96f1-a240dbdee170'
   AND cobertura_suspensa = true;