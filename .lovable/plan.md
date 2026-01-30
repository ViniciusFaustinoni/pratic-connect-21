
# Plano: Corrigir RPC `buscar_tarefa_atual_profissional` - ✅ CONCLUÍDO

## Problema Identificado

A RPC `buscar_tarefa_atual_profissional` estava **quebrada** devido a erro de colunas inexistentes:

```sql
-- ANTES (errado)
COALESCE(a.nome, c.nome)::TEXT AS associado_nome,
COALESCE(a.telefone, c.telefone)::TEXT AS associado_telefone,

-- DEPOIS (corrigido)
COALESCE(a.nome, c.nome_solicitante)::TEXT AS associado_nome,
COALESCE(a.telefone, c.telefone1_solicitante)::TEXT AS associado_telefone,
```

## Validação

```sql
SELECT * FROM buscar_tarefa_atual_profissional('68f4857b-3499-4665-b73a-52d167df566a');
-- Retorna: Marcus Vinicius Faustinoni | status: em_rota ✅
```

## Status Final

| Item | Status |
|------|--------|
| RPC `buscar_tarefa_atual_profissional` | ✅ Corrigida |
| Detecção de tarefa ativa | ✅ Funcionando |
| Atribuição automática | ✅ Pronta para operar |
