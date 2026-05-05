-- Restringe policies públicas ao role anon para evitar avaliação custosa
-- em cada SELECT feito por usuários autenticados (diretor, vendedor, etc).

-- 1) Public access via contrato link → só anon
DROP POLICY IF EXISTS "Public access via contrato link" ON public.associados;
CREATE POLICY "Public access via contrato link"
  ON public.associados
  FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT contratos.associado_id
      FROM public.contratos
      WHERE contratos.link_token IS NOT NULL
        AND contratos.link_gerado_em IS NOT NULL
    )
  );

-- 2) Public update status via contrato link → só anon
DROP POLICY IF EXISTS "Public update status via contrato link" ON public.associados;
CREATE POLICY "Public update status via contrato link"
  ON public.associados
  FOR UPDATE
  TO anon
  USING (
    id IN (
      SELECT contratos.associado_id
      FROM public.contratos
      WHERE contratos.link_token IS NOT NULL
        AND contratos.link_gerado_em IS NOT NULL
        AND contratos.associado_id IS NOT NULL
    )
  );

-- 3) anon_select_associados_via_contrato_publico → só anon
DROP POLICY IF EXISTS "anon_select_associados_via_contrato_publico" ON public.associados;
CREATE POLICY "anon_select_associados_via_contrato_publico"
  ON public.associados
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.associado_id = associados.id
        AND c.cotacao_token_publico IS NOT NULL
    )
  );

-- 4) anon_select_associados_via_prestador_link → só anon
DROP POLICY IF EXISTS "anon_select_associados_via_prestador_link" ON public.associados;
CREATE POLICY "anon_select_associados_via_prestador_link"
  ON public.associados
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.instalacoes i
      WHERE i.associado_id = associados.id
        AND has_valid_prestador_link(i.id)
    )
  );

-- 5) Sindicante → só authenticated (não precisava avaliar pra anon nem todos)
DROP POLICY IF EXISTS "Sindicante pode ver associados de sinistros vinculados" ON public.associados;
CREATE POLICY "Sindicante pode ver associados de sinistros vinculados"
  ON public.associados
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sinistros si
      WHERE si.associado_id = associados.id
        AND is_sindicante_of_sinistro(si.id)
    )
  );

-- 6) Internal staff manage → só authenticated
DROP POLICY IF EXISTS "Internal staff can manage associates" ON public.associados;
CREATE POLICY "Internal staff can manage associates"
  ON public.associados
  FOR ALL
  TO authenticated
  USING (is_funcionario_interno(auth.uid()))
  WITH CHECK (is_funcionario_interno(auth.uid()));

-- 7) Staff and own scope can view → só authenticated
DROP POLICY IF EXISTS "Staff and own scope can view associates" ON public.associados;
CREATE POLICY "Staff and own scope can view associates"
  ON public.associados
  FOR SELECT
  TO authenticated
  USING (
    is_funcionario_interno(auth.uid())
    OR user_id = auth.uid()
    OR (
      is_vendedor_nao_gestor(auth.uid())
      AND id IN (SELECT get_vendedor_associado_ids(auth.uid()))
    )
  );

-- 8) Vendedor update → só authenticated
DROP POLICY IF EXISTS "Vendedor pode atualizar seus associados" ON public.associados;
CREATE POLICY "Vendedor pode atualizar seus associados"
  ON public.associados
  FOR UPDATE
  TO authenticated
  USING (
    is_vendedor_nao_gestor(auth.uid())
    AND id IN (SELECT get_vendedor_associado_ids(auth.uid()))
  );

-- 9) Vendedor insert → só authenticated
DROP POLICY IF EXISTS "Vendedor pode inserir associados" ON public.associados;
CREATE POLICY "Vendedor pode inserir associados"
  ON public.associados
  FOR INSERT
  TO authenticated
  WITH CHECK (true);