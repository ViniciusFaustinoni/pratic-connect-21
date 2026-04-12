

## Plano: Atualizar carências em massa nos itens duplicados antigos

### Contexto
A duplicação de planos/linhas **já copia** os campos de carência corretamente (via spread `...bData` / `...cobData`). O problema é que muitos itens foram duplicados **antes** da carência ser configurada nos itens fonte. Resultado: ~261 coberturas e ~273 benefícios sem carência que deveriam tê-la.

### Itens que precisam de carência (todos com `120 dias / liberação / multiplicador 1`)

**Coberturas** (por nome base):
- 100% FIPE, 75% FIPE, Alagamento, Chuva de Granizo, Colisão, Furto, Incêndio, Perda Total (PT), Roubo, Taxa Administrativa

**Benefícios** (por nome base):
- Vidros e Faróis

### Ação
Executar dois UPDATEs via insert tool:

1. **Coberturas**: Atualizar todas as coberturas cujo nome começa com os base names acima e que têm `carencia_ativa = false` ou `NULL`:
```sql
UPDATE coberturas
SET carencia_ativa = true, carencia_dias = 120, carencia_tipo = 'liberacao', carencia_multiplicador = 1
WHERE (carencia_ativa = false OR carencia_ativa IS NULL)
AND (nome LIKE '100\% FIPE%' OR nome LIKE '75\% FIPE%' OR nome LIKE 'Alagamento%' 
     OR nome LIKE 'Chuva de Granizo%' OR nome LIKE 'Colisão%' OR nome LIKE 'Furto%'
     OR nome LIKE 'Incêndio%' OR nome LIKE 'Perda Total%' OR nome LIKE 'Roubo%'
     OR nome LIKE 'Taxa Administrativa%');
```

2. **Benefícios**: Atualizar todos os benefícios "Vidros e Faróis" sem carência:
```sql
UPDATE benefits
SET carencia_ativa = true, carencia_dias = 120, carencia_tipo = 'liberacao', carencia_multiplicador = 1
WHERE (carencia_ativa = false OR carencia_ativa IS NULL)
AND name LIKE 'Vidros e Faróis%';
```

### Nenhuma alteração de código necessária
O mecanismo de duplicação já funciona corretamente para novas duplicações.

