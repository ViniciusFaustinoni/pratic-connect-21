UPDATE sga_sync_queue
SET status = 'falha_permanente',
    erro_ultimo = 'Placa RFL7J00 permanece vinculada ao codigo_associado=22638 (Douglas) no Hinova mesmo após inativação do veículo (cod=26718, situação 2) E do associado antigo (situação 2). A API pública da Hinova não libera o índice de placas via inativação — intervenção manual necessária no painel SGA: desvincular a placa do associado 22638 (ou usar a função de transferência interna do SGA). Após isso, re-enfileirar via /configuracoes/integracoes/sga-hinova?placa=RFL7J00.'
WHERE veiculo_id = 'a180e267-2d4f-4b55-a916-36b27a548cc8';