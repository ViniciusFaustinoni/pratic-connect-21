## Problema

Hoje, em `/cadastro/veiculos`, a única ação destrutiva por linha é o trash vermelho (`useDeleteVeiculo`), que faz **DELETE permanente**. Não existe "cancelar veículo": só é possível cancelar o associado inteiro (cascata via `trg_cascata_cancelamento_associado`), o que é destrutivo demais para o associado com 3 veículos do exemplo (FRANCISCO FILHO / KRN6G76).

Falta o caminho: **cancelar 1 veículo**, derrubar processos vinculados a ele, e — só se o associado ficar sem nenhum veículo/contrato ativo — cancelar também o associado.

## Solução

Espelhar o padrão canônico de `cancelarAssociado` (`src/hooks/useAssociados.ts:703`), mas escopado a 1 veículo, reaproveitando a function existente `fn_cancelar_associado_se_orfao` (já implementada — usada hoje pelo `efetivar-troca-titularidade`).

### 1. Edge function nova: `supabase/functions/cancelar-veiculo/index.ts`

Input: `{ veiculoId, motivo }`. Auth: usuário interno autenticado (lê JWT → `cancelado_por`).

Sequência (não-bloqueante onde marcado):

1. **Guards**
   - Buscar veículo + associado_id + status; se já `cancelado`/`vendido`/`transferido` → 409.
   - Verificar `solicitacoes_troca_titularidade` aberta para a placa/veículo → 409 `TROCA_EM_ANDAMENTO`.
   - Verificar `solicitacoes_substituicao` aberta para o veículo → 409 `SUBSTITUICAO_EM_ANDAMENTO`.

2. **Cancelar processos vinculados ao veículo** (cascata escopada)
   - `cotacoes` do veículo com `status_contratacao NOT IN ('ativo','cancelada')` → marcar `cancelada` + `motivo_cancelamento`.
   - `instalacoes` com `status IN ('agendada','em_andamento','pendente')` → `cancelada` (triggers `cancelar_servicos_ao_cancelar_instalacao` já existentes propagam para `servicos`).
   - `servicos` abertos (`em_aberto/agendada/em_rota/em_andamento/em_analise`) por `veiculo_id` → `cancelada`. Trigger `trg_sync_agendamento_base_on_servico_terminal` fecha `agendamentos_base`.
   - `vistorias` em andamento ligadas via instalação/veículo → `cancelada` (triggers existentes).
   - `contratos` com `veiculo_id = X` e `status IN ('ativo','assinado','pendente')` → `cancelado` + `motivo_cancelamento` + `cancelado_em` (1 contrato : 1 veículo, confirmado no schema).
   - `cobertura_total` / `cobertura_roubo_furto` no veículo → false.

3. **Desvincular rastreador** (mesmo padrão do `cancelarAssociado`)
   - Softruck: `softruck-api { operation: 'desassociar-device-veiculo' }` (não-bloqueante).
   - Rede Veículos: chamar `rede-veiculos-desvincular-cliente` por veículo (não-bloqueante; o orquestrador `inativar-cliente-completo` é por associado, não serve aqui).
   - `rastreadores`: `veiculo_id=null, associado_id=null, status='estoque'`.

4. **SGA Hinova (não-bloqueante)**: enfileirar em `sga_sync_queue` `acao='inativar_veiculo'` com `codigo_hinova` do veículo. (Hoje só `efetivar-substituicao` faz inativação direta; aqui a operação é equivalente).

5. **Marcar veículo** `status='cancelado'`, `data_cancelamento=now()`, `motivo_cancelamento=<motivo>`.

6. **Auto-cancelar associado órfão**: `select fn_cancelar_associado_se_orfao(associado_id, motivo)`. A function existente já verifica `contratos.status IN (ativo,assinado,pendente)` AND `veiculos.status NOT IN (cancelado,vendido,transferido)`; se zero em ambos, marca `associados.status='cancelado'` e grava `associados_historico`. Retornar `{ associadoCancelado: bool }` no response.

7. **Audit log**: `insertAuditLog` com `acao='cancelar'`, `modulo='veiculos'`, descrição com placa + motivo + flag órfão.

### 2. Hook novo: `src/hooks/useCancelarVeiculo.ts`

`useMutation` chamando `supabase.functions.invoke('cancelar-veiculo', { body: { veiculoId, motivo } })`. Toasts:
- Sucesso veículo + associado cancelados: "Veículo cancelado. Associado também foi cancelado (sem veículos/contratos ativos)."
- Sucesso só veículo: "Veículo cancelado e processos vinculados encerrados."
- 409 troca/substituição: mensagem direcionada.

Invalida queries: `veiculos`, `associados`, `cotacoes`, `instalacoes`, `servicos`, `contratos`.

### 3. UI em `src/pages/cadastro/Veiculos.tsx`

**Substituir** o ícone de lixeira atual (DELETE permanente) por um `DropdownMenu` na coluna de ações com:

- **Cancelar veículo** (default, ícone `XCircle`, vermelho) — abre `CancelarVeiculoDialog` novo.
- **Excluir permanentemente** (só para Diretor/AdminMaster/Desenvolvedor — gate atual `canDeleteVeiculo`) — mantém o `useDeleteVeiculo` atual com aviso "destrutivo, sem auditoria de cancelamento".

Aplicar nas DUAS views (tabela desktop linhas 436–509 e cards mobile).

### 4. Componente novo: `src/components/veiculos/CancelarVeiculoDialog.tsx`

Padrão do `SuspenderVeiculoDialog`:
- Mostra placa + marca/modelo + associado.
- Select de motivo (`desistencia`, `inadimplencia`, `solicitacao_cliente`, `troca_para_outro_servico`, `outro`).
- Textarea de observações (obrigatória).
- Alert vermelho listando o que será cancelado: "contrato deste veículo, cotações/instalações/serviços/vistorias em aberto, rastreador volta ao estoque, sincronização SGA enfileirada".
- Aviso explícito quando for o último veículo ativo: "Este é o último veículo ativo. O associado também será cancelado automaticamente."
- Botão confirmar disparando `useCancelarVeiculo`.

### 5. Sem migrations DB

`fn_cancelar_associado_se_orfao` já existe. Triggers em cascata (`cancelar_servicos_ao_cancelar_instalacao`, `trg_sync_agendamento_base_on_servico_terminal`) já existem. Enum `status_veiculo` já inclui `cancelado`. Nada novo no schema.

## Out of scope

- Não tocar em `cancelarAssociado` nem em `trg_cascata_cancelamento_associado` (continuam sendo o caminho para cancelamento global).
- Não criar fluxo de termo de cancelamento Autentique para 1 veículo só (continua sendo via troca/substituição/cancelamento global).
- Não mexer no comportamento de "Vender" / "Suspender" (dialogs separados continuam).

## Critério de sucesso

- No exemplo do FRANCISCO: cancelar KRN6G76 → KRN6G76 vira `cancelado`, contrato/cotação/instalação dele encerram, rastreador volta ao estoque; LMT8B33 e o 3º seguem ativos; associado **permanece ativo** (badge volta de "Cancelado" para o status anterior — nota: o associado da screenshot já está "Cancelado", precisamos validar se o caso ali é regressão de outro fluxo antes).
- Cancelar o último veículo ativo do associado → função detecta órfão → marca associado como `cancelado` + grava histórico.
- Tentar cancelar veículo com troca/substituição aberta → 409 com mensagem clara.
- Trash "Excluir permanentemente" continua disponível só para Diretor.
