-- Atualizar política RLS da tabela vistorias para permitir INSERT quando instalador está na rota
DROP POLICY IF EXISTS "Staff can manage vistorias" ON public.vistorias;

CREATE POLICY "Staff can manage vistorias"
ON public.vistorias FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role) OR
  has_role(auth.uid(), 'diretor'::app_role) OR
  has_role(auth.uid(), 'admin_master'::app_role) OR
  has_role(auth.uid(), 'desenvolvedor'::app_role) OR
  has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND (
    vistoriador_id = get_my_profile_id() OR
    vistoriador_id IS NULL OR
    EXISTS (
      SELECT 1 FROM instalacoes i
      JOIN rota_instaladores ri ON ri.rota_id = i.rota_id
      WHERE i.id = vistorias.instalacao_id 
      AND ri.instalador_id = get_my_profile_id()
    )
  ))
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role) OR
  has_role(auth.uid(), 'diretor'::app_role) OR
  has_role(auth.uid(), 'admin_master'::app_role) OR
  has_role(auth.uid(), 'desenvolvedor'::app_role) OR
  has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND (
    vistoriador_id = get_my_profile_id() OR
    vistoriador_id IS NULL OR
    EXISTS (
      SELECT 1 FROM instalacoes i
      JOIN rota_instaladores ri ON ri.rota_id = i.rota_id
      WHERE i.id = instalacao_id 
      AND ri.instalador_id = get_my_profile_id()
    )
  ))
);