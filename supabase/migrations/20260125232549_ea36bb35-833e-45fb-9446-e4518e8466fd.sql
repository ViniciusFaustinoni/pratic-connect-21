-- Permitir lookup de email por CPF para login de associados
-- Necessário porque o usuário ainda não está autenticado quando faz o lookup

CREATE POLICY "Allow public cpf lookup for associate login"
ON public.profiles
FOR SELECT
TO anon
USING (tipo = 'associado');