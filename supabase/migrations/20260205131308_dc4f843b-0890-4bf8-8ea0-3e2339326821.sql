-- Habilitar suporte a posição em tempo real e histórico para Rede Veículos
UPDATE rastreadores_config_plataformas
SET 
  suporta_posicao_tempo_real = true,
  suporta_historico_trajeto = true,
  updated_at = NOW()
WHERE plataforma = 'rede_veiculos';