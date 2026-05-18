
UPDATE contratos
SET status = 'assinado',
    cadastro_aprovado = false,
    aprovado_por = NULL,
    aprovado_em = NULL,
    updated_at = now()
WHERE id = 'ae3b10af-100a-462d-8394-6be39a54d801';

UPDATE associados
SET status = 'documentacao_pendente',
    updated_at = now()
WHERE id = 'e1823797-eaf9-4e97-8f20-dd1e7276f485';

UPDATE veiculos
SET status = 'em_analise',
    cobertura_roubo_furto = false,
    cobertura_total = false,
    cobertura_suspensa = true,
    cobertura_suspensa_motivo = 'sub_fipe_autovistoria_incompleta_revert_2026-05-18',
    cobertura_suspensa_em = now(),
    updated_at = now()
WHERE id = '6a60b9b6-e6df-47e6-bb14-b82852383d03';

UPDATE servicos
SET status = 'cancelada',
    updated_at = now()
WHERE id = 'fc91afa8-f786-46d7-90b7-64d66bda22b2'
  AND status = 'agendada';

INSERT INTO ativacao_status_log (associado_id, contrato_id, from_status, to_status, source, actor_id, payload)
VALUES (
  'e1823797-eaf9-4e97-8f20-dd1e7276f485',
  'ae3b10af-100a-462d-8394-6be39a54d801',
  'ativo',
  'documentacao_pendente',
  'manual:revert_sub_fipe_sem_autovistoria_completa_2026-05-18',
  NULL,
  jsonb_build_object(
    'motivo', 'Sub-FIPE (R$ 29.894 < R$ 30k carros) ativado em 30/04 sem autovistoria completa (31 fotos) nem rastreador; apenas 3 fotos enxutas. Revertido manualmente.',
    'placa', 'KZK1I95',
    'valor_fipe', 29894,
    'veiculo_id', '6a60b9b6-e6df-47e6-bb14-b82852383d03',
    'cotacao_id', '5d5189e4-39ae-411d-b009-15eb4dbb8677'
  )
);
