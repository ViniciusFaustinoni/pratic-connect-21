## Causa do erro

O toast "Failed to send a request to the Edge Function" é o erro do supabase-js quando a chamada HTTP nem chega à função (404 de função inexistente ou DNS ainda não propagado). Isso aconteceu porque a edge `cancelar-veiculo` tinha acabado de ser criada e o deploy automático ainda não havia concluído quando você clicou em "Confirmar cancelamento".

Verificado agora via curl direto: a função está **online**, recebe o body, valida guards e responde 404 `veiculo_nao_encontrado` quando o ID não existe — comportamento esperado. Imports `_shared/auditLog` e `_shared/hinova-client` resolvem normalmente.

## Ação

**Nenhuma alteração de código.** Basta repetir a operação:

1. Reabrir o veículo KRN6G76 em `/cadastro/veiculos`
2. Menu de ações → **Cancelar veículo**
3. Selecionar motivo (Desistência) + detalhes ("O ASSOCIADO DESISTIU")
4. Confirmar

Resultado esperado:
- Veículo KRN6G76 → `cancelado`
- Contrato/cotações/instalações/serviços/vistorias do KRN6G76 → `cancelada`
- Rastreador volta ao estoque (com tentativa de desvínculo Softruck/Rede)
- SGA Hinova enfileirado para inativação
- Como o badge mostra que é o último veículo ativo do associado, `fn_cancelar_associado_se_orfao` deve marcar o associado como `cancelado` também

## Se o erro acontecer de novo

Reportar de volta — abro os logs com `supabase--edge_function_logs cancelar-veiculo` para ver o stacktrace real (boot error, RPC inexistente, ou enum value rejeitado pelos UPDATEs em massa) e corrijo cirurgicamente.
