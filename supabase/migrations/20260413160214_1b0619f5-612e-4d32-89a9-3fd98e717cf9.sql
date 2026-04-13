
-- Diretores podem atualizar seus próprios registros
CREATE POLICY "Diretores atualizam propria aprovacao fipe"
  ON public.aprovacoes_fipe_diretoria
  FOR UPDATE TO authenticated
  USING (diretor_id = auth.uid())
  WITH CHECK (diretor_id = auth.uid());

-- Admins podem atualizar qualquer registro
CREATE POLICY "Admins atualizam aprovacoes fipe diretoria"
  ON public.aprovacoes_fipe_diretoria
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins também podem ver todas as aprovações
CREATE POLICY "Admins veem aprovacoes fipe diretoria"
  ON public.aprovacoes_fipe_diretoria
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
