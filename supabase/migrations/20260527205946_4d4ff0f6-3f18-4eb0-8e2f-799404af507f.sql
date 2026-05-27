UPDATE rastreadores
SET softruck_integration_status = 'PENDING',
    plataforma_device_id = NULL,
    plataforma_veiculo_id = NULL,
    softruck_response_raw = jsonb_build_object(
      'reprocesso_em', now(),
      'motivo', 'softruck_device_existe_mas_sem_vehicle_vinculado',
      'estado_anterior', jsonb_build_object(
        'softruck_integration_status', softruck_integration_status,
        'plataforma_device_id', plataforma_device_id,
        'plataforma_veiculo_id', plataforma_veiculo_id,
        'softruck_response_raw', softruck_response_raw
      )
    ),
    updated_at = now()
WHERE imei IN ('357789643345074','354522182129325');