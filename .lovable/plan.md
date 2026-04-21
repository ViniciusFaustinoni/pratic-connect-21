

## Corrigir contador "Tarefas hoje" (X/10) na tela Equipe — usar tabela `servicos`

### Diagnóstico

No hook `src/hooks/useEquipe.ts` (linhas 87–118), o contador `tarefas_hoje` e o campo `ultima_atividade` são populados a partir da tabela **`instalacoes`** (legada, parcial). Porém, todo o restante do sistema (atribuições, mapas, distribuição) já opera em cima da tabela **`servicos`** — vide `useServicosAtribuidos`, `useTarefasProfissional`, etc.

Resultado: como praticamente nenhum serviço novo está sendo registrado em `instalacoes` com `instalador_responsavel_id` preenchido, todos os profissionais aparecem com **0/10**, mesmo havendo movimentação real (confirmado no banco: 10 serviços em 20/abr, 2 agendados em 22/abr — todos com `profissional_id` em `servicos`, nenhum sendo contado).

### Solução (1 arquivo)

**`src/hooks/useEquipe.ts`** — Substituir as duas queries que leem de `instalacoes` por queries equivalentes em `servicos`:

1. **Bloco "3. Buscar contagem de tarefas hoje"** (linhas 87–102):
   - Trocar `from('instalacoes')` por `from('servicos')`.
   - Selecionar `profissional_id, status` (não há mais `instalador_responsavel_id` / `instalador_id` distintos — `servicos` tem só `profissional_id`).
   - Filtrar `data_agendada = hoje` e `status in ['agendada','em_rota','em_andamento','concluida','nao_compareceu','reagendada']` (alinhado a `useServicosAtribuidos.STATUS_VALIDOS`).
   - Agregar por `profissional_id` direto.

2. **Bloco "4. Buscar última atividade"** (linhas 104–118):
   - Trocar `from('instalacoes')` por `from('servicos')`.
   - Filtrar `.in('profissional_id', profileIds)` e `status = 'concluida'`.
   - Usar `concluida_em` (preferencial) com fallback para `updated_at`. Ordenar desc, limit 100.
   - Agregar por `profissional_id`.

3. **Sem mudanças** em interface, default `capacidade_diaria || 10`, ou em qualquer consumidor (`EquipeCard.tsx` continua lendo `tarefas_hoje` / `capacidade_diaria` normalmente).

### Critérios de aceitação

1. Profissionais com serviços agendados/em execução para a data atual passam a exibir contagem real (ex: "3/10" em vez de "0/10").
2. Status do dia anterior **não** influencia o contador (filtro `data_agendada = hoje` mantido).
3. "Última atividade" passa a refletir a última conclusão real registrada em `servicos`.
4. Tabs "Instaladores" e "Administrativo" continuam funcionando como na correção anterior.
5. Nenhuma regressão: filtros de região, status operacional, modais de novo/editar profissional intactos.

### Fora de escopo
- Tornar a `capacidade_diaria` configurável por dia da semana / escala.
- Remover a tabela `instalacoes` (será descontinuada em fase futura, junto com Fase 5 de realtime).
- Adicionar contador separado de "concluídas hoje" vs "pendentes hoje" no card.

