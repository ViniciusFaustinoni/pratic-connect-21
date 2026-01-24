
-- Corrigir trigger sync_vistoria_to_servicos para não criar serviço quando data_agendada é NULL
-- O trigger atual falha porque tenta inserir NULL em servicos.data_agendada (NOT NULL)

CREATE OR REPLACE FUNCTION sync_vistoria_to_servicos()
RETURNS TRIGGER AS $$
BEGIN
  -- Só cria se não existir já um servico para esta vistoria
  -- E APENAS se houver data_agendada (evita erro NOT NULL)
  IF NOT EXISTS (SELECT 1 FROM servicos WHERE vistoria_origem_id = NEW.id) 
     AND NEW.data_agendada IS NOT NULL THEN
    INSERT INTO servicos (
      tipo,
      status,
      data_agendada,
      hora_agendada,
      associado_id,
      veiculo_id,
      latitude,
      longitude,
      logradouro,
      numero,
      bairro,
      cidade,
      uf,
      cep,
      permite_encaixe,
      local_vistoria,
      cotacao_id,
      contrato_id,
      vistoria_origem_id,
      origem,
      created_at,
      updated_at
    ) VALUES (
      map_vistoria_tipo_to_servico(NEW.tipo::text),
      (NEW.status::text)::status_servico,
      NEW.data_agendada,
      NEW.horario_agendado,
      NEW.associado_id,
      NEW.veiculo_id,
      NEW.endereco_latitude,
      NEW.endereco_longitude,
      NEW.endereco_logradouro,
      NEW.endereco_numero,
      NEW.endereco_bairro,
      NEW.endereco_cidade,
      NEW.endereco_estado,
      NEW.endereco_cep,
      COALESCE(NEW.permite_encaixe, false),
      COALESCE(NEW.local_vistoria, 'cliente'),
      NEW.cotacao_id,
      NEW.contrato_id,
      NEW.id,
      'vistoria',
      NOW(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION sync_vistoria_to_servicos() IS 
'Sincroniza vistorias para tabela servicos. Só cria serviço se data_agendada estiver preenchida para evitar violação de NOT NULL.';
