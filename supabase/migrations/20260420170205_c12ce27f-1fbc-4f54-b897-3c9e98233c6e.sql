-- Corrige FK de datas_bloqueadas.criado_por para apontar a auth.users (id)
-- em vez de profiles.id (que pode não existir para todos os usuários autenticados)
ALTER TABLE public.datas_bloqueadas
  DROP CONSTRAINT IF EXISTS datas_bloqueadas_criado_por_fkey;

ALTER TABLE public.datas_bloqueadas
  ADD CONSTRAINT datas_bloqueadas_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;