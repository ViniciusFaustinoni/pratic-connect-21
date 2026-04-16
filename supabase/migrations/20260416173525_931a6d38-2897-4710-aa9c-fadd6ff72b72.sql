CREATE POLICY "Funcionarios podem criar solicitacoes"
ON public.chat_solicitacoes_ia
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)
  OR public.has_role(auth.uid(), 'supervisor_vendas'::app_role)
  OR public.has_role(auth.uid(), 'vendedor_clt'::app_role)
  OR public.has_role(auth.uid(), 'vendedor_externo'::app_role)
  OR public.has_role(auth.uid(), 'analista_eventos'::app_role)
  OR public.has_role(auth.uid(), 'analista_cadastro'::app_role)
  OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
);