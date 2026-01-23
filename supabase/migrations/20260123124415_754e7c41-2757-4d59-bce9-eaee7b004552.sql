-- SISTEMA DE ROTAS AUTOMÁTICAS

-- 1. Tabela localização vistoriadores
CREATE TABLE IF NOT EXISTS public.vistoriadores_localizacao (
  vistoriador_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  precisao_metros DOUBLE PRECISION,
  em_servico BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vistoriadores_localizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados acessam localizacao" ON public.vistoriadores_localizacao FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_instalacoes_disponiveis ON instalacoes(data_agendada, status) WHERE instalador_responsavel_id IS NULL AND status = 'agendada';
CREATE INDEX IF NOT EXISTS idx_vistorias_disponiveis ON vistorias(data_agendada, status) WHERE vistoriador_id IS NULL AND status IN ('pendente', 'agendada');

-- 3. Coluna tipo rotas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rotas' AND column_name = 'tipo') THEN
    ALTER TABLE public.rotas ADD COLUMN tipo VARCHAR(20) DEFAULT 'manual';
  END IF;
END $$;

-- 4. Function buscar tarefa atual
CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_vistoriador(p_vistoriador_id UUID)
RETURNS TABLE (id UUID, tipo TEXT, status TEXT, data_agendada DATE, hora_agendada TIME, associado_id UUID, associado_nome TEXT, associado_telefone TEXT, veiculo_id UUID, veiculo_placa TEXT, veiculo_marca TEXT, veiculo_modelo TEXT, logradouro TEXT, numero TEXT, bairro TEXT, cidade TEXT, uf TEXT, endereco_latitude DOUBLE PRECISION, endereco_longitude DOUBLE PRECISION, rota_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, 'instalacao'::TEXT, i.status::TEXT, i.data_agendada, i.hora_agendada, i.associado_id, a.nome, a.telefone, i.veiculo_id, v.placa, v.marca, v.modelo, i.logradouro, i.numero, i.bairro, i.cidade, i.uf, i.endereco_latitude, i.endereco_longitude, i.rota_id
  FROM instalacoes i LEFT JOIN associados a ON a.id = i.associado_id LEFT JOIN veiculos v ON v.id = i.veiculo_id
  WHERE i.instalador_responsavel_id = p_vistoriador_id AND i.status IN ('em_rota', 'em_andamento')
  ORDER BY CASE WHEN i.status = 'em_andamento' THEN 0 ELSE 1 END LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT vis.id, 'vistoria'::TEXT, vis.status::TEXT, vis.data_agendada, vis.hora_agendada, vis.associado_id, a.nome, a.telefone, vis.veiculo_id, v.placa, v.marca, v.modelo, vis.logradouro, vis.numero, vis.bairro, vis.cidade, vis.uf, vis.endereco_latitude, vis.endereco_longitude, vis.rota_id
    FROM vistorias vis LEFT JOIN associados a ON a.id = vis.associado_id LEFT JOIN veiculos v ON v.id = vis.veiculo_id
    WHERE vis.vistoriador_id = p_vistoriador_id AND vis.status IN ('em_rota', 'em_andamento')
    ORDER BY CASE WHEN vis.status = 'em_andamento' THEN 0 ELSE 1 END LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.buscar_tarefa_atual_vistoriador(UUID) TO authenticated;