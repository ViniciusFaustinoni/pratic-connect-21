
UPDATE associados SET status='em_analise', updated_at=now()
WHERE id='9d224455-caaf-4593-99de-6efa05cc851a';

UPDATE contratos
SET status='assinado', cadastro_aprovado=false, aprovado_em=NULL, aprovado_por=NULL, data_ativacao=NULL, updated_at=now()
WHERE id='176a17c4-c1ad-40cb-8718-96618ad1f2c1';

UPDATE veiculos
SET status='instalacao_pendente', cobertura_roubo_furto=false, updated_at=now()
WHERE id='31f320c3-6b3d-4505-826f-8840d211703d';

UPDATE servicos
SET status='em_analise', modalidade='autovistoria', origem='autovistoria_publica',
    vistoria_origem_id='13a1033a-af40-4be6-8f79-5f11e1bfecfe', profissional_id=NULL, updated_at=now()
WHERE id='25c63b3e-6239-490f-bc95-03fe330d79fe';
