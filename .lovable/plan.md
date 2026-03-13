

## Problem

Two issues:
1. **Installer app doesn't auto-refresh** — currently polls every 10s with 5s stale time. User wants faster (5s).
2. **WhatsApp `tecnico_a_caminho_1` not sent on assignment** — line 464 in `cron-atribuir-tarefas` explicitly skips it, saying "will be sent when installer starts route". User wants it sent immediately when the task is assigned.

## Changes

### 1. Reduce polling to 5s (`src/hooks/useTarefaAtual.ts`)
- `refetchInterval`: 10000 → **5000**
- `staleTime`: 5000 → **3000**

Combined with the existing Realtime subscription, this ensures tasks appear within 0-5 seconds max.

### 2. Send `tecnico_a_caminho_1` on assignment (`supabase/functions/cron-atribuir-tarefas/index.ts`)

Replace the commented-out block at lines 464-466 with an actual call to `notificar-cliente`:

```typescript
// Send tecnico_a_caminho_1 to associate immediately on assignment
await supabase.functions.invoke('notificar-cliente', {
  body: {
    tipo: 'tecnico_em_rota',
    associado_id: instCompleta.associado_id,
    dados: {
      tecnico_nome: tecNome,
      tecnico_telefone: tecTelefoneLimpo ? tecTelefoneLimpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : 'Não informado',
      tecnico_whatsapp_link: tecWhatsappLink,
      endereco: enderecoAssociado,
      periodo: instCompleta.periodo === 'manha' ? 'Manhã (08:00-12:00)' : 'Tarde (14:00-18:00)',
    }
  }
});
```

The technician data (`tecNome`, `tecTelefone`, `tecWhatsappLink`, `enderecoAssociado`) is already fetched at lines 452-462 — no additional queries needed.

### 3. Prevent duplicate notification on "Iniciar Rota" (`supabase/functions/notificar-inicio-rota/index.ts`)

Since the notification is now sent on assignment, we need to prevent it from being sent again when the installer clicks "Iniciar Rota". Add a check: if the service already has `em_rota_em` set (meaning it was auto-assigned with `em_rota` status), skip the `tecnico_em_rota` notification to avoid duplicate messages.

### Files changed
- **Edit**: `src/hooks/useTarefaAtual.ts` — reduce polling interval to 5s
- **Edit**: `supabase/functions/cron-atribuir-tarefas/index.ts` — restore WhatsApp notification on assignment
- **Edit**: `supabase/functions/notificar-inicio-rota/index.ts` — add guard to prevent duplicate notification

