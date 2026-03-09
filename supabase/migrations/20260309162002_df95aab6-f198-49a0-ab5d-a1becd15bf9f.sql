
-- Tabela app_roles_config: fonte única de verdade para roles/perfis
CREATE TABLE IF NOT EXISTS public.app_roles_config (
  role TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'Outros',
  sigla TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'gray',
  icon_name TEXT NOT NULL DEFAULT 'Shield',
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: leitura pública para autenticados, escrita apenas para diretores/devs
ALTER TABLE public.app_roles_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler app_roles_config"
  ON public.app_roles_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas diretores podem modificar app_roles_config"
  ON public.app_roles_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('diretor', 'desenvolvedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('diretor', 'desenvolvedor')
    )
  );

-- Seed data com todos os roles existentes
INSERT INTO public.app_roles_config (role, label, description, area, sigla, color, icon_name, sort_order) VALUES
  ('desenvolvedor', 'Desenvolvedor', 'Acesso total ao sistema, incluindo configurações técnicas e debug', 'Diretoria', 'Dev', 'violet', 'Code', 1),
  ('diretor', 'Diretor', 'Acesso total ao sistema, aprova alterações de permissão', 'Diretoria', 'Dir', 'purple', 'Crown', 2),
  ('admin_master', 'Admin Master', 'Gerencia permissões e usuários (alterações requerem aprovação)', 'Diretoria', 'Adm', 'purple', 'ShieldCheck', 3),
  ('gerente_comercial', 'Gerente Comercial', 'Gestão completa da equipe comercial e metas', 'Comercial', 'GerC', 'blue', 'Briefcase', 10),
  ('supervisor_vendas', 'Supervisor de Vendas', 'Supervisiona vendedores e acompanha desempenho', 'Comercial', 'SupV', 'cyan', 'Users', 11),
  ('vendedor_clt', 'Vendedor CLT', 'Vendas internas com acesso aos próprios registros', 'Comercial', 'VdC', 'green', 'UserCheck', 12),
  ('vendedor_externo', 'Vendedor Externo', 'Vendas externas com acesso aos próprios registros', 'Comercial', 'VdE', 'green', 'UserPlus', 13),
  ('agencia', 'Agência', 'Agência parceira com acesso a vendas', 'Comercial', 'Ag', 'fuchsia', 'Building', 14),
  ('analista_cadastro', 'Analista de Cadastro', 'Gerencia cadastros de associados e veículos', 'Cadastro', 'AnCad', 'orange', 'FileCheck', 20),
  ('coordenador_monitoramento', 'Coordenador de Monitoramento', 'Coordena equipe de monitoramento e instalações', 'Monitoramento', 'CrdM', 'teal', 'MapPin', 30),
  ('analista_plataforma', 'Analista de Plataforma', 'Monitora rastreadores e alertas em tempo real', 'Monitoramento', 'AnPlt', 'teal', 'Monitor', 31),
  ('instalador_vistoriador', 'Instalador/Vistoriador', 'Realiza instalações e vistorias em campo', 'Monitoramento', 'Inst', 'pink', 'Wrench', 32),
  ('vistoriador_base', 'Vistoriador Base', 'Realiza vistorias na base', 'Monitoramento', 'VBase', 'pink', 'ClipboardCheck', 33),
  ('analista_eventos', 'Analista de Eventos', 'Gerencia eventos e sinistros', 'Eventos', 'AnEv', 'red', 'AlertTriangle', 40),
  ('regulador', 'Regulador', 'Regulação de sinistros em campo', 'Eventos', 'Reg', 'red', 'Scale', 41),
  ('sindicante', 'Sindicante', 'Realiza sindicâncias em campo', 'Eventos', 'Sind', 'red', 'Search', 42),
  ('analista_marketing', 'Analista de Marketing', 'Gerencia campanhas e leads de marketing', 'Marketing', 'AnMkt', 'rose', 'Megaphone', 50),
  ('analista_juridico', 'Analista Jurídico', 'Acompanha processos e consultas jurídicas', 'Jurídico', 'AnJur', 'indigo', 'Scale', 60),
  ('advogado', 'Advogado', 'Advogado com acesso ao módulo jurídico', 'Jurídico', 'Adv', 'indigo', 'Gavel', 61),
  ('associado', 'Associado', 'Acesso ao aplicativo do associado', 'App', 'Assoc', 'slate', 'User', 90)
ON CONFLICT (role) DO NOTHING;
