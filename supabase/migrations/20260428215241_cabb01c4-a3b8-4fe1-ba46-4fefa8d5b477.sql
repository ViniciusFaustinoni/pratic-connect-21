
-- ============================================
-- FASE 5: Endurecimento de RLS
-- ============================================

-- 1) servicos: substituir policies anônimas inseguras
DROP POLICY IF EXISTS "Anon can update assinatura on servicos" ON public.servicos;
DROP POLICY IF EXISTS "Anon pode inserir servico via reagendamento" ON public.servicos;

CREATE POLICY "Anon update servicos via reagendamento token"
  ON public.servicos
  FOR UPDATE
  TO anon
  USING (reagendamento_token IS NOT NULL)
  WITH CHECK (reagendamento_token IS NOT NULL);

CREATE POLICY "Anon insert servicos via reagendamento token"
  ON public.servicos
  FOR INSERT
  TO anon
  WITH CHECK (reagendamento_token IS NOT NULL);

-- 2) agendamentos_base: remover policies abertas
DROP POLICY IF EXISTS "Anon users can insert agendamentos_base" ON public.agendamentos_base;
DROP POLICY IF EXISTS "Anon users can view agendamentos_base" ON public.agendamentos_base;
DROP POLICY IF EXISTS "Authenticated users can insert agendamentos_base" ON public.agendamentos_base;
DROP POLICY IF EXISTS "Authenticated users can update agendamentos_base" ON public.agendamentos_base;
DROP POLICY IF EXISTS "Authenticated users can view agendamentos_base" ON public.agendamentos_base;

-- Staff interno
CREATE POLICY "Staff interno gerencia agendamentos_base"
  ON public.agendamentos_base
  FOR ALL
  TO authenticated
  USING (public.is_funcionario_interno(auth.uid()))
  WITH CHECK (public.is_funcionario_interno(auth.uid()));

-- Instalador/vistoriador via instalacao/vistoria/rota
CREATE POLICY "Instalador ve agendamentos_base vinculados"
  ON public.agendamentos_base
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'instalador_vistoriador'::app_role)
    AND (
      EXISTS (
        SELECT 1 FROM public.instalacoes i
        WHERE i.id = agendamentos_base.instalacao_id
          AND (
            i.instalador_id = public.get_my_profile_id()
            OR EXISTS (
              SELECT 1 FROM public.rota_instaladores ri
              WHERE ri.rota_id = i.rota_id AND ri.instalador_id = public.get_my_profile_id()
            )
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.vistorias v
        WHERE v.id = agendamentos_base.vistoria_id
          AND v.vistoriador_id = public.get_my_profile_id()
      )
    )
  );

CREATE POLICY "Instalador atualiza agendamentos_base vinculados"
  ON public.agendamentos_base
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'instalador_vistoriador'::app_role)
    AND (
      EXISTS (
        SELECT 1 FROM public.instalacoes i
        WHERE i.id = agendamentos_base.instalacao_id
          AND (
            i.instalador_id = public.get_my_profile_id()
            OR EXISTS (
              SELECT 1 FROM public.rota_instaladores ri
              WHERE ri.rota_id = i.rota_id AND ri.instalador_id = public.get_my_profile_id()
            )
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.vistorias v
        WHERE v.id = agendamentos_base.vistoria_id
          AND v.vistoriador_id = public.get_my_profile_id()
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'instalador_vistoriador'::app_role)
  );

-- Prestador via servicos.instalacao_origem_id / vistoria_origem_id
CREATE POLICY "Prestador ve agendamentos_base de seus servicos"
  ON public.agendamentos_base
  FOR SELECT
  TO authenticated
  USING (
    public.is_prestador(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.servicos s
      WHERE s.profissional_id = public.get_my_profile_id()
        AND (
          s.instalacao_origem_id = agendamentos_base.instalacao_id
          OR s.vistoria_origem_id = agendamentos_base.vistoria_id
        )
    )
  );

CREATE POLICY "Prestador atualiza agendamentos_base de seus servicos"
  ON public.agendamentos_base
  FOR UPDATE
  TO authenticated
  USING (
    public.is_prestador(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.servicos s
      WHERE s.profissional_id = public.get_my_profile_id()
        AND (
          s.instalacao_origem_id = agendamentos_base.instalacao_id
          OR s.vistoria_origem_id = agendamentos_base.vistoria_id
        )
    )
  )
  WITH CHECK (
    public.is_prestador(auth.uid())
  );

-- Associado autenticado
CREATE POLICY "Associado ve proprios agendamentos_base"
  ON public.agendamentos_base
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instalacoes i
      WHERE i.id = agendamentos_base.instalacao_id
        AND i.associado_id = public.get_my_associado_id(auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.vistorias v
      WHERE v.id = agendamentos_base.vistoria_id
        AND v.associado_id = public.get_my_associado_id(auth.uid())
    )
  );

-- Acesso anônimo via token de contrato
CREATE POLICY "Anon ve agendamentos_base via contrato token"
  ON public.agendamentos_base
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.instalacoes i
      JOIN public.contratos c ON c.associado_id = i.associado_id
      WHERE i.id = agendamentos_base.instalacao_id
        AND c.link_token IS NOT NULL
        AND c.link_gerado_em IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.vistorias v
      JOIN public.contratos c ON c.id = v.contrato_id
      WHERE v.id = agendamentos_base.vistoria_id
        AND c.link_token IS NOT NULL
        AND c.link_gerado_em IS NOT NULL
    )
  );

-- 3) rota_instaladores: remover policies abertas (mantidas as restritas)
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar rota_instaladores" ON public.rota_instaladores;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar rota_instaladores" ON public.rota_instaladores;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir rota_instaladores" ON public.rota_instaladores;
DROP POLICY IF EXISTS "Usuários autenticados podem ver rota_instaladores" ON public.rota_instaladores;
