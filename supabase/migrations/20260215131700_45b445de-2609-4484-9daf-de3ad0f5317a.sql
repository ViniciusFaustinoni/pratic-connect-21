
DROP POLICY IF EXISTS "Reguladores e gestores podem ver vistorias" ON vistorias_evento;

CREATE POLICY "Reguladores gestores e analistas podem ver vistorias"
ON vistorias_evento
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'regulador'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'gerente_comercial'::app_role)
  OR has_role(auth.uid(), 'analista_cadastro'::app_role)
  OR has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR has_role(auth.uid(), 'analista_eventos'::app_role)
);
