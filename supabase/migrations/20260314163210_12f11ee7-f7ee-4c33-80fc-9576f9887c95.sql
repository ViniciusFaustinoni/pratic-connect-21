-- Allow anon to read the zero-adhesion message from configuracoes
CREATE POLICY "anon_read_comissao_ext_msg_adesao_zero"
ON public.configuracoes
FOR SELECT
TO anon
USING (chave = 'comissao_ext_msg_adesao_zero');