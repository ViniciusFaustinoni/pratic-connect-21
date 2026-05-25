UPDATE public.veiculos
SET codigo_hinova = NULL,
    sincronizado_hinova = false,
    sincronizado_hinova_em = NULL,
    status_sga = 'pendente_sga',
    updated_at = now()
WHERE id = '91975902-9488-4cf5-9095-a02f22dde9e5'
  AND placa = 'LSA7A65';

UPDATE public.sga_sync_queue
SET codigo_associado_hinova = NULL,
    codigo_veiculo_hinova = NULL,
    erro_ultimo = NULL,
    etapa_parou = NULL,
    status = 'pendente',
    tentativas = 0,
    proximo_reenvio_em = now(),
    ultima_tentativa_em = NULL
WHERE id = 'c1c24742-1522-4eef-8670-94273ee52a80';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao)
VALUES (
  'editar',
  'sga_hinova',
  'veiculos',
  '91975902-9488-4cf5-9095-a02f22dde9e5',
  '[correcao_codigo_hinova_orfao] Veículo LSA7A65 estava com codigo_hinova=36288 (registro no Hinova vinculado ao associado errado AURELIANO 30470). Codigo zerado + sincronizado_hinova=false para o sga-hinova-sync recriar o veículo no Hinova sob o associado correto SERGIO BARRETO (CPF 06980117750). AÇÃO MANUAL OPERADOR SGA: inativar/remover veículo 36288 do associado 30470 (AURELIANO) no painel Hinova — ficará órfão.'
);
