-- =============================================
-- MIGRAÇÃO: Corrigir Sistema de Atribuição de Tarefas
-- =============================================

-- 1. Adicionar valores faltantes ao enum status_vistoria (se não existirem)
DO $$
BEGIN
    -- Verificar e adicionar 'em_rota' se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'em_rota' AND enumtypid = 'status_vistoria'::regtype) THEN
        ALTER TYPE status_vistoria ADD VALUE 'em_rota';
    END IF;
    
    -- Verificar e adicionar 'em_andamento' se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'em_andamento' AND enumtypid = 'status_vistoria'::regtype) THEN
        ALTER TYPE status_vistoria ADD VALUE 'em_andamento';
    END IF;
    
    -- Verificar e adicionar 'concluida' se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'concluida' AND enumtypid = 'status_vistoria'::regtype) THEN
        ALTER TYPE status_vistoria ADD VALUE 'concluida';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END$$;

-- 2. Corrigir função RPC para usar nomes corretos das colunas da tabela vistorias
CREATE OR REPLACE FUNCTION public.buscar_tarefa_atual_vistoriador(p_vistoriador_id UUID)
RETURNS TABLE (
  id UUID, 
  tipo TEXT, 
  status TEXT, 
  data_agendada DATE, 
  hora_agendada TIME, 
  associado_id UUID, 
  associado_nome TEXT, 
  associado_telefone TEXT, 
  veiculo_id UUID, 
  veiculo_placa TEXT, 
  veiculo_marca TEXT, 
  veiculo_modelo TEXT, 
  logradouro TEXT, 
  numero TEXT, 
  bairro TEXT, 
  cidade TEXT, 
  uf TEXT, 
  endereco_latitude DOUBLE PRECISION, 
  endereco_longitude DOUBLE PRECISION, 
  rota_id UUID
) AS $$
BEGIN
  -- Primeiro buscar instalações ativas (prioridade)
  RETURN QUERY
  SELECT 
    i.id, 
    'instalacao'::TEXT, 
    i.status::TEXT, 
    i.data_agendada, 
    i.hora_agendada, 
    i.associado_id, 
    a.nome, 
    a.telefone, 
    i.veiculo_id, 
    v.placa, 
    v.marca, 
    v.modelo, 
    i.logradouro, 
    i.numero, 
    i.bairro, 
    i.cidade, 
    i.uf, 
    i.endereco_latitude::DOUBLE PRECISION, 
    i.endereco_longitude::DOUBLE PRECISION, 
    i.rota_id
  FROM instalacoes i 
  LEFT JOIN associados a ON a.id = i.associado_id 
  LEFT JOIN veiculos v ON v.id = i.veiculo_id
  WHERE i.instalador_responsavel_id = p_vistoriador_id 
    AND i.status IN ('em_rota', 'em_andamento')
    AND (i.local_vistoria IS NULL OR i.local_vistoria = 'cliente')
  ORDER BY CASE WHEN i.status = 'em_andamento' THEN 0 ELSE 1 END 
  LIMIT 1;
  
  -- Se não encontrou instalação, buscar vistorias ativas
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      vis.id, 
      'vistoria'::TEXT, 
      vis.status::TEXT, 
      vis.data_agendada::DATE,
      vis.horario_agendado,           -- CORREÇÃO: era hora_agendada
      vis.associado_id, 
      a.nome, 
      a.telefone, 
      vis.veiculo_id, 
      v.placa, 
      v.marca, 
      v.modelo, 
      vis.endereco_logradouro,        -- CORREÇÃO: era logradouro
      vis.endereco_numero,            -- CORREÇÃO: era numero
      vis.endereco_bairro,            -- CORREÇÃO: era bairro
      vis.endereco_cidade,            -- CORREÇÃO: era cidade
      vis.endereco_estado,            -- CORREÇÃO: era uf
      vis.endereco_latitude::DOUBLE PRECISION, 
      vis.endereco_longitude::DOUBLE PRECISION, 
      vis.rota_id
    FROM vistorias vis 
    LEFT JOIN associados a ON a.id = vis.associado_id 
    LEFT JOIN veiculos v ON v.id = vis.veiculo_id
    WHERE vis.vistoriador_id = p_vistoriador_id 
      AND vis.status IN ('em_rota', 'em_andamento')
      AND (vis.local_vistoria IS NULL OR vis.local_vistoria = 'cliente')
    ORDER BY CASE WHEN vis.status = 'em_andamento' THEN 0 ELSE 1 END 
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário explicativo
COMMENT ON FUNCTION public.buscar_tarefa_atual_vistoriador(UUID) IS 
'Busca a tarefa atual (instalação ou vistoria) em andamento para um vistoriador.
Corrigida para usar nomes corretos de colunas da tabela vistorias:
- horario_agendado (não hora_agendada)
- endereco_logradouro (não logradouro)
- endereco_numero (não numero)
- endereco_bairro (não bairro)
- endereco_cidade (não cidade)
- endereco_estado (não uf)';