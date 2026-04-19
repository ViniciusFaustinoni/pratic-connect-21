

## Causa raiz definitiva

O início automático do almoço acontece em **3 lugares** e nenhum deles checa se o profissional tem tarefa em execução (`em_rota` ou `em_andamento`):

1. **Frontend — `src/hooks/useJornadaTrabalho.ts` linhas 392-402**
   ```ts
   if (turno?.status === 'ativo' && !turno.inicio_almoco
       && tempoReal.minutosTrabalhados >= TEMPO_ATE_ALMOCO_MINUTOS) {
     iniciarAlmocoMutation.mutate();   // dispara mesmo durante execução
   }
   ```
   No instante em que o relógio cruza 4h, o hook chama a mutation, o turno vira `em_almoco` e o `<AlmocoBloqueioOverlay />` (renderizado em `InstaladorLayout.tsx` linha 124, **fora** das rotas de execução) cobre toda a tela com `fixed inset-0 z-[100]` — incluindo a tela de execução da vistoria, impedindo finalizar.

2. **Edge Function — `supabase/functions/atribuir-proxima-tarefa/index.ts` linhas 266-298**
   Quando o app pede próxima tarefa e o profissional já passou de 4h, força `status='em_almoco'` sem consultar `servicos` em execução.

3. **Cron — `supabase/functions/cron-atribuir-tarefas/index.ts` linhas 196-223**
   Mesma lógica, idem.

Resultado prático observado no print: técnico em vistoria passa das 4h, o servidor (ou o próprio frontend) flipa o turno para `em_almoco`, o overlay aparece em cima da tela de execução, e o botão "Concluir vistoria" fica inalcançável.

## Correção

### A. Helper único de checagem (frontend)
**Novo:** `src/hooks/useTemTarefaEmExecucao.ts` (~25 linhas) — usa `useTarefaAtual` e devolve `true` quando `tarefa.status ∈ {'em_rota','em_andamento'}`. Reutilizável.

### B. Bloquear início automático no frontend
**`src/hooks/useJornadaTrabalho.ts`**
- Importar o helper.
- No `useEffect` das linhas 392-402, adicionar condição `&& !temTarefaEmExecucao` antes do `iniciarAlmocoMutation.mutate()`.
- Expor flag `almocoAdiado` (true quando passou de 4h e tem tarefa em execução) para mostrar badge sutil "Almoço aguardando finalização da tarefa atual" no `JornadaStatusBar`.

### C. Bloquear overlay enquanto tarefa estiver ativa
**`src/components/vistoriador/AlmocoBloqueioOverlay.tsx`**
- Importar `useTemTarefaEmExecucao`.
- Mudar o early return: se `emAlmoco && temTarefaEmExecucao` → `return null` (nunca cobre a tela; técnico finaliza normalmente).
- Como segurança extra, se o turno já estiver `em_almoco` no banco mas houver tarefa em execução, disparar **rollback** automático: chamar `update turnos_profissionais set status='ativo', inicio_almoco=null where id=...` (cobre o caso em que servidor já flipou o turno antes da correção). Isso é consistente porque o tempo de almoço só conta a partir de `inicio_almoco`.

### D. Bloquear no servidor (origem real do bug em produção)
**`supabase/functions/atribuir-proxima-tarefa/index.ts`** (linhas 266-298)
- Antes do bloco "Forçar almoço", consultar `servicos` do profissional `in ('em_rota','em_andamento')`. Se houver, **pular** o force-lunch e devolver normalmente (`ja_tem_tarefa`). Sem mudar o turno.

**`supabase/functions/cron-atribuir-tarefas/index.ts`** (linhas 196-223)
- Mesma checagem antes de forçar `em_almoco`. Se há tarefa em execução, `continue` sem flipar o status.

### E. Pós-conclusão da tarefa
- Não precisa de gatilho novo: assim que a tarefa é concluída, o `useEffect` do `useJornadaTrabalho` reavalia (`temTarefaEmExecucao` vira false) e dispara o almoço naturalmente. O cron também passa a forçar no próximo ciclo.

## Validação (admin@teste.com → simular técnico)
1. Abrir tela de execução de vistoria com turno > 4h trabalhadas → overlay **não** aparece, botão "Concluir" funciona.
2. Concluir a vistoria → em até 30s o overlay aparece (frontend) ou na próxima chamada da edge function (servidor) → almoço inicia.
3. Console mostra `[useJornadaTrabalho] Almoço adiado — tarefa em execução` em vez de iniciar.
4. Logs da edge: `[atribuir-proxima-tarefa] Almoço adiado — profissional em tarefa <id>`.
5. Sem tarefa em execução → comportamento atual preservado (almoço inicia em 4h).

## Arquivos
- `src/hooks/useTemTarefaEmExecucao.ts` (novo)
- `src/hooks/useJornadaTrabalho.ts`
- `src/components/vistoriador/AlmocoBloqueioOverlay.tsx`
- `supabase/functions/atribuir-proxima-tarefa/index.ts`
- `supabase/functions/cron-atribuir-tarefas/index.ts`

Sem mudança de schema, sem nova dependência.

