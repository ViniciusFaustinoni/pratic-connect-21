

## Plano: Corrigir listagem de linhas no Agente Consultor IA

### Causa raiz
A query na aba "Linhas de Produto" solicita a coluna `description` que **nao existe** na tabela `product_lines`. Isso retorna erro 400 do PostgREST, e a UI mostra "Nenhuma linha de produto ativa encontrada".

Erro exato do servidor:
```
{"code":"42703","message":"column product_lines.description does not exist"}
```

### Solucao

**Arquivo: `src/pages/configuracoes/AgenteConsultorIA.tsx`**

1. Remover `description` da query SELECT (a coluna nao existe na tabela)
2. Remover o cast `(supabase as any)` — a tabela ja esta nos types
3. Ajustar referencia a `linha.description` no template para nao quebrar

Tambem, conforme solicitado pelo usuario:
4. Remover o filtro/flag `disponivel_agente` como pre-requisito — todas as linhas ativas devem aparecer automaticamente para atribuicao
5. O toggle `disponivel_agente` continua existindo para o usuario marcar quais linhas o agente deve usar, mas a listagem nao depende dele para aparecer

### Mudanca na query
```typescript
// ANTES (erro - coluna description nao existe)
.select('id, name, slug, description, icon, color, is_active, disponivel_agente, agente_descricao')

// DEPOIS
.select('id, name, slug, icon, color, is_active, disponivel_agente, agente_descricao')
```

### Arquivo alterado
- `src/pages/configuracoes/AgenteConsultorIA.tsx`

