
-- Fix RUM0H01: status PENDING era falso-positivo, device e veículo já estão mapeados na Softruck.
UPDATE public.rastreadores
SET softruck_integration_status='SUCCESS',
    softruck_response_raw = jsonb_build_object(
      'softruckVehicleId','0Wx9QnMARDLNRK2',
      'softruckDeviceId','357789643345074',
      'reconciled_at', now(),
      'reconciled_by','manual-fix-RUM0H01'
    ),
    updated_at = now()
WHERE id = '9374d4eb-6ca2-4fe5-8a3e-adc739e85933'
  AND softruck_integration_status = 'PENDING';

INSERT INTO public.rastreadores_api_logs (rastreador_id, veiculo_id, plataforma, operacao, status, request, response)
VALUES (
  '9374d4eb-6ca2-4fe5-8a3e-adc739e85933',
  'd72651b1-f665-46c0-8c9f-16b171c23676',
  'softruck',
  'reconciliar_pending_orfao',
  'sucesso',
  '{"motivo":"PENDING falso-positivo — device+veiculo ja mapeados na Softruck, status nunca progrediu para SUCCESS (worker timeout no polling de GPS)"}'::jsonb,
  '{"already_activated":true,"softruck_device_id":"357789643345074","softruck_vehicle_id":"0Wx9QnMARDLNRK2"}'::jsonb
);
