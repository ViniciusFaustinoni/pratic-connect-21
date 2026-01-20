-- Dropar a política existente que não inclui analista_cadastro
DROP POLICY IF EXISTS "Staff can manage instalacoes" ON instalacoes;

-- Criar política atualizada incluindo analista_cadastro para criar instalações ao aprovar propostas
CREATE POLICY "Staff can manage instalacoes"
ON instalacoes
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role) OR
  has_role(auth.uid(), 'diretor'::app_role) OR
  has_role(auth.uid(), 'admin_master'::app_role) OR
  has_role(auth.uid(), 'desenvolvedor'::app_role) OR
  has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND instalador_id = get_my_profile_id())
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role) OR
  has_role(auth.uid(), 'diretor'::app_role) OR
  has_role(auth.uid(), 'admin_master'::app_role) OR
  has_role(auth.uid(), 'desenvolvedor'::app_role) OR
  has_role(auth.uid(), 'analista_cadastro'::app_role) OR
  (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND instalador_id = get_my_profile_id())
);