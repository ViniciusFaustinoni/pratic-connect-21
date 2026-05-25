UPDATE public.associados
SET codigo_hinova = NULL,
    updated_at = now()
WHERE id = '26ac0b58-5e09-45cb-9b7b-3fda59e97176'
  AND cpf = '06980117750'
  AND codigo_hinova = '30470';

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
  'associados',
  '26ac0b58-5e09-45cb-9b7b-3fda59e97176',
  '[correcao_codigo_hinova_orfao] Placa LSA7A65 / SERGIO BARRETO DE AZEVEDO (CPF 06980117750) estava com codigo_hinova=30470 herdado da cotação cancelada do AURELIANO LUIZ BORGES (correção de identidade de 23/05 não limpou o vínculo SGA). Resultado: sga_sync_queue ia gravar contra o associado errado no Hinova. Codigo_hinova zerado + fila resetada para o sga-hinova-sync recriar pelo CPF correto.'
);
