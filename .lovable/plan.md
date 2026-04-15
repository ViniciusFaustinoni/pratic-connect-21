

## Plano: Correção em massa da carência de Vidros e Faróis

### Situação atual
| Estado | Quantidade |
|--------|-----------|
| Correto (120 dias, liberação) | 194 |
| Carência desativada | 16 |
| 118 dias (erro de digitação) | 3 |
| 0 dias | 1 |
| **Total a corrigir** | **20** |

### Correção

Executar um único UPDATE via ferramenta de inserção/atualização no banco:

```sql
UPDATE benefits
SET carencia_ativa = true,
    carencia_dias = 120,
    carencia_tipo = 'liberacao'
WHERE (name ILIKE '%vidro%farol%' OR name ILIKE '%vidros%far%')
  AND (carencia_ativa = false OR carencia_dias != 120 OR carencia_tipo != 'liberacao' OR carencia_dias IS NULL);
```

Isso corrige os 20 registros sem alterar os 194 já corretos. Nenhuma mudança de código é necessária.

