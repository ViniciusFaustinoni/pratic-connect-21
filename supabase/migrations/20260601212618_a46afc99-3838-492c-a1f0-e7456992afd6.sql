UPDATE rastreadores SET
  plataforma_device_id        = 'EzOvQeyEDdQKr5x',
  id_plataforma               = 'EzOvQeyEDdQKr5x',
  softruck_integration_status = 'PENDING',
  softruck_tentativas         = 0,
  softruck_response_raw       = jsonb_build_object(
    'operation', 'destrava_manual',
    'ts', now()::text,
    'raw', jsonb_build_object(
      'kind', 'destrava_manual',
      'caso', 'LUT8D25',
      'nota', 'Pre-popula plataforma_device_id para forcar fluxo a pular criar-device e ir direto pra associar-device-veiculo'
    )
  ),
  updated_at = now()
WHERE id = 'd014a0f4-7e74-4600-b614-714af4faf9f4';