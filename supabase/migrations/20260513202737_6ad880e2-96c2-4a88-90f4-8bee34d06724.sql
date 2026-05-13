UPDATE public.cotacoes
   SET status = 'expirada',
       updated_at = now()
 WHERE id = 'c8856c99-d918-469f-94cd-23ac9d5dc6d2'
   AND status = 'aceita';