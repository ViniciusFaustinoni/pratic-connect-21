

## Problema Identificado

Ambas as funções de atribuição (`atribuir-proxima-tarefa` e `cron-atribuir-tarefas`) definem o status do serviço como `'em_rota'` imediatamente ao atribuir. Isso faz com que o card do instalador pule direto para o estado "Navegar + Cheguei no Local", sem nunca mostrar o botão "Iniciar Tarefa".

O fluxo atual:
```text
Tarefa sem profissional (pendente/agendada)
    ↓ atribuição
Status = 'em_rota' ← PULA "Iniciar Tarefa"
    ↓
Mostra: [Navegar] + [Cheguei no Local]
```

O fluxo desejado:
```text
Tarefa sem profissional (pendente/agendada)
    ↓ atribuição
Status = 'agendada' (com profissional_id preenchido)
    ↓
Mostra: [Iniciar Tarefa] ← instalador decide quando sair
    ↓ clica "Iniciar Tarefa"
Status = 'em_rota' + dispara WhatsApp ao associado
    ↓
Mostra: [Navegar] + [Cheguei no Local]
```

## Alterações

### 1. `supabase/functions/atribuir-proxima-tarefa/index.ts` (linha ~623-627)
Mudar o status de atribuição de `'em_rota'` para `'agendada'` e remover `em_rota_em`:
```typescript
const updateData: Record<string, any> = {
  profissional_id: profissionalId,
  status: 'agendada',  // Mantém agendada até o instalador clicar "Iniciar Tarefa"
  updated_at: agora
};
```

### 2. `supabase/functions/cron-atribuir-tarefas/index.ts` (linha ~348-352)
Mesma mudança:
```typescript
const updateData: any = {
  profissional_id: prof.vistoriador_id,
  status: 'agendada',  // Mantém agendada até o instalador clicar "Iniciar Tarefa"
  updated_at: agora
};
```

### 3. `supabase/functions/cron-atribuir-tarefas/index.ts` - Instalações (linha ~405-408)
Manter status da instalação como `agendada` também:
```typescript
const instUpdateData: any = {
  instalador_responsavel_id: prof.vistoriador_id,
  status: 'agendada'
};
```

### 4. `supabase/functions/cron-atribuir-tarefas/index.ts` - Vistorias (linha ~546-549)
```typescript
const vistUpdateData: any = {
  vistoriador_id: prof.vistoriador_id,
  status: 'agendada'
};
```

### 5. Deploy das duas Edge Functions

### Resultado
Ao ser atribuída, a tarefa aparece com status `agendada` no app. O instalador vê o botão "Iniciar Tarefa", faz o contato obrigatório, e ao clicar o status muda para `em_rota` + dispara o WhatsApp `tecnico_em_rota` ao associado.

