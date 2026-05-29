
## Escopo

3 itens cirúrgicos. Sem auditoria em massa, sem UPDATE histórico, sem tela nova.

---

## 1. Read-back antes de gravar SUCCESS

**Arquivo:** `supabase/functions/softruck-ativar-dispositivo/index.ts`, bloco 8.5 (linhas 684-722).

**Mudança:** entre o passo 8 (ativar veículo) e o `UPDATE` final do rastreador, fazer:

```ts
// Read-back: confirmar vínculo real na Softruck
const readbackUrl = `${BASE_URL}/v2/devices?filters[devices.imei][eq]=${encodeURIComponent(imei)}&includes[vehicle][]=plate&includes[vehicle][]=id`;
const readbackRes = await fetch(readbackUrl, { headers: { Authorization: `Bearer ${token}` }});
const readbackJson = await readbackRes.json().catch(() => ({}));
const remoteDevice = readbackJson?.data?.[0];
const remoteVehicleId = remoteDevice?.relationships?.vehicle?.data?.id;

let readbackOk = false;
let readbackReason: string | null = null;
if (!readbackRes.ok) {
  readbackReason = `http_${readbackRes.status}`;
} else if (!remoteDevice) {
  readbackReason = 'device_ausente_na_softruck';
} else if (!remoteVehicleId) {
  readbackReason = 'device_sem_vehicle_associado';
} else if (remoteVehicleId !== softruckVehicleId) {
  readbackReason = `vehicle_divergente:remoto=${remoteVehicleId}/local=${softruckVehicleId}`;
} else {
  readbackOk = true;
}
```

Aplicar no `updEarly`:
- Se `readbackOk` → `softruck_integration_status: 'SUCCESS'` (comportamento atual) + enfileira GPS poll.
- Se `!readbackOk` → `softruck_integration_status: 'PENDING'` + `softruck_response_raw: { ...existing, readback_failed: true, readback_reason, readback_remote: remoteDevice ?? null }`. **Não** enfileira GPS poll.

Cron reprocessa em até 10min sem intervenção.

## 2. Bug de case `pending` vs `PENDING`

**Arquivo:** `supabase/functions/cron-softruck-reconciliar-pending/index.ts`, linha 41.

```diff
- .eq("softruck_integration_status", "PENDING")
+ .in("softruck_integration_status", ["PENDING", "pending"])
```

**Migração de dados** (uma normalização única, via insert tool):
```sql
UPDATE rastreadores
SET softruck_integration_status='PENDING'
WHERE plataforma='softruck' AND softruck_integration_status='pending';
```

A partir daqui o read-back do item 1 sempre grava maiúsculo, então o caso `'pending'` não reaparece. O `.in([...])` fica como rede de segurança.

## 3. Botão "Reprocessar Sincronização Softruck" no drawer

**Arquivo:** `src/components/rastreadores/RastreadorDetailDrawer.tsx`, dentro do bloco Softruck existente (linhas 274-330, ao lado do botão "Reconciliar dados com a Softruck").

**Visibilidade:** botão aparece quando `rastreador.plataforma === 'softruck'` E (`softruck_integration_status` ∈ `['PENDING','pending','FAILED_AUTH','FAILED_DEVICE']` OU `softruck_integration_status='SUCCESS' && !ultima_comunicacao`).

**Ação:** UPDATE direto via supabase client (mesmo padrão do `handleReconciliarSoftruck`):
```ts
await supabase.from('rastreadores')
  .update({
    softruck_integration_status: 'PENDING',
    softruck_tentativas: 0,
    softruck_last_attempt_at: null,
    updated_at: new Date().toISOString(),
  })
  .eq('id', rastreador.id);
```
+ toast `"Reprocessamento enfileirado. O cron vai processar em até 10 min."` + invalidar query do detalhe.

Sem chamar edge — só rebaixa o registro e deixa o `cron-softruck-reconciliar-pending` (que roda a cada 10min) fechar.

---

## Restrições respeitadas

- ✅ Sem edge de auditoria, sem tabela nova.
- ✅ Sem UPDATE em massa nos 1.848 históricos — operador usa item 3 caso a caso.
- ✅ Rede Veículos e Hinova intocados.
- ✅ LTC8G02 será resolvido manualmente pelo operador no drawer pós-deploy.

## Detalhes técnicos

**Edição de código (sem migração de schema):**
- `supabase/functions/softruck-ativar-dispositivo/index.ts` — bloco 684-722.
- `supabase/functions/cron-softruck-reconciliar-pending/index.ts` — linha 41.
- `src/components/rastreadores/RastreadorDetailDrawer.tsx` — adicionar handler + botão dentro do bloco já existente em 274-330.

**Migração de dados única** (insert tool, ~1.911 linhas):
- `UPDATE rastreadores SET softruck_integration_status='PENDING' WHERE plataforma='softruck' AND softruck_integration_status='pending';`

**Memória a salvar após implementar:**
- `mem://logic/integrations/softruck-readback-antes-de-success` — registrar que SUCCESS exige confirmação GET `/v2/devices?filters[devices.imei]` com vehicle bate; falha grava PENDING + `readback_reason`; case `PENDING/pending` aceito no cron + normalização única feita.
