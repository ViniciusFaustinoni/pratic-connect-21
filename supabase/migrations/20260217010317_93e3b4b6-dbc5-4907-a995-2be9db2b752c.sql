DROP POLICY "Staff and own vistoriadores can view vistorias" ON public.vistorias;

CREATE POLICY "Staff and own vistoriadores can view vistorias"
ON public.vistorias
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'admin_master'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR has_role(auth.uid(), 'analista_cadastro'::app_role)
  OR has_role(auth.uid(), 'analista_eventos'::app_role)
  OR (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND (vistoriador_id = get_my_profile_id()))
  OR (associado_id = get_my_associado_id(auth.uid()))
);