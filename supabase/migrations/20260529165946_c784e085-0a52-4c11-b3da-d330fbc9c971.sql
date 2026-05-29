UPDATE public.veiculos
SET softruck_vehicle_id = 'vG1VQNVWV2QAJkn',
    updated_at = now()
WHERE id = 'bb051923-978b-46bc-ac47-9a5804650563'
  AND placa = 'LTC8G02';

UPDATE public.rastreadores
SET softruck_integration_status = 'SUCCESS',
    plataforma_veiculo_id = 'vG1VQNVWV2QAJkn',
    softruck_tentativas = 0,
    softruck_response_raw = jsonb_build_object(
      'manual_fix_at', now(),
      'reason', 'LTC8G02 estava com softruck_vehicle_id apontando para vehicle do RJS7E82 (Leandro). Criado vehicle novo e movido device + usuaria Daniele.',
      'vehicle_anterior', 'PR97L1qVkzLnlrm',
      'vehicle_novo', 'vG1VQNVWV2QAJkn',
      'device_association_id', 'z9klZ7YEkNL4onE',
      'user_association_id', '4lBVwD2GBAVQEzj'
    ),
    updated_at = now()
WHERE id = '9ac6603f-1a16-4596-801b-fe4661379232';