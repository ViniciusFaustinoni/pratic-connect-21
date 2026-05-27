## Contexto

Diagnóstico já validado: nos casos **RUM0H01** e **QPW4H53**, a `softruck-ativar-dispositivo` chegou até a etapa 8 (device/veículo criados na Softruck), mas o **UPDATE final** do registro local em `rastreadores` (status `SUCCESS`, IDs, `response_raw`) e a sincronização de `veiculos.softruck_vehicle_id` **não aconteceram**. Sem `FAILED_*` registrado: o corte foi mid-flow, não erro de negócio. RUM0H01 foi consertado manualmente sem padrão documentado.

Hoje já existe a edge `rastreador-reconciliar-softruck`, mas ela faz o sentido **inverso** do que precisamos: ela detecta que o device na Softruck não tem veículo associado e **desvincula** localmente (status `RECONCILIADO`). **Não cobre** o caso em que o device/veículo **existe** lá e o local ficou incompleto.

---

## (a) Edge canônica `softruck-reconciliar-pending`

**Objetivo:** transformar o fix manual do RUM0H01 em caminho canônico, e usar o QPW4H53 como primeiro caso oficial desse caminho.

**Nova edge:** `supabase/functions/softruck-reconciliar-pending/index.ts`.
Não reusar `rastreador-reconciliar-softruck` (semântica oposta — desvínculo vs completar vínculo).

**Entrada:**
```ts
{ rastreador_id: string; dry_run?: boolean }
```
(`imei` é derivado do registro local; `dry_run` retorna o plano sem aplicar.)

**Pré-condições para aceitar:**
- `rastreadores.plataforma = 'softruck'`
- `softruck_integration_status` em `('PENDING','CREATED_BUT_NOT_ACTIVATED', NULL)` **ou** ausência de `plataforma_device_id`/`plataforma_veiculo_id` mesmo com `status='instalado'`
- Tem `veiculo_id` local (rastreador já tinha sido apontado para um veículo)

Se o registro já está `SUCCESS` com IDs completos, retorna `{ applied:false, reason:'already_reconciled' }`.

**Fluxo:**
1. Autenticar usuário (igual `rastreador-reconciliar-softruck`).
2. Buscar token Softruck (mesmo helper já em uso).
3. `GET /devices?filters[devices.imei][eq]=<imei>&includes[vehicle][]=plate` — confirmar que device existe lá e capturar `device.id`, `vehicle.id`, `vehicle.attributes.plate`.
4. Comparar `vehicle.plate` remoto com `veiculos.placa` local do `veiculo_id` apontado:
   - Match → seguir.
   - Divergência → 409 `placa_divergente` (NUNCA aplicar — segue caminho `rastreador-reconciliar-softruck` para desvínculo).
   - Device não existe na Softruck → 404 `device_nao_existe` (orienta reativar fluxo normal).
5. **UPDATE final canônico** em `rastreadores` (a parte que faltou):
   ```
   plataforma_device_id, plataforma_veiculo_id,
   softruck_chip_id (se vier do remoto),
   softruck_integration_status = 'SUCCESS',
   softruck_response_raw = { reconciled_from_pending: true, source: 'softruck-reconciliar-pending', remote: {...}, reconciliado_em, reconciliado_por }
   ```
6. `UPDATE veiculos SET softruck_vehicle_id = <remote.vehicle.id> WHERE id = rastreador.veiculo_id` (a outra parte que faltou no RUM0H01).
7. Inserir em `rastreadores_api_logs` com `motivo = 'RECONCILED_FROM_PENDING'`, request/response brutos e usuário.
8. (Opcional, **não-bloqueante**) enfileirar/disparar 1 chamada de `tracking` para popular `ultima_posicao_*`. Falha não desfaz a reconciliação.

**Disparo no front:**
- Botão "Reconciliar Softruck" no drawer do rastreador, visível **só** quando os critérios da pré-condição batem.
- Fluxo: `dry_run=true` → mostra preview (local × remoto) → confirmação → `dry_run=false`.
- Toast com `applied:true` + IMEI; abre o registro atualizado.

**QPW4H53:** primeiro caso a rodar pela nova edge (não como manual-fix). RUM0H01 fica como histórico (já consertado).

---

## (b) Refactor da `softruck-ativar-dispositivo`

**Objetivo:** garantir que um corte mid-flow nunca mais deixe o registro em estado fantasma. Polling de GPS sai do caminho síncrono.

### Mudança 1 — estados intermediários determinísticos

Estender o tipo `IntegrationStatus` e gravar o estágio atual **antes** de cada etapa custosa via `updateIntegrationStatus`:

```
STEP_AUTH         → antes de obter token
STEP_VEHICLE      → antes de criar/buscar veículo
STEP_CHIP         → antes de criar chip
STEP_DEVICE       → antes de criar device
STEP_ASSOCIATE    → antes de associar device↔veículo
STEP_USER         → antes de criar usuário do cliente
STEP_READY        → após UPDATE final canônico (substituto do antigo SUCCESS síncrono)
STEP_GPS_POLL     → marcador do job assíncrono em andamento
SUCCESS           → set somente após primeira posição (ou timeout sem erro)
```

Em cada step, persistir também `softruck_payload_sent` parcial — assim sweep/reconciliação enxergam exatamente até onde foi.

### Mudança 2 — UPDATE final **antes** do GPS

O bloco atual (linhas 658–745) está invertido: faz polling síncrono de GPS (até 30 s) **antes** do UPDATE final. Se o runtime corta nesse intervalo, o registro fica incompleto — exatamente o caso RUM0H01/QPW4H53.

Novo encadeamento:
1. Etapa 8 termina (associate/ativar) → `STEP_READY`.
2. **UPDATE final canônico imediato** com IDs + `softruck_integration_status='STEP_READY'` + `softruck_response_raw` (sem `primeiraPos`).
3. `UPDATE veiculos.softruck_vehicle_id` na mesma transação lógica.
4. Só depois, disparar GPS de forma assíncrona (ver Mudança 3). Falha do GPS nunca reverte os passos 2/3.

### Mudança 3 — polling GPS assíncrono

Polling síncrono atual (3 tentativas × 10 s) sai do request. Duas opções, escolher a mais barata operacionalmente:

- **Opção A (preferida):** enfileirar em `sga_sync_queue`-style/tabela `softruck_gps_poll_queue` (criar se não existir) com `{ rastreador_id, device_id, vehicle_id, attempts, next_run_at }`. Cron de 1 minuto (`cron-softruck-gps-poll`) consome até N por execução, atualiza `ultima_posicao_*` quando chega, marca `SUCCESS`; após X tentativas sem GPS, marca `SUCCESS_NO_GPS` (estado terminal benigno, não-falha).
- **Opção B:** `EdgeRuntime.waitUntil(...)` dentro da própria função para 1 background tick (mais simples, mas se o runtime reciclar, perde — daí preferir A).

A resposta HTTP da `softruck-ativar-dispositivo` retorna assim que `STEP_READY` está gravado. Frontend deixa de esperar GPS para considerar o vínculo "concluído".

### Mudança 4 — idempotência verificável por etapa

Antes de cada criação remota, consultar se o item já existe (`devices?filters[imei][eq]`, `vehicles?filters[plate][eq]`, `chips?filters[serial][eq]`), reusar quando achar. Documentar no log a decisão (`reused_existing` vs `created`). Garantir que rodar a edge 2× para o mesmo IMEI nunca duplica device/vehicle/chip.

### Mudança 5 — sweep periódico de PENDING

Cron novo (`cron-softruck-reconciliar-pending`, 5–15 min) que:
- Lista rastreadores em `STEP_VEHICLE`/`STEP_CHIP`/`STEP_DEVICE`/`STEP_ASSOCIATE`/`STEP_USER` há > 5 min sem progressão.
- Para cada um, chama `softruck-reconciliar-pending` em `dry_run=false` quando seguro (placa bate, device existe). Se não seguro, registra fila para revisão manual.
- Garante que casos futuros tipo RUM0H01/QPW4H53 sejam fechados sem operador.

### Mudança 6 — log canônico

Toda etapa relevante grava em `rastreadores_api_logs` com `motivo` em `('STEP_*','RECONCILED_FROM_PENDING','FAILED_*','SUCCESS','SUCCESS_NO_GPS')`. Sweep/reconciliação consomem esse log para reconstruir histórico.

---

## (c) Item separado (registrar, não executar)

**QPW4H53 — duplicação Hinova:**
- `cotacoes.status_sga='erro_sincronizacao'`, motivo placa duplicada (codigo_associado=14209 no Hinova).
- Reconciliar Softruck via (a) **não** resolve isso.
- Tarefa apartada: investigar a duplicação na Hinova, identificar qual codigo_associado é o canônico, decidir inativação/limpeza no painel SGA antes de qualquer reenfileiramento em `sga_sync_queue`.
- Sem implementação agora — fica como TODO documentado.

---

## Plano de saída

1. Migration (se Opção A): tabela `softruck_gps_poll_queue` + grants + RLS.
2. Edge nova `softruck-reconciliar-pending` (a).
3. Refactor da `softruck-ativar-dispositivo` (b) — estados STEP_*, UPDATE final antes do GPS, polling assíncrono, idempotência.
4. Edge cron `cron-softruck-reconciliar-pending` (sweep).
5. Botão UI no drawer do rastreador para `softruck-reconciliar-pending` (dry_run + apply).
6. Testes Deno: idempotência, corte mid-flow simulado, reconciliação ponto-a-ponto.
7. Rodar (a) para QPW4H53 como primeiro caso oficial.
8. Memória: registrar caminho canônico em `mem://logic/integrations/softruck-reconciliar-pending-canonico` e atualizar `mem://logic/operations/softtruck-desvinculo-bidirecional` cruzando os 2 sentidos (desvínculo × completar vínculo).

## Fora de escopo

- Tratar a duplicação Hinova do QPW4H53.
- Mudar contratos/cotações/financeiro.
- Mexer em `rastreador-reconciliar-softruck` (continua válida para o sentido inverso).
