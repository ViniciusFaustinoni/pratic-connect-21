## Caso confirmado no banco

| Campo | Valor |
|---|---|
| rastreador.id | `9ac6603f-1a16-4596-801b-fe4661379232` |
| imei | `359366080311592` |
| plataforma_device_id (Softruck) | `vG1VQNYazALAJkn` |
| veículo local (LTC8G02) softruck_vehicle_id | `PR97L1qVkzLnlrm` |
| status atual | `PENDING` / `tentativas=0` |
| associado | Daniele dos Santos Castro Monteiro |

A premissa do passo 1 é: no read-back, o `relationships.vehicle.data.id` do device deve voltar `RJS7E82` (≠ `PR97L1qVkzLnlrm`) — só desvincular se for isso.

A edge `softruck-api` já tem todas as ações necessárias: `buscar-device-imei`, `listar-devices-veiculo`, `desassociar-device-veiculo` (precisa `associationId`), `associar-device-veiculo`, `ativar-device`, `ativar-veiculo`, `buscar-usuario`, `criar-usuario`, `associar-usuario-veiculo`.

---

## Passo 1 — Edge one-off `softruck-corrigir-vinculo`

**Arquivo novo:** `supabase/functions/softruck-corrigir-vinculo/index.ts`

**Entrada:** `{ rastreador_id: string, dry_run?: boolean }`. Sem rota em lote — recusa se `rastreador_id` não vier (HTTP 400). Auth: caller token (RLS aplicada via `SUPABASE_SERVICE_ROLE_KEY` interno, ação exige role `monitoramento`/`admin` via `app_roles_config` — checagem leve no início).

**Sequência (idempotente; cada passo loga `etapa`/`detalhe` em `logs_auditoria` com `acao='criar'`):**

1.1 **GET confirmação** — `buscar-device-imei` com `includes[vehicle][]=plate&includes[vehicle][]=id`. Extrai `remoteDeviceId`, `remoteVehicleId`, `remotePlate`.
- Se `dry_run=true` → retorna `{ etapa:'confirmacao', remoteVehicleId, remotePlate, softruckVehicleIdLocal, divergente: bool }` e termina.
- Se `remoteVehicleId === softruckVehicleIdLocal` → nada a corrigir; grava `SUCCESS` + retorna `{status:'ja_correto'}`.
- Se `remoteVehicleId` ausente → pula direto pro 1.3 (não há o que desvincular).

1.2 **Desvincular do veículo errado** — chamar `listar-devices-veiculo` com `vehicleId=remoteVehicleId`, achar o item cujo `device.id === remoteDeviceId` (ou imei bater), pegar `association.id`, chamar `desassociar-device-veiculo` com esse id.

1.3 **Vincular ao veículo correto** — `associar-device-veiculo` com `deviceId=remoteDeviceId, vehicleId=softruckVehicleIdLocal, isPrincipal=true`. Se já existir associação (erro 409/duplicado), tratar como sucesso.

1.4 **Garantir usuário Softruck para Daniele** — `buscar-usuario` por email; se ausente, `criar-usuario` (mesma rotina já usada em `softruck-ativar-dispositivo` passos 7/8.2). Depois `associar-usuario-veiculo` no veículo correto (idempotente).

1.5 **`ativar-device` + `ativar-veiculo`** (idempotentes).

1.6 **Read-back final** — repetir 1.1. Comparar `remoteVehicleId` com local.
- Confirmado → UPDATE em `rastreadores`: `softruck_integration_status='SUCCESS'`, `softruck_tentativas=1`, `softruck_last_attempt_at=now()`, `ultima_comunicacao=now()` (provisório), `softruck_response_raw={ correcao:true, antes:remoteVehicleId_inicial, depois:remoteVehicleId_final }`. Enfileira `softruck_gps_poll_queue` (não-bloqueante).
- Falhou → `softruck_integration_status='PENDING'`, `softruck_tentativas=0`, `readback_failed=true`, `readback_reason='correcao_falhou:<motivo>'` para o cron retentar. Não promove para FAILED_VINCULO ainda — esse caminho é exclusivo do passo 3 quando o cron atinge limite.

**Não roda em massa.** Sem loop sobre tabela. Sem cron registrado.

---

## Passo 2 — `softruck-ativar-dispositivo` corrige `vehicle_divergente` no fluxo automático

**Arquivo editado:** `supabase/functions/softruck-ativar-dispositivo/index.ts` (bloco read-back atual, linhas 689–727).

Quando `readbackReason` começar com `vehicle_divergente:` (linha 714):

a) Extrai `remoteVehicleId` do reason ou do `readbackRemote`.
b) Chama internamente a mesma sub-rotina de **correção** (extraída do passo 1 para um helper compartilhado em `supabase/functions/_shared/softruck-corrigir.ts`, importado pelas duas edges) — desvincula do errado, vincula ao correto, ativa device/veículo.
c) Faz **novo read-back**.
- OK → segue como SUCCESS (sem alterar a lógica do 8.5; apenas substitui `readbackOk=true` e limpa `readbackReason`).
- Falhou → `PENDING` + `readback_reason='vehicle_divergente_correcao_falhou:<detalhe>'` + `softruck_tentativas=0` (igual hoje, para cron tentar de novo).

Só atua quando o read-back inicial classificou como `vehicle_divergente` — `device_ausente`, `device_sem_vehicle_associado` e `softruck_api_falhou` mantêm o comportamento atual (apenas PENDING). Isso garante que **nunca desvincula sem GET confirmando**.

---

## Passo 3 — Botão do drawer + status `FAILED_VINCULO` + cron com limite de tentativas

### 3.1 Botão "Reprocessar Sincronização Softruck"
**Arquivo:** `src/components/rastreadores/RastreadorDetailDrawer.tsx`, função `handleReprocessarSoftruck` (linha 198).

Hoje só faz UPDATE rebaixando para `PENDING`. Trocar por:

```ts
await supabase.functions.invoke('softruck-corrigir-vinculo', {
  body: { rastreador_id: rastreador.id }
});
```

Mostra toast com `etapa` retornada. Mantém o invalidate de queries.

### 3.2 Status `FAILED_VINCULO` + limite de 5 tentativas no cron
**Migration:** `softruck_integration_status` é coluna texto livre hoje (sem CHECK encontrado); não há mudança de schema necessária. Apenas convenção nova.

**Arquivo editado:** `supabase/functions/cron-softruck-reconciliar-pending/index.ts`
- Mantém filtro `.in('softruck_integration_status', ['PENDING','pending'])`.
- Quando processar e read-back final falhar **E** `softruck_tentativas >= 5` (após incrementar): grava `softruck_integration_status='FAILED_VINCULO'`, `softruck_response_raw.readback_reason` preservado. Sai da fila do cron.

### 3.3 Destaque visual de `FAILED_VINCULO`
**Arquivos editados:**
- `src/pages/monitoramento/Rastreadores.tsx` (lista) — badge vermelho "Falha de vínculo Softruck" quando `softruck_integration_status === 'FAILED_VINCULO'`, com filtro rápido no topo.
- `RastreadorDetailDrawer.tsx` — alerta destacado no topo do bloco Softruck quando `FAILED_VINCULO`, mantendo o botão Reprocessar (que zera tentativas e re-aciona a edge de correção).

Botão Reprocessar, ao rodar `softruck-corrigir-vinculo`, deve setar `softruck_tentativas=0` antes de tentar — ciclo recomeça.

---

## Restrições respeitadas

- `softruck-corrigir-vinculo` é one-off (recebe um `rastreador_id`; sem fila/cron próprio).
- Rede Veículos e Hinova intocados.
- Desvinculação automática só ocorre após GET confirmar `vehicle_divergente`.
- Antes de executar o passo 1 de verdade, eu chamarei a edge com `dry_run:true` e mostrarei aqui o resultado do GET — só depois da sua validação que o desvínculo+revínculo acontece.

## Arquivos tocados

Novos:
- `supabase/functions/softruck-corrigir-vinculo/index.ts`
- `supabase/functions/_shared/softruck-corrigir.ts` (helper de correção compartilhado)

Editados:
- `supabase/functions/softruck-ativar-dispositivo/index.ts` (bloco 8.4 — auto-correção em `vehicle_divergente`)
- `supabase/functions/cron-softruck-reconciliar-pending/index.ts` (limite 5 tentativas → `FAILED_VINCULO`)
- `src/components/rastreadores/RastreadorDetailDrawer.tsx` (`handleReprocessarSoftruck` chama nova edge + alerta `FAILED_VINCULO`)
- `src/pages/monitoramento/Rastreadores.tsx` (badge/filtro `FAILED_VINCULO`)

Sem migration de schema. Sem mudança em tabelas. Sem alteração em Rede/Hinova.
