
## Diagnóstico

Erro 400 ao atribuir um vistoriador a um agendamento de base (modal "Tarefas do dia" → aba Base → botão "Confirmar" no select do vistoriador).

PATCH direto na tabela `agendamentos_base` está sendo rejeitado pelo PostgREST. Causas possíveis (a confirmar):

1. **Coluna inexistente** no payload (ex.: front mandando `vistoriador_id` mas a coluna se chama `profissional_id`, `instalador_id` ou similar).
2. **Política RLS** bloqueando UPDATE (usuário logado não tem permissão de escrita direta nessa tabela — deveria passar por RPC/edge function).
3. **Constraint/Check** (FK inválida, enum status não aceito, NOT NULL violado).
4. **Trigger BEFORE UPDATE** disparando `RAISE EXCEPTION`.

### Investigação na próxima rodada (com permissão)
1. Localizar componente do modal "Tarefas do dia" → aba Base → handler do botão "Confirmar" (provável `src/components/monitoramento/CalendarioTarefas*.tsx` ou similar).
2. Ver exatamente que payload o front envia no PATCH.
3. Consultar via `supabase--read_query`:
   - Schema de `agendamentos_base` (colunas, tipos, NOT NULL).
   - RLS policies de UPDATE em `agendamentos_base`.
   - Triggers em `agendamentos_base`.
4. Buscar logs recentes do PostgREST/Edge para ver a mensagem de erro 400 detalhada (corpo da resposta tem `message`, `code`, `details`, `hint`).
5. Comparar com o handler de "Reatribuir" (que funciona, segundo o print mostra outros itens já com vistoriador atribuído) — há um caminho que dá certo, então o que muda?

## Correção planejada

Depende da causa raiz, mas em geral:

### Cenário A — Nome de coluna errado
- Ajustar payload do PATCH para usar a coluna correta.
- Tipar o update com o tipo gerado em `src/integrations/supabase/types.ts` para evitar reincidência.

### Cenário B — RLS bloqueando
- Em vez de PATCH direto, rotear pela RPC/edge function que já é usada em outros pontos de atribuição (provavelmente `atribuir-servico` ou similar — memória `automated-assignment-and-confirmation-logic`).
- Garantir que a função usa `SECURITY DEFINER` e valida que o usuário é coordenador/diretor.

### Cenário C — Constraint/trigger
- Incluir os campos obrigatórios que faltam (ex.: `atribuido_em`, `atribuido_por`, mudar `status` para `'agendado'` ou `'confirmado'`).
- Se trigger exige condição prévia (ex.: vistoriador precisa estar disponível naquele horário), exibir erro tratado no front com `toast.error` legível em vez de "Erro ao atribuir técnico".

### Melhoria comum aos três cenários
- Trocar o `toast.error('Erro ao atribuir técnico')` genérico por `toast.error(error.message)` para o usuário ver "violates RLS policy" ou "column X does not exist" e nós conseguirmos diagnosticar mais rápido.
- Logar `error.code`, `error.details`, `error.hint` no console (já vem do PostgREST).

## Arquivos prováveis
- Componente do modal de atribuição na rota `/monitoramento/calendario` (a localizar).
- Hook que faz o PATCH (provável `useAtribuirAgendamentoBase` ou similar).
- Possível edge function `atribuir-servico` para rotear quando RLS for o problema.

## Não vou mexer
- Lógica do calendário em si (renderização, navegação por dias).
- Fluxo de atribuição de rotas (aba "Rota") — só base.
- Infra offline (não relacionada).

## Resultado
Botão "Confirmar" no select de vistoriador da aba "Base" passa a atribuir corretamente, com mensagem de erro útil quando houver bloqueio legítimo (ex.: vistoriador já tem outra tarefa no mesmo horário).
