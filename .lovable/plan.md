## Problema confirmado em produção

Acessando como diretor a tela `/diretoria/vistorias-instalacoes`:

1. **KPI "Em Andamento: 4"** está incorreto. O hook `useRotasMetricas` conta TODAS as rotas com `status='em_andamento'` no histórico inteiro, sem filtrar por `data_rota = hoje`. Verificado no banco: hoje não há turnos abertos nem serviços em execução.
2. **KPI "Instaladores: 0"** está errado também. O hook lê o campo legado `rotas.instalador_id`, mas a relação atual é a tabela n:n `rota_instaladores`.
3. **Card "Equipe em Campo — Hoje"** depende de rotas com instaladores; mostra "Nenhum profissional" mesmo quando há técnicos com turno aberto sem rota formal.
4. **Não existe** nenhum indicador de tempo gasto por estado (ocioso, deslocamento, em serviço, almoço, inativo dentro do horário comercial).

## O que será feito

### 1. Corrigir os 4 KPIs do topo
- `Rotas Hoje`: manter (já correto).
- `Em Andamento`: passar a contar `servicos` com `status IN ('em_rota','em_andamento')` E `data_agendada = hoje` (reflete técnicos efetivamente trabalhando agora).
- `Instaladores`: passar a contar profissionais distintos com `turnos_profissionais.data = hoje` E `inicio_turno IS NOT NULL` (fonte de verdade do "quem está de plantão hoje"), com fallback para `rota_instaladores` quando não há turno registrado.
- `Concluídas Semana`: passar a contar `servicos` concluídos na semana (mais granular que rotas inteiras).

### 2. Reescrever a aba "Tempo Real" — Equipe em Campo

Trocar o card atual por um **painel de timeline diária por técnico** que mostra, para cada profissional com turno hoje:

- Nome, foto, badge de status atual (Em serviço / Em deslocamento / Almoço / Ocioso / Inativo / Offline).
- Linha do tempo horizontal (08:00 → 18:00) com blocos coloridos para cada estado.
- 5 contadores numéricos do dia em formato `Hh Mm`:
  - **Em serviço** (executando uma OS)
  - **Em deslocamento** (em rota até o cliente)
  - **Almoço**
  - **Ocioso** (turno aberto, sem serviço, sem almoço, GPS recente)
  - **Inativo no horário comercial** (turno aberto, sem GPS há > 25min, dentro de 08–18h)
- Última atualização de GPS + tarefas concluídas/total.

A reconstrução é feita a partir de fontes já existentes (sem nova tabela):
```text
fonte                            usado para
──────────────────────────────── ────────────────────────────────
turnos_profissionais             início/fim de turno e almoço
servicos.em_rota_em              início de deslocamento
servicos.iniciada_em             fim deslocamento / início serviço
servicos.concluida_em            fim do serviço
vistoriadores_localizacao        detecção de inatividade GPS
```

Algoritmo (resumido):
1. Para cada técnico com turno hoje, montar segmentos `[início, fim, tipo]` a partir de turno + almoço + serviços (ordenados por `em_rota_em` / `iniciada_em` / `concluida_em`).
2. Preencher gaps dentro do turno como **ocioso**, exceto janelas onde o último `vistoriadores_localizacao.updated_at` ficou >25min sem update dentro do horário comercial — esses gaps viram **inativo**.
3. Somar minutos por tipo. Renderizar barra horizontal proporcional.

### 3. Detalhes técnicos

**Hook novo:** `src/hooks/useEquipeTempoReal.ts`
- Query única paralelizada (`Promise.all`) por: `turnos_profissionais` do dia, `servicos` do dia com timestamps, último `vistoriadores_localizacao` por técnico, `profiles` para nome/foto.
- Retorna `EquipeMembroTempoReal[]` com `{ id, nome, fotoUrl, statusAtual, segmentos[], totais: {emServico, deslocamento, almoco, ocioso, inativo}, ultimoGpsEm, tarefas: {concluidas, total} }`.
- `refetchInterval: 60s` + invalidação via realtime nos canais `servicos`, `turnos_profissionais`, `vistoriadores_localizacao`.

**Componentes novos:**
- `src/components/equipe/TimelineTecnicoCard.tsx` — card com barra horizontal, badges e contadores.
- `src/components/equipe/TimelineBar.tsx` — SVG com segmentos coloridos, tooltip por bloco (Recharts não é necessário, é só uma barra empilhada simples em divs).

**Cores dos estados** (Tailwind tokens semânticos):
- Em serviço: `bg-primary`
- Deslocamento: `bg-blue-500`
- Almoço: `bg-amber-500`
- Ocioso: `bg-muted`
- Inativo: `bg-destructive`
- Fora do turno: `bg-transparent` com borda

**Arquivos a editar:**
- `src/hooks/useRotas.ts` → corrigir `useRotasMetricas`.
- `src/pages/monitoramento/Rotas.tsx` → trocar o card "Equipe em Campo — Hoje" pelo novo `TimelineTecnicoCard` em loop.

**Arquivos a criar:**
- `src/hooks/useEquipeTempoReal.ts`
- `src/components/equipe/TimelineTecnicoCard.tsx`
- `src/components/equipe/TimelineBar.tsx`

Sem migrations — todos os dados já existem nas tabelas atuais.

### 4. Validação após a implementação

Como diretor (`admin@teste.com`), abrir a tela e confirmar:
- Os 4 KPIs do topo refletem dados reais consultados no banco.
- O painel mostra cada técnico com turno hoje (ou "Nenhum profissional com turno aberto" se vazio).
- Para cada técnico, soma dos blocos = duração entre `inicio_turno` e `now()` (ou `fim_turno`).
