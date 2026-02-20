
# Corrigir: Segundo constraint `check_dia_vencimento` na tabela `contratos`

## Diagnóstico

Os logs mais recentes mostram que o erro **mudou de constraint**:

**Antes (já corrigido):**
```
violates check constraint "associados_dia_vencimento_check"
```

**Agora (ainda ativo):**
```
violates check constraint "check_dia_vencimento"
Failing row contains (..., dia_vencimento = 30, ...)
```

A migration anterior adicionou corretamente o constraint `contratos_dia_vencimento_check` (1-31), mas a tabela `contratos` tinha **outro constraint com nome diferente**: `check_dia_vencimento` — provavelmente criado em uma migration anterior com um nome customizado — que ainda limita o valor a <= 28.

## Solução

### Parte 1 — Remover o constraint antigo `check_dia_vencimento`

Executar SQL para remover apenas esse constraint remanescente:

```sql
-- Remover constraint antigo com nome diferente na tabela contratos
ALTER TABLE contratos 
DROP CONSTRAINT IF EXISTS check_dia_vencimento;

-- Garantir que o novo constraint correto (1-31) está ativo
-- (o contratos_dia_vencimento_check já foi criado na migration anterior)

-- Recarregar schema do PostgREST para reconhecer as mudanças
NOTIFY pgrst, 'reload schema';
```

### Parte 2 — Verificar se há outros constraints problemáticos

Também verificar se existe constraint similar na tabela `associados` com nome diferente, pois o padrão indica que pode haver mais de um constraint com nomes distintos.

### Parte 3 — Confirmar o deploy da edge function

A edge function `contrato-gerar` já foi atualizada com a sanitização `Math.min(Math.max(...), 31)`, mas como o erro ocorre **na tabela** e não na função, o problema é puramente no banco de dados.

## Arquivos / Recursos alterados

| Recurso | Alteração |
|---|---|
| Banco de dados (SQL direto) | Remover `check_dia_vencimento` da tabela `contratos` |
| Banco de dados | Executar `NOTIFY pgrst, 'reload schema'` |

## Resultado esperado

- Constraint antigo `check_dia_vencimento` removido
- Apenas o constraint `contratos_dia_vencimento_check` (1-31) permanece
- Geração de contrato com `dia_vencimento = 30` funciona normalmente
- PostgREST reconhece o schema atualizado imediatamente
