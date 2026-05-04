## Causa raiz

O contrato `b64c7ea7…` (veículo KWM9443 / FRANCISCO CARDINELE) está com `vendedor_id = 37beadcf…` (perfil "Teste"), que **não tem `codigo_sga_voluntario`**. O job `sga-hinova-sync` falha sempre na etapa `resolver_vendedor` com `"Vendedor Teste não possui codigo_sga_voluntario"`, deixando o veículo em `status_sga = erro_sincronizacao` e `sincronizado_hinova = false`.

O consultor correto é **BRUNO CARVALHO** (`profiles.id = 4d2c7ddd-9781-484b-8e0a-db3c9271a58c`, `codigo_sga_voluntario = 177`).

## Plano de correção (sem gambiarra)

1. **Reatribuir vendedor no contrato** (fonte canônica usada pelo `sga-hinova-sync`):
   - `UPDATE contratos SET vendedor_id = '4d2c7ddd-9781-484b-8e0a-db3c9271a58c' WHERE id = 'b64c7ea7-b62e-4a31-ab1b-8c31b381d28b'`
   - Também atualizar `leads` e `cotacoes` vinculadas ao mesmo associado/veículo, se apontarem para o vendedor "Teste", para manter consistência de hierarquia/comissão.

2. **Limpar estado de erro do veículo** para liberar nova tentativa:
   - `UPDATE veiculos SET status_sga = 'pendente', sincronizado_hinova = false WHERE id = '4f42daa9-…'`

3. **Disparar a sincronização oficial** via edge function `sga-hinova-sync` com `veiculo_id` + `associado_id` (mesmo caminho do botão "Ativar SGA" — usa lock, CAS e logs em `sga_sync_logs`). Não escrever `codigo_hinova` manualmente.

4. **Validar resultado**:
   - Confirmar `associados.codigo_hinova`, `veiculos.codigo_hinova`, `sincronizado_hinova = true`.
   - Conferir `sga_sync_logs` (último registro = `success`).
   - Confirmar que comissões futuras desse contrato passam pela grade do Bruno (memória: "Grade do vendedor prevalece").

## Observações

- Não altero histórico de comissões já lançadas — se houver lançamento atrelado ao "Teste", trato em passo separado depois que confirmar com você.
- Tudo via edge function/migrations padrão — nenhum bypass de trigger/lock.

Confirma para eu executar?