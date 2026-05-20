## Cancelar troca de titularidade KOU6D37

**Alvo identificado**
- Solicitação `dd250bcc-7c68-4bc4-b048-e1799ab8431f` (status `aguardando_monitoramento`)
- Veículo `d5181403…` Ford Fiesta 1.6 Flex placa KOU6D37
- Titular antigo: Marcos Vinicius Dativo Machado (`9c05d3c4…`)
- Novo titular pretendido: Vinicius Faustinoni (`6c178885…`)
- Cotação vinculada: `440a2f3b-b336-474d-9dc4-26f81212238c`
- Contrato gerado: `71b21fd9-9aec-441c-bcbd-3d77fa0b0806` (status `assinado`, `cadastro_aprovado=true`, `tipo_entrada=troca_titularidade`)

**Execução (3 passos, via migration de DATA fix — não altera schema)**

1. `solicitacoes_troca_titularidade` → marcar `status='cancelada'`, `motivo_reprovacao='Cancelamento manual solicitado pela diretoria'`, `reprovado_em=now()` para `dd250bcc…`.
2. `contratos` → marcar `71b21fd9…` como `status='cancelado'`, `cadastro_aprovado=false`, `cancelado_em=now()`, `motivo_cancelamento='Troca de titularidade cancelada manualmente'`.
3. `cotacoes` → marcar `440a2f3b…` como `status='cancelada'` (tira da fila Cadastro › Propostas Pendentes).
4. `veiculos` → `em_troca_titularidade=false` em `d5181403…` (libera o veículo do titular antigo).

**Pós-execução**
- Confirmar que a troca some de Monitoramento › Aprovação de Trocas e de Cadastro › Propostas Pendentes.
- Veículo segue ativo no titular antigo (Marcos Vinicius), proteção intacta.

**Não faremos**
- Não cancelar o termo na Autentique (já assinado pelo titular antigo; cancelar lá não é reversível e não faz parte do fluxo canônico de `cancelar-troca-titularidade`).
- Não disparar WhatsApp ao titular antigo (operação silenciosa a pedido).
- Sem alteração de código/UI — somente data-fix.