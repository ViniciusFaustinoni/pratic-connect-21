## Diagnóstico

Os três associados estão presos pelo **mesmo problema lógico** no fluxo `sga-hinova-sync`, com duas variações:

### Estado no banco

| Associado | Placa | `origem_cadastro` | `codigo_hinova` (associado) | `status_sga` (veículo) | Sintoma |
|---|---|---|---|---|---|
| GABRIEL (KPJ4994) | Renault Duster | `api_externa` | **20835** | `erro_sincronizacao` | Loop no guard |
| EDGAR (TUM3D59) | Honda CG 160 | `api_externa` | **13194** | `erro_sincronizacao` | Loop no guard |
| MATEUS (RVH8J53) | Fiat Cronos | `interno` | `null` | `pendente` | Nunca foi enviado (sem fila, sem logs) |

### Causa raiz (Gabriel e Edgar)

`supabase/functions/sga-hinova-sync/index.ts` linhas 342–353:

```ts
if (associado.origem_cadastro === 'api_externa') {
  if (req_body.bypass_guard_base_antiga && associado.codigo_hinova) { ... }
  else {
    // BLOQUEIA TUDO
    "Associado base antiga (codigo_hinova=20835). Envio bloqueado para evitar duplicidade."
  }
}
```

O guard foi criado para evitar **duplicar associado** vindo da base antiga. Mas ele **bloqueia até casos legítimos** onde:

- O associado já existe no SGA (`codigo_hinova` preenchido); e
- O que falta é apenas **adicionar um novo veículo** ao associado existente.

O `cron-sga-retry` chama `sga-hinova-sync` sem `bypass_guard_base_antiga: true`, então a fila bate no guard a cada 20 min indefinidamente (logs `sga_sync_logs` mostram dezenas de tentativas hoje 14h–18h). É exatamente o cenário que o usuário descreve: "está no SGA mas essa placa não" — o associado existe, falta inserir o veículo novo.

O fluxo abaixo do guard (linhas 526+) **já sabe lidar** com esse cenário: busca o associado por CPF, reaproveita `codigo_associado_hinova` e cadastra apenas o veículo. Ou seja, o bypass é seguro nesse caso.

### Causa raiz (Mateus)

- `origem_cadastro = 'interno'` (não cai no guard).
- Sem registro em `sga_sync_queue` nem em `sga_sync_logs` para o veículo.
- `status_sga = 'pendente'` mas a sync nunca foi disparada.
- Provável que o trigger/fluxo de ativação não tenha enfileirado, ou o veículo entrou via fluxo que pula o enqueue. Basta disparar `sga-hinova-sync` uma vez — busca por CPF deve achar o associado no SGA e adicionar a placa.

---

## Plano de correção

### 1. Ajustar o guard em `sga-hinova-sync` (correção definitiva)

Em `supabase/functions/sga-hinova-sync/index.ts`, linhas 342–353, alterar a regra para:

- **Se** `associado.origem_cadastro === 'api_externa'` **E** `associado.codigo_hinova` já existe → **bypass automático** (logar `guard_base_antiga_auto_bypass`), seguir o fluxo normal (que vai apenas adicionar o veículo ao associado existente).
- **Se** `origem_cadastro === 'api_externa'` **E** `codigo_hinova` é `null` → manter bloqueio (cenário onde realmente há risco de duplicar associado), exigindo flag explícita `bypass_guard_base_antiga` para forçar.

Isso resolve estruturalmente Gabriel e Edgar, e qualquer caso futuro idêntico (associado migrado da base antiga ganhando placas novas).

### 2. Reprocessar os 3 casos imediatamente

Após o ajuste:

- **Gabriel** (`veiculo_id=cde763e9...`): item já está em `sga_sync_queue` com `status='processando'`. Resetar para `pendente` com `proximo_reenvio_em=now()` e invocar `sga-hinova-sync` manualmente.
- **Edgar** (`veiculo_id=55c2f9bc...`): mesmo procedimento.
- **Mateus** (`veiculo_id=92b19ba5...`): inserir item em `sga_sync_queue` (origem `manual`) e invocar `sga-hinova-sync` com `status_sga_destino` apropriado (`pendente` ou `ativo` conforme `cobertura_total`).

Tudo via uma migração curta + invocação direta da edge function.

### 3. Validação pós-execução

Conferir nos logs `sga_sync_logs` que cada um teve a sequência `buscar_associado:success → cadastrar_veiculo:success → atualizar_codigo_hinova:success` e que `veiculos.codigo_hinova` foi populado e `status_sga` virou `pendente_sga` ou `ativado_sga`.

---

## Arquivos afetados

- **Edição**: `supabase/functions/sga-hinova-sync/index.ts` (somente o bloco do guard, ~10 linhas)
- **Migração**: 1 SQL curto para resetar/inserir itens em `sga_sync_queue`
- **Pós**: invocar `cron-sga-retry` (ou disparar 3 chamadas diretas a `sga-hinova-sync`) para processar a fila já no novo comportamento

Sem mudança de UI, schema ou contratos.
