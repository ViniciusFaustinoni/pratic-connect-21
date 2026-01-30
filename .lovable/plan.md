
# Plano: Corrigir RPC `buscar_tarefa_atual_profissional` que Bloqueia Atribuição Automática

## Problema Identificado

A RPC `buscar_tarefa_atual_profissional` está **quebrada** devido a um erro de coluna inexistente:

```sql
-- Linha problemática (57)
COALESCE(a.nome, c.nome)::TEXT AS associado_nome,
                 ^^^^^
                 ERRO: coluna c.nome não existe
```

A tabela `cotacoes` usa `nome_solicitante`, não `nome`.

## Impacto

1. **RPC falha silenciosamente** quando chamada pelo cron de atribuição
2. O cron **não detecta** que o profissional já tem tarefa ativa
3. O cron tenta atribuir nova tarefa, mas falha no `UPDATE` (condição `profissional_id IS NULL`)
4. Os logs mostram "já foi atribuído a outro" mesmo para serviços sem profissional

## Fluxo Atual (Quebrado)

```text
cron-atribuir-tarefas
        │
        ▼
buscar_tarefa_atual_profissional(vistoriador_id)
        │
        ▼ ERRO: c.nome não existe
        │
       ❌ Retorna null/erro (não tratado)
        │
        ▼
Cron assume "profissional não tem tarefa"
        │
        ▼
Tenta atribuir novo serviço
        │
        ▼
UPDATE falha (serviço já tem profissional_id OU race condition)
        │
        ▼
Log: "já foi atribuído a outro"
```

## Solução

### Migração SQL: Corrigir RPC

**Alterações necessárias**:
1. Trocar `c.nome` por `c.nome_solicitante`
2. Trocar `c.telefone` por `c.telefone_solicitante`

```sql
-- Linha 57 ANTES
COALESCE(a.nome, c.nome)::TEXT AS associado_nome,
COALESCE(a.telefone, c.telefone)::TEXT AS associado_telefone,

-- Linha 57 DEPOIS
COALESCE(a.nome, c.nome_solicitante)::TEXT AS associado_nome,
COALESCE(a.telefone, c.telefone_solicitante)::TEXT AS associado_telefone,
```

### Arquivo a Criar

| Tipo | Descrição |
|------|-----------|
| Migração SQL | Recriar a função `buscar_tarefa_atual_profissional` com colunas corretas |

## Validação Pós-Deploy

1. Testar RPC manualmente: `SELECT * FROM buscar_tarefa_atual_profissional('68f4857b-...')`
2. Verificar que retorna o serviço em `em_rota` do Marcus Vinicius Faustinoni
3. Executar cron de atribuição e confirmar que pula o profissional com tarefa ativa
4. Quando profissional concluir tarefa atual, confirmar atribuição automática das pendentes

## Resumo

| Item | Status Atual | Ação |
|------|--------------|------|
| RPC `buscar_tarefa_atual_profissional` | ❌ Quebrada (c.nome) | Corrigir para c.nome_solicitante |
| Detecção de tarefa ativa | ❌ Falha | Será corrigida com a RPC |
| Atribuição automática | ❌ Loop infinito de tentativas | Funcionará após correção |
