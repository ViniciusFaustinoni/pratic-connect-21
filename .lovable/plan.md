

## Plano: Auto-finalizar almoco no servidor (cron)

### Problema
A finalizacao do almoco apos 60 minutos so acontece no **client-side** (useEffect em `useJornadaTrabalho.ts`). Se o app do tecnico esta inativo ou em background, o status `em_almoco` permanece no banco indefinidamente. O cron (`cron-atribuir-tarefas`) ve `status === 'em_almoco'` e pula o profissional, que nunca mais recebe tarefas.

### Correcao
**`supabase/functions/cron-atribuir-tarefas/index.ts`** (linhas 170-174) — antes de pular o profissional em almoco, verificar se ja passou 60+ minutos. Se sim, finalizar o almoco automaticamente no servidor e continuar a atribuicao normalmente.

```typescript
// Onde hoje tem:
if (turnoHoje?.status === 'em_almoco') {
  console.log(`... em ALMOÇO - pulando`);
  continue;
}

// Substituir por:
if (turnoHoje?.status === 'em_almoco' && turnoHoje.inicio_almoco) {
  const inicioAlmoco = new Date(turnoHoje.inicio_almoco);
  const agora = new Date();
  const minutosEmAlmoco = Math.floor((agora.getTime() - inicioAlmoco.getTime()) / 60000);

  if (minutosEmAlmoco < 60) {
    console.log(`... em ALMOÇO há ${minutosEmAlmoco}min - pulando`);
    continue;
  }

  // Almoco expirado — finalizar automaticamente no servidor
  const minutosAtraso = Math.max(0, minutosEmAlmoco - 60);
  console.log(`... ALMOÇO expirado (${minutosEmAlmoco}min) — finalizando server-side`);
  
  await supabase
    .from('turnos_profissionais')
    .update({
      status: 'ativo',
      fim_almoco: agora.toISOString(),
      minutos_atraso_almoco: minutosAtraso,
    })
    .eq('id', turnoHoje.id);
  
  // Continuar normalmente (nao dar continue) para atribuir tarefa
}
```

**Mesma logica em `supabase/functions/atribuir-proxima-tarefa/index.ts`** (linhas 229-252) — quando o tecnico pede tarefa e o almoco ja expirou, finalizar o almoco e prosseguir em vez de retornar `em_almoco`.

### Resultado
- Se o almoco passou de 60 minutos, o **servidor** finaliza automaticamente o almoco
- O tecnico volta a receber tarefas mesmo que o app estivesse em background
- O atraso de almoco continua sendo registrado corretamente
- O client-side continua funcionando como fallback rapido

### Arquivos
- `supabase/functions/cron-atribuir-tarefas/index.ts`
- `supabase/functions/atribuir-proxima-tarefa/index.ts`

