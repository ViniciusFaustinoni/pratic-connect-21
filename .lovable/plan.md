## Diagnóstico

**Rastreador IMEI 356430070876858** (id `690b2232…`):

- **No Softruck:** dispositivo está **sem placa / sem veículo** ("Sem tipo", PLACA = "-").
- **No nosso banco:** está com `veiculo_id = 6b5d8c7f…` (placa **0KMB37FC** — HONDA CG 160, associado HIGOR). A tela do print mostra QPN0773/Renata por estar com cache antigo, mas o problema central é o mesmo: **temos vínculo de veículo onde o Softruck já não tem nenhum**.
- `softruck_integration_status = PENDING` desde 06/05 13:06 — ou seja, nossa última tentativa de sincronizar com o Softruck nem completou com sucesso.

### Causa raiz

Hoje **não existe rotina que reflita o desvínculo feito DIRETAMENTE no Softruck** de volta para o nosso `rastreadores.veiculo_id`:

- `sync-rastreadores` só **resolve IMEI bruto → device hash id** e grava `plataforma_veiculo_id`. Quando a API retorna `vehicleId = null` (caso atual), o código **não zera** `plataforma_veiculo_id` nem `veiculo_id`, nem muda status. Linhas 234-248 só atualizam quando `resolved.vehicleId` existe.
- `softruck-webhook` reage a eventos vindos do Softruck, mas não há handler para "device_unlinked" / "vehicle_removed" que limpe o `veiculo_id` local.
- A regra existente "vínculo rastreador-veículo" (memória `mem://logic/operations/rastreador-vinculo-preservacao`) só permite zerar em retirada/substituição/cancelamento/venda/status terminal — feitos pelo nosso fluxo. Desvínculo manual no Softruck não está coberto.

## Plano de correção

### 1. Edge `sync-rastreadores` — refletir desvínculo do Softruck
No loop de resolução (linhas 229-257), quando o device existe no Softruck mas `vehicleId` vier `null` **e** localmente houver `veiculo_id`/`plataforma_veiculo_id`:
- Logar divergência (`[Sync] Desvínculo detectado no Softruck IMEI=…`).
- Limpar `plataforma_veiculo_id = null` no rastreador.
- **Não** apagar `veiculo_id` automaticamente (respeita memória de preservação) — em vez disso marcar `softruck_integration_status = 'DIVERGENCIA_DESVINCULO'` e gravar nota em `softruck_response_raw` para análise manual.
- Também atualizar `veiculos.softruck_vehicle_id = null` quando aplicável.

### 2. Nova ação manual no Painel — "Reconciliar com Softruck"
Botão no `RastreadorDetailDrawer` (apenas Diretor/Operação) que chama uma nova edge `rastreador-reconciliar-softruck`:
- Consulta o device no Softruck pelo IMEI.
- Se Softruck = sem veículo e local = com veículo: oferece **Desvincular veículo** (faz o `UPDATE veiculos.softruck_vehicle_id=null`, `rastreadores.veiculo_id=null, plataforma_veiculo_id=null, status='estoque'`) gravando log em `historico_movimentacoes_rastreador`.
- Se houver divergência inversa (Softruck tem placa X e nós temos Y): apenas reporta e bloqueia, exigindo decisão humana.

### 3. Banner de divergência
No `RastreadorCard` / detalhe, quando `softruck_integration_status = 'DIVERGENCIA_DESVINCULO'`, exibir um aviso amarelo "Divergência com Softruck — clique para reconciliar".

### 4. Correção pontual do caso atual
Após implementar (1) e (2), reconciliar o IMEI **356430070876858** via o novo botão para limpar o vínculo herdado do Higor (que já não está mais no Softruck).

## Detalhes técnicos
- **Não** acionar API Softruck para "criar/remover" vínculo — só leitura. Quem manda no Softruck é o painel deles; nós só refletimos.
- Rate-limit já existente (300 ms) preservado.
- Toda mudança em `veiculo_id` registrada em `historico_movimentacoes_rastreador` com motivo = "reconciliacao_softruck".
- Trigger de preservação (mem) **continua valendo** — a edge usa `service_role` e marca o motivo, igual aos outros fluxos canônicos.

## Arquivos a alterar/criar
- `supabase/functions/sync-rastreadores/index.ts` — detectar `vehicleId=null` e marcar divergência.
- `supabase/functions/rastreador-reconciliar-softruck/index.ts` — **novo**.
- `src/components/rastreadores/RastreadorDetailDrawer.tsx` — botão + modal de confirmação.
- `src/components/rastreadores/RastreadorCard.tsx` — badge de divergência.
- `src/hooks/useRastreadores.ts` — invalidação após reconciliação.

Confirma para eu implementar?