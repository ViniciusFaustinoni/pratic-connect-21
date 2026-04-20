CREATE POLICY "Staff can view vistoria_fotos"
ON public.vistoria_fotos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'admin_master'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR has_role(auth.uid(), 'analista_cadastro'::app_role)
  OR has_role(auth.uid(), 'analista_eventos'::app_role)
  OR (
    has_role(auth.uid(), 'instalador_vistoriador'::app_role)
    AND vistoria_id IN (
      SELECT v.id FROM public.vistorias v
      WHERE v.vistoriador_id = get_my_profile_id()
    )
  )
);