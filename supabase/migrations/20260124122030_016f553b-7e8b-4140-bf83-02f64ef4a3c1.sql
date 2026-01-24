-- Corrigir trigger sync_vistoria_update_to_servicos para não sobrescrever
-- data_agendada quando o valor na vistoria for NULL
-- Isso corrige o erro ao enviar vídeo em vistorias de entrada

CREATE OR REPLACE FUNCTION sync_vistoria_update_to_servicos()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar servico correspondente
  -- Usar COALESCE para preservar data_agendada existente quando vistoria não tiver data
  UPDATE servicos
  SET 
    status = (NEW.status::text)::status_servico,
    profissional_id = NEW.vistoriador_id,
    -- Preservar data_agendada do serviço se a vistoria não tiver data definida
    data_agendada = COALESCE(NEW.data_agendada, servicos.data_agendada),
    hora_agendada = COALESCE(NEW.horario_agendado, servicos.hora_agendada),
    latitude = NEW.endereco_latitude,
    longitude = NEW.endereco_longitude,
    logradouro = NEW.endereco_logradouro,
    numero = NEW.endereco_numero,
    bairro = NEW.endereco_bairro,
    cidade = NEW.endereco_cidade,
    uf = NEW.endereco_estado,
    cep = NEW.endereco_cep,
    permite_encaixe = COALESCE(NEW.permite_encaixe, false),
    local_vistoria = COALESCE(NEW.local_vistoria, 'cliente'),
    rota_id = NEW.rota_id,
    updated_at = NOW()
  WHERE vistoria_origem_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION sync_vistoria_update_to_servicos() IS 
'Sincroniza atualizações de vistorias para servicos. Usa COALESCE para preservar data_agendada do serviço quando a vistoria não tiver data definida (ex: vistorias de entrada vinculadas a instalações).';