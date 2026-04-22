

## Causa raiz: edge functions ignoram alocação "Base" e forçam almoço/bloqueio mesmo no técnico que bate ponto externamente

### Onde já está correto (frontend)

`useJornadaTrabalho.ts` consulta `useAlocacaoDiaria()` e usa `isBase` para:
- **NÃO** disparar `iniciarAlmocoMutation` automaticamente após 4h (linhas 405-418).
- **NÃO** disparar `finalizarAlmocoMutation` automaticamente aos 60min (linhas 448-458).
- `AlmocoBloqueioOverlay` retorna `null` quando `isBase` (linha 44).
- `JornadaStatusBar` já mostra botão manual "Iniciar almoço" / "Finalizar almoço" para o Base.

Ou seja, a UI respeita a regra. **A trava vem do servidor.**

### Onde está a trava (raiz)

Duas edge functions decidem o status de almoço/atribuição **sem checar `alocacoes_diarias.tipo_alocacao`**:

1. **`supabase/functions/atribuir-proxima-tarefa/index.ts`** (linhas 249-333)
   - Se `turno.status === 'em_almoco'` e < 60min → devolve `resultado: 'em_almoco'` e bloqueia atribuição.
   - Se `minutosTrabalhados >= limiteAlmocoMinutos` (4h) → faz `UPDATE turnos_profissionais SET status='em_almoco', inicio_almoco=now()` **mesmo para técnico Base**.
   
2. **`supabase/functions/cron-atribuir-tarefas/index.ts`** (linhas 173-246)
   - Mesma lógica no cron de 1 em 1 minuto: força `em_almoco` aos 240 min e pula atribuições enquanto status for `em_almoco`.

Resultado: o técnico Base é flipado para `em_almoco` pelo servidor, o cron para de mandar tarefa, e o cliente — mesmo escondendo o overlay — recebe `resultado: 'em_almoco'` ao tentar puxar a próxima. Daí a sensação de "trava no horário".

### Correção raiz (servidor)

**Carregar `tipo_alocacao` do dia em ambas as funções e curto-circuitar a lógica de almoço quando for `'base'`.**

#### 1. `supabase/functions/atribuir-proxima-tarefa/index.ts`

Logo após carregar `turnoHoje` (linha 243), adicionar:

```ts
const { data: alocHoje } = await supabase
  .from('alocacoes_diarias')
  .select('tipo_alocacao')
  .eq('profissional_id', profissionalId)
  .eq('data', hoje)
  .maybeSingle();
const isBase = alocHoje?.tipo_alocacao === 'base';
```

E envolver os dois blocos atuais:
- Bloco "Se está em almoço, verificar se já expirou" (249-284): se `isBase`, **pular o early-return de bloqueio**. O Base controla manualmente — se ele iniciou, ele finaliza pelo botão. O servidor não auto-finaliza nem bloqueia atribuição.
- Bloco "Forçar almoço se atingiu limite" (286-333): se `isBase`, **não forçar**. Sair do bloco sem mexer em status.

#### 2. `supabase/functions/cron-atribuir-tarefas/index.ts`

Dentro do `for (const prof of profissionais)`, antes do bloco de almoço (linha 172), buscar `alocacoes_diarias` para o `prof.vistoriador_id` no dia (em batch antes do loop, para performance — uma única query `IN (ids)`):

```ts
const profIds = profissionais.map(p => p.vistoriador_id);
const { data: alocacoes } = await supabase
  .from('alocacoes_diarias')
  .select('profissional_id, tipo_alocacao')
  .eq('data', hoje)
  .in('profissional_id', profIds);
const baseSet = new Set(alocacoes?.filter(a => a.tipo_alocacao === 'base').map(a => a.profissional_id));
```

Dentro do loop:
```ts
const isBase = baseSet.has(prof.vistoriador_id);
```

E:
- Bloco "Se está em almoço, verificar se já expirou" (180-204): se `isBase` e `em_almoco`, **`continue`** (não atribui durante almoço manual do Base, mas também não auto-finaliza — fica no controle do técnico).
- Bloco "forçar almoço (4h)" (206-246): se `isBase`, **pular completamente**. Nunca forçar almoço para Base.

### Comportamento esperado após a correção

| Cenário (Base) | Antes | Depois |
|---|---|---|
| 4h trabalhadas, sem clicar em "Iniciar almoço" | Servidor força `em_almoco`, cron para de atribuir | Nada muda no servidor; tarefas continuam vindo normalmente |
| Técnico clica em "Iniciar almoço" no app | UI mostra botão, mas overlay não trava (já ok) | Igual — e cron para de atribuir enquanto `em_almoco` (correto, ele está em almoço) |
| Técnico clica em "Finalizar almoço" | Mutation já existe e funciona | Igual; servidor não auto-finaliza nem fica esperando "60 min" |
| Técnico em rota (não-Base) | Servidor força almoço aos 4h, auto-finaliza aos 60min | Sem mudança — comportamento atual preservado |

### Critérios de aceitação

1. Técnico marcado como **Base** no dia atravessa 4h+ sem que o servidor o coloque em `em_almoco` automaticamente.
2. `atribuir-proxima-tarefa` continua devolvendo tarefas para Base após 4h.
3. `cron-atribuir-tarefas` continua atribuindo para Base após 4h (logs sem "forçando ALMOÇO" para profIds Base).
4. Botões manuais "Iniciar almoço" / "Finalizar almoço" do Base continuam funcionando (não foram tocados — já implementados em `JornadaStatusBar`).
5. Técnicos em rota (não-Base) continuam tendo a regra automática de 4h + auto-finalização de 60min, sem regressão.

### Arquivos envolvidos

- `supabase/functions/atribuir-proxima-tarefa/index.ts` (gating por `isBase`)
- `supabase/functions/cron-atribuir-tarefas/index.ts` (gating por `isBase` em batch)

### Fora de escopo

- Mudar UI da `JornadaStatusBar` (já tem os botões manuais).
- Mudar `useJornadaTrabalho.ts` (já gateia corretamente).
- Mexer em RLS, schema ou novas tabelas — apenas leitura adicional de `alocacoes_diarias` que já existe.

