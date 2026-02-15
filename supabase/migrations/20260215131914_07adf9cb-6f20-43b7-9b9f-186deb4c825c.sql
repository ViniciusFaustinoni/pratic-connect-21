-- Permitir analista_eventos visualizar rastreadores (necessário para TrajetoSinistroCard)
CREATE POLICY "Analista eventos pode ver rastreadores"
ON rastreadores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'analista_eventos'::app_role)
);