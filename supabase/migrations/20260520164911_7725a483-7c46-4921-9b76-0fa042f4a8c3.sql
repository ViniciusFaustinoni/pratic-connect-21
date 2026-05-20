
WITH alvos AS (
  SELECT v.id, v.observacoes, c.data_ativacao
  FROM vistorias v
  JOIN contratos c ON c.id = v.contrato_id
  WHERE v.id IN (
    '0eade009-e7db-4107-bfd5-997dd87e989d',
    '2402397b-aeb9-4991-a11c-e9d611f3a4e8',
    '949f1f7c-76ff-4152-94bf-180fc38cfe59',
    'f4d44cce-ee41-4543-a4ff-23749e859845',
    '13a1033a-af40-4be6-8f79-5f11e1bfecfe',
    'c5a5ca87-c6f1-4186-b42e-2c2c6e090cb4'
  )
)
UPDATE vistorias v
SET status = 'aprovada',
    observacoes = concat(
      '[SANEAMENTO 20/05/2026] Vistoria presencial técnica supre aprovação retroativa de Monitoramento — contrato ativado em ',
      coalesce(to_char(a.data_ativacao, 'DD/MM/YYYY HH24:MI'), 'data desconhecida'),
      ' por vazamento pré-blindagem sub-FIPE em aprovar-proposta (corrigido). ',
      coalesce(v.observacoes, '')
    ),
    updated_at = now()
FROM alvos a
WHERE v.id = a.id;

UPDATE servicos
SET status = 'concluida',
    observacoes = concat(
      '[SANEAMENTO 20/05/2026] Concluído junto com aprovação retroativa da vistoria. ',
      coalesce(observacoes, '')
    ),
    updated_at = now()
WHERE id IN (
  'df3104ad-a357-4422-a3f7-5c8267c92ac7',
  '25c63b3e-6239-490f-bc95-03fe330d79fe'
);

INSERT INTO logs_auditoria (tabela, registro_id, acao, descricao, dados_novos, created_at)
SELECT 'vistorias', id, 'aprovar',
       'SANEAMENTO sub-fipe-pre-blindagem-20260520: vazamento pré-blindagem em aprovar-proposta (04-05/05/2026); vistoria presencial técnica completa supre aprovação retroativa de Monitoramento.',
       jsonb_build_object('lote', 'sub-fipe-pre-blindagem-20260520', 'novo_status', 'aprovada', 'motivo', 'saneamento_aprovacao_retroativa'),
       now()
FROM vistorias
WHERE id IN (
  '0eade009-e7db-4107-bfd5-997dd87e989d',
  '2402397b-aeb9-4991-a11c-e9d611f3a4e8',
  '949f1f7c-76ff-4152-94bf-180fc38cfe59',
  'f4d44cce-ee41-4543-a4ff-23749e859845',
  '13a1033a-af40-4be6-8f79-5f11e1bfecfe',
  'c5a5ca87-c6f1-4186-b42e-2c2c6e090cb4'
);
