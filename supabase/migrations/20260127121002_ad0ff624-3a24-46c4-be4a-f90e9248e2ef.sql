-- Permitir que usuários anônimos verifiquem disponibilidade de horários
CREATE POLICY "Anon users can view agendamentos_base" 
ON public.agendamentos_base 
FOR SELECT 
TO anon 
USING (true);