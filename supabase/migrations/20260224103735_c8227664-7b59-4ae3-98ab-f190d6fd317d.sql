
-- Tabela principal do despacho
CREATE TABLE public.despacho_reboque (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id uuid NOT NULL REFERENCES chamados_assistencia(id) ON DELETE CASCADE,
  hora_disparo timestamptz NOT NULL DEFAULT now(),
  hora_limite timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'atribuido', 'expirado', 'cancelado')),
  total_enviados int NOT NULL DEFAULT 0,
  total_aceites int NOT NULL DEFAULT 0,
  total_recusas int NOT NULL DEFAULT 0,
  prestador_atribuido_id uuid REFERENCES prestadores_assistencia(id),
  valor_atribuido numeric(12,2),
  distancia_atribuida_km numeric(8,2),
  ciclo int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_despacho_reboque_chamado ON despacho_reboque(chamado_id);

-- Tabela de convites
CREATE TABLE public.despacho_reboque_convites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  despacho_id uuid NOT NULL REFERENCES despacho_reboque(id) ON DELETE CASCADE,
  prestador_id uuid NOT NULL REFERENCES prestadores_assistencia(id),
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  token_expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'visualizado', 'aceito', 'recusado', 'expirado', 'nao_atribuido')),
  whatsapp_enviado boolean NOT NULL DEFAULT false,
  latitude_prestador numeric(10,7),
  longitude_prestador numeric(10,7),
  distancia_km numeric(8,2),
  valor_calculado numeric(12,2),
  valor_saida numeric(12,2),
  valor_km numeric(12,2),
  data_visualizacao timestamptz,
  data_aceite timestamptz,
  data_recusa timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_despacho_convites_token ON despacho_reboque_convites(token);
CREATE INDEX idx_despacho_convites_despacho ON despacho_reboque_convites(despacho_id);

-- Tabela de tracking
CREATE TABLE public.despacho_reboque_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id uuid NOT NULL REFERENCES chamados_assistencia(id) ON DELETE CASCADE,
  prestador_id uuid NOT NULL REFERENCES prestadores_assistencia(id),
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  velocidade numeric(6,2),
  precisao numeric(8,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_despacho_tracking_chamado ON despacho_reboque_tracking(chamado_id);

-- Tabela de status log
CREATE TABLE public.despacho_reboque_status_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id uuid NOT NULL REFERENCES chamados_assistencia(id) ON DELETE CASCADE,
  prestador_id uuid NOT NULL REFERENCES prestadores_assistencia(id),
  status text NOT NULL CHECK (status IN ('a_caminho', 'chegou_local', 'veiculo_carregado', 'chegou_destino', 'concluido')),
  latitude numeric(10,7),
  longitude numeric(10,7),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_despacho_status_chamado ON despacho_reboque_status_log(chamado_id);

-- ============ RLS ============

ALTER TABLE despacho_reboque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analistas e diretores podem ver despachos"
  ON despacho_reboque FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'analista_eventos')
    OR has_role(auth.uid(), 'diretor')
  );

CREATE POLICY "Service role insere despachos"
  ON despacho_reboque FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role atualiza despachos"
  ON despacho_reboque FOR UPDATE
  USING (true);

ALTER TABLE despacho_reboque_convites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analistas e diretores podem ver convites"
  ON despacho_reboque_convites FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'analista_eventos')
    OR has_role(auth.uid(), 'diretor')
  );

CREATE POLICY "Anon pode ver convite pelo token"
  ON despacho_reboque_convites FOR SELECT TO anon
  USING (true);

CREATE POLICY "Qualquer um insere convites"
  ON despacho_reboque_convites FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Qualquer um atualiza convites"
  ON despacho_reboque_convites FOR UPDATE
  USING (true);

ALTER TABLE despacho_reboque_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analistas e diretores podem ver tracking"
  ON despacho_reboque_tracking FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'analista_eventos')
    OR has_role(auth.uid(), 'diretor')
  );

CREATE POLICY "Anon pode ver tracking"
  ON despacho_reboque_tracking FOR SELECT TO anon
  USING (true);

CREATE POLICY "Qualquer um insere tracking"
  ON despacho_reboque_tracking FOR INSERT
  WITH CHECK (true);

ALTER TABLE despacho_reboque_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analistas e diretores podem ver status log"
  ON despacho_reboque_status_log FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'analista_eventos')
    OR has_role(auth.uid(), 'diretor')
  );

CREATE POLICY "Anon pode ver status log"
  ON despacho_reboque_status_log FOR SELECT TO anon
  USING (true);

CREATE POLICY "Qualquer um insere status log"
  ON despacho_reboque_status_log FOR INSERT
  WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE despacho_reboque;
ALTER PUBLICATION supabase_realtime ADD TABLE despacho_reboque_convites;
ALTER PUBLICATION supabase_realtime ADD TABLE despacho_reboque_status_log;
