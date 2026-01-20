-- Permitir que funcionários aprovem contratos assinados (mudar status para ativo)
CREATE POLICY "Staff can approve signed contracts"
ON public.contratos
FOR UPDATE
TO authenticated
USING (
  is_funcionario(auth.uid())
  AND status = 'assinado'::status_contrato
)
WITH CHECK (
  is_funcionario(auth.uid())
  AND status IN ('assinado'::status_contrato, 'ativo'::status_contrato)
);