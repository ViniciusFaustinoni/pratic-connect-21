

## Diagnóstico

A RPC `buscar_tarefa_atual_profissional` retorna a tarefa ativa filtrando por `status IN ('em_rota', 'em_andamento', 'agendada', 'em_analise')`, mas **não exclui** serviços que já têm `imprevisto_registrado_em` preenchido.

O fluxo atual:
1. **ImprevistoBotao** → grava `imprevisto_registrado_em` e `imprevisto_motivo`, mas **não altera o status**
2. **DuploCheckImprevisto** → só muda o status para `nao_compareceu` **se** o usuário completar o duplo check
3. Se o duplo check for cancelado ou fechado, o status permanece `agendada`/`em_rota`/`em_andamento`
4. A RPC continua retornando essa mesma tarefa → loop

## Correção

**1. Alterar a RPC `buscar_tarefa_atual_profissional`** (migração SQL):

Adicionar filtro `AND s.imprevisto_registrado_em IS NULL` na cláusula WHERE para excluir tarefas com imprevisto já registrado, mesmo antes do duplo check ser concluído.

```sql
WHERE s.profissional_id = p_profissional_id
  AND s.status IN ('em_rota', 'em_andamento', 'agendada', 'em_analise')
  AND s.imprevisto_registrado_em IS NULL   -- ← adicionar
```

**2. Garantir que o DuploCheckImprevisto reabra automaticamente** (frontend):

No `TarefaAtualCard`, verificar se a tarefa tem `imprevisto_registrado_em` mas **não** tem `imprevisto_duplo_check`. Se sim, reabrir o modal de duplo check automaticamente para que o instalador não "escape" sem completá-lo.

Isso resolve dois cenários:
- Tarefa some do card imediatamente após registrar imprevisto (RPC filtra)
- Se o instalador recarregar o app antes do duplo check, o sistema não trava mostrando a mesma tarefa

