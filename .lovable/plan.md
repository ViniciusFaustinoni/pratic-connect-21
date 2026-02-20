
# Corrigir: Erro ao Gerar Contrato — Violação do Constraint `dia_vencimento`

## Diagnóstico Confirmado

Os logs da edge function `contrato-gerar` mostram claramente:

```
code: "23514"
message: 'new row for relation "associados" violates check constraint "associados_dia_vencimento_check"'
Failing row contains: (..., dia_vencimento = 30, ...)
```

O constraint atual no banco é:
```sql
CHECK ((dia_vencimento IS NULL) OR ((dia_vencimento >= 1) AND (dia_vencimento <= 28)))
```

O valor `30` está sendo enviado pela cotação (campo `cotacao.dia_vencimento = 30`), mas o banco só aceita valores entre 1 e 28.

## Análise das Opções

**Opção A — Ampliar o constraint no banco para aceitar até 31**
- Mais correta semanticamente: dia de vencimento pode ser até 31
- Requer migration de banco de dados
- Solução definitiva — qualquer dia válido do mês funcionará

**Opção B — Sanitizar o valor na edge function antes de inserir**
- Limitar o valor a no máximo 28 na edge function
- Não resolve o problema raiz (constraint ainda restritivo)
- Pode causar discrepância entre o dia escolhido e o dia real de cobrança

A **Opção A** é a correta. O constraint foi originalmente criado com limite 28 para evitar problemas em fevereiro, mas o correto é aceitar qualquer dia entre 1 e 28 sendo o valor máximo seguro, ou liberar até 31 e tratar o caso de meses curtos na lógica de cobrança.

## Solução: Ampliar constraint + Sanitizar na edge function

### Parte 1 — Alterar o constraint no banco

Remover o constraint atual e criar um novo que aceite de 1 a 31:

```sql
ALTER TABLE associados 
DROP CONSTRAINT associados_dia_vencimento_check;

ALTER TABLE associados 
ADD CONSTRAINT associados_dia_vencimento_check 
CHECK (dia_vencimento IS NULL OR (dia_vencimento >= 1 AND dia_vencimento <= 31));
```

Também verificar e corrigir o mesmo constraint na tabela `contratos` se existir.

### Parte 2 — Adicionar sanitização na edge function `contrato-gerar`

Como proteção adicional, garantir que o valor enviado à tabela `associados` e `contratos` seja sempre válido:

```typescript
// Sanitizar dia_vencimento: aceitar 1-31, default 10
const diaVencimento = cotacao.dia_vencimento 
  ? Math.min(Math.max(Number(cotacao.dia_vencimento), 1), 31) 
  : 10;
```

Aplicar essa sanitização nas linhas 466 e 585 do arquivo `contrato-gerar/index.ts`.

## Arquivos alterados

| Arquivo / Recurso | Alteração |
|---|---|
| Banco de dados (migration) | Ampliar `associados_dia_vencimento_check` de `<= 28` para `<= 31` |
| `supabase/functions/contrato-gerar/index.ts` | Sanitizar `dia_vencimento` antes dos INSERTs (linhas 466 e 585) |

## Resultado esperado

- Cotação com `dia_vencimento = 30` é aceita normalmente
- Associado criado com sucesso
- Contrato gerado para o associado
- Qualquer dia entre 1 e 31 funciona sem erro
