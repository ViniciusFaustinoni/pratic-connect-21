-- 1. Criar função helper para obter o profile_id do usuário logado (evita recursão)
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 2. Dropar políticas antigas muito permissivas de SELECT
DROP POLICY IF EXISTS "Staff can view inspections" ON vistorias;
DROP POLICY IF EXISTS "Staff can manage inspections" ON vistorias;
DROP POLICY IF EXISTS "Staff can view routes" ON rotas;
DROP POLICY IF EXISTS "Staff can manage routes" ON rotas;
DROP POLICY IF EXISTS "Staff can view installations" ON instalacoes;
DROP POLICY IF EXISTS "Staff can manage installations" ON instalacoes;
DROP POLICY IF EXISTS "Staff can view route installers" ON rota_instaladores;
DROP POLICY IF EXISTS "Staff can manage route installers" ON rota_instaladores;

-- 3. Políticas para ROTAS - SELECT
CREATE POLICY "Staff and own installers can view routes"
ON public.rotas FOR SELECT
TO authenticated
USING (
  -- Coordenadores, diretores e admins veem tudo
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor') OR
  -- Instaladores veem apenas rotas onde estão atribuídos
  (
    has_role(auth.uid(), 'instalador_vistoriador') AND
    EXISTS (
      SELECT 1 FROM rota_instaladores ri
      WHERE ri.rota_id = rotas.id
        AND ri.instalador_id = get_my_profile_id()
    )
  )
);

-- 3.1 Políticas para ROTAS - INSERT/UPDATE/DELETE (apenas staff completo)
CREATE POLICY "Staff can manage routes"
ON public.rotas FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor')
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor')
);

-- 4. Políticas para ROTA_INSTALADORES - SELECT
CREATE POLICY "Staff and own installers can view rota_instaladores"
ON public.rota_instaladores FOR SELECT
TO authenticated
USING (
  -- Staff completo vê tudo
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor') OR
  -- Instaladores veem apenas seus registros
  instalador_id = get_my_profile_id()
);

-- 4.1 Políticas para ROTA_INSTALADORES - INSERT/UPDATE/DELETE (apenas staff)
CREATE POLICY "Staff can manage rota_instaladores"
ON public.rota_instaladores FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor')
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor')
);

-- 5. Políticas para INSTALACOES - SELECT
CREATE POLICY "Staff and own installers can view instalacoes"
ON public.instalacoes FOR SELECT
TO authenticated
USING (
  -- Staff completo vê tudo
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor') OR
  has_role(auth.uid(), 'analista_cadastro') OR
  -- Instaladores veem apenas as próprias instalações
  (
    has_role(auth.uid(), 'instalador_vistoriador') AND
    instalador_id = get_my_profile_id()
  )
);

-- 5.1 Políticas para INSTALACOES - INSERT/UPDATE/DELETE
CREATE POLICY "Staff can manage instalacoes"
ON public.instalacoes FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor') OR
  -- Instalador pode atualizar suas próprias instalações
  (has_role(auth.uid(), 'instalador_vistoriador') AND instalador_id = get_my_profile_id())
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor') OR
  (has_role(auth.uid(), 'instalador_vistoriador') AND instalador_id = get_my_profile_id())
);

-- 6. Políticas para VISTORIAS - SELECT
CREATE POLICY "Staff and own vistoriadores can view vistorias"
ON public.vistorias FOR SELECT
TO authenticated
USING (
  -- Staff completo vê tudo
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor') OR
  has_role(auth.uid(), 'analista_cadastro') OR
  -- Vistoriadores veem apenas as próprias vistorias
  (
    has_role(auth.uid(), 'instalador_vistoriador') AND
    vistoriador_id = get_my_profile_id()
  ) OR
  -- Associados veem as próprias vistorias
  associado_id = get_my_associado_id(auth.uid())
);

-- 6.1 Políticas para VISTORIAS - INSERT/UPDATE/DELETE
CREATE POLICY "Staff can manage vistorias"
ON public.vistorias FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor') OR
  has_role(auth.uid(), 'analista_cadastro') OR
  -- Vistoriador pode atualizar suas próprias vistorias
  (has_role(auth.uid(), 'instalador_vistoriador') AND vistoriador_id = get_my_profile_id())
)
WITH CHECK (
  has_role(auth.uid(), 'coordenador_monitoramento') OR
  has_role(auth.uid(), 'diretor') OR
  has_role(auth.uid(), 'admin_master') OR
  has_role(auth.uid(), 'desenvolvedor') OR
  has_role(auth.uid(), 'analista_cadastro') OR
  (has_role(auth.uid(), 'instalador_vistoriador') AND vistoriador_id = get_my_profile_id())
);