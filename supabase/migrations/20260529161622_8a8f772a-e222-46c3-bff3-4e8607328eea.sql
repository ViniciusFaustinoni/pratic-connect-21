UPDATE rastreadores
SET softruck_integration_status='PENDING',
    updated_at=now()
WHERE plataforma='softruck'
  AND softruck_integration_status='pending';