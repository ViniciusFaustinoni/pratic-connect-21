
-- Reconciliação manual: veículo LSQ6E05 (Hyundai HB20) — MARCUS AURELIO
-- Softruck já confirmou ativação do IMEI 868018075132830.
-- SGA Hinova já está sincronizado (associado 30056, veículo 35778).
-- Falta apenas: vincular rastreador ao veículo + concluir instalação para
-- o trigger fn_reativar_cobertura_pos_instalacao promover veiculo.status='ativo'.

UPDATE rastreadores
SET veiculo_id = '6c240d65-764c-45f7-8158-f73008407a64',
    associado_id = '4027e672-7ab6-4ace-a8bf-c907a1d23bf7',
    status = 'instalado',
    updated_at = now()
WHERE imei = '868018075132830';

-- Concluir a instalação cancelada de 22/04 (mais recente) com o rastreador vinculado.
UPDATE instalacoes
SET status = 'concluida',
    rastreador_id = (SELECT id FROM rastreadores WHERE imei='868018075132830'),
    concluida_em = now(),
    updated_at = now()
WHERE id = 'b4323017-adc1-43b9-8906-57e403509c97';
