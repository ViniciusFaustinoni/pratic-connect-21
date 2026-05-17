DO $$
DECLARE v_count INT;
BEGIN
  WITH alvos AS (
    SELECT s.id AS servico_id, s.veiculo_id, s.contrato_id, v.placa, v.combustivel, v.valor_fipe, s.status AS status_anterior,
           COALESCE(mm.tipo_veiculo,
             CASE
               WHEN v.modelo ~* '(cg |cb |cb250|cb300|cb500|cb650|cb1000|fan|titan|twister|hornet|xre|bros|biz|pop |fazer|ys |xtz|lander|tenere|crf|mt-|mt0|nmax|burgman|xj6|r1|r3|r6|gsx|hayabusa|gixxer|intruder|v-strom|katana|drz|rmz|kxf|husqvarna|harley|sportster|iron|forty|softail|street|virago|midnight|bandit|cbr|gsr|z |z400|z650|z800|z900|z1000|ninja|versys|ducati|monster|panigale)'
                 THEN 'moto' ELSE 'carro'
             END) AS tipo_veiculo
    FROM servicos s
    JOIN veiculos v ON v.id = s.veiculo_id
    LEFT JOIN marcas_modelos mm
      ON lower(trim(mm.marca))  = lower(trim(v.marca))
     AND lower(trim(mm.modelo)) = lower(trim(v.modelo))
    WHERE s.tipo = 'vistoria_entrada'
      AND s.modalidade = 'autovistoria'
      AND s.status = 'concluida'
      AND NOT EXISTS (SELECT 1 FROM rastreadores r WHERE r.veiculo_id = s.veiculo_id)
  ),
  exigem AS (
    SELECT * FROM alvos
    WHERE combustivel ILIKE '%diesel%'
       OR (tipo_veiculo = 'carro' AND valor_fipe >= 30000)
       OR (tipo_veiculo = 'moto'  AND valor_fipe >=  9000)
  ),
  upd AS (
    UPDATE servicos s
       SET status = 'aprovada', updated_at = now()
      FROM exigem e
     WHERE s.id = e.servico_id
    RETURNING s.id, s.contrato_id, s.veiculo_id, e.placa, e.valor_fipe, e.tipo_veiculo, e.combustivel, e.status_anterior
  )
  INSERT INTO logs_auditoria (acao, modulo, tabela, registro_id, descricao, dados_anteriores, dados_novos)
  SELECT 'editar', 'monitoramento', 'servicos', upd.id,
         'saneamento_autovistoria_sem_rastreador: autovistoria estava concluida sem rastreador fisico em veiculo que exige; rebaixada para aprovada (terminal, fora da fila)',
         jsonb_build_object('status', upd.status_anterior),
         jsonb_build_object('status','aprovada','contrato_id',upd.contrato_id,'veiculo_id',upd.veiculo_id,
                            'placa',upd.placa,'valor_fipe',upd.valor_fipe,'tipo_veiculo',upd.tipo_veiculo,
                            'combustivel',upd.combustivel,'etapa','2/4')
  FROM upd;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Etapa 2/4: % servicos saneados', v_count;
END$$;