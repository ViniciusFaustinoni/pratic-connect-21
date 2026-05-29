
-- SWQ4I01 → Y5x1QEN07gZeljv
UPDATE public.veiculos
SET softruck_vehicle_id = 'Y5x1QEN07gZeljv', updated_at = now()
WHERE placa = 'SWQ4I01' AND softruck_vehicle_id IS NULL;

UPDATE public.rastreadores
SET plataforma_veiculo_id = 'Y5x1QEN07gZeljv',
    softruck_integration_status = 'SUCCESS',
    softruck_tentativas = 0,
    softruck_response_raw = jsonb_build_object(
      'manual_resync_at', now(),
      'motivo', 'saneamento_pos_colisao_20260529',
      'vehicle_id', 'Y5x1QEN07gZeljv',
      'plate_softruck', 'SWQ4I01',
      'device_association_id', 'vmBgL3X8omQ1p62',
      'device_id_softruck', '0Wx9Qn1egxLNRK2',
      'readback_confirmado', true
    ),
    updated_at = now()
WHERE imei = '862667083422561';

-- RFV2A76 → K3VgZ9l5EGQ5EYW
UPDATE public.veiculos
SET softruck_vehicle_id = 'K3VgZ9l5EGQ5EYW', updated_at = now()
WHERE placa = 'RFV2A76' AND softruck_vehicle_id IS NULL;

UPDATE public.rastreadores
SET plataforma_veiculo_id = 'K3VgZ9l5EGQ5EYW',
    softruck_integration_status = 'SUCCESS',
    softruck_tentativas = 0,
    softruck_response_raw = jsonb_build_object(
      'manual_resync_at', now(),
      'motivo', 'saneamento_pos_colisao_20260529',
      'vehicle_id', 'K3VgZ9l5EGQ5EYW',
      'plate_softruck', 'RFV2A76',
      'device_association_id', 'vmBgL3XXayQ1p62',
      'device_id_softruck', 'YlzjwMWXaPQ9xR3',
      'readback_confirmado', true
    ),
    updated_at = now()
WHERE imei = '357789645530731';

-- LRA9681 → VBq6ZPxqbqZNp5g
UPDATE public.veiculos
SET softruck_vehicle_id = 'VBq6ZPxqbqZNp5g', updated_at = now()
WHERE placa = 'LRA9681' AND softruck_vehicle_id IS NULL;

UPDATE public.rastreadores
SET plataforma_veiculo_id = 'VBq6ZPxqbqZNp5g',
    softruck_integration_status = 'SUCCESS',
    softruck_tentativas = 0,
    softruck_response_raw = jsonb_build_object(
      'manual_resync_at', now(),
      'motivo', 'saneamento_pos_colisao_20260529',
      'vehicle_id', 'VBq6ZPxqbqZNp5g',
      'plate_softruck', 'LRA9681',
      'device_association_id', '12BVLrN7yALaGz8',
      'device_id_softruck', 'd5gKZRv51YZr0PY',
      'readback_confirmado', true
    ),
    updated_at = now()
WHERE imei = '862667083433089';
