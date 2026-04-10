

## Plano: Mostrar valor real do tipo de uso em vez de "tipo_uso"

### Problema
Na listagem de coberturas/benefícios do plano, os badges de regras de elegibilidade mostram o texto cru `tipo_uso` quando o array `values` na `rule_config` está vazio ou ausente. O código atual (linha 115 de `LinhasPlanos.tsx`) usa `rule.rule_type` como fallback, que é o nome técnico do campo.

### Correção (1 arquivo)

**`src/components/gestao-comercial/LinhasPlanos.tsx`** — Alterar a lógica de fallback do label (linhas 115-127):

1. Adicionar um mapa de nomes amigáveis para os `rule_type`:
```typescript
const RULE_TYPE_LABELS: Record<string, string> = {
  tipo_uso: 'Tipo de Uso',
  combustivel: 'Combustível',
  regiao: 'Região',
  tipo_placa: 'Tipo de Placa',
  fipe_range: 'Faixa FIPE',
};
```

2. Quando `values` existir e tiver itens, mostrar os valores resolvidos (como já faz para região).
3. Quando `values` estiver vazio ou ausente, usar o nome amigável do `RULE_TYPE_LABELS` em vez do nome técnico cru.

Mudança na lógica (linhas 115-127):
- Trocar `let label = rule.rule_type` por `let label = RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type`
- Manter o resto da lógica que sobrescreve `label` quando há valores.

### Resultado
Em vez de mostrar `tipo_uso`, o badge mostrará `Particular`, `APP`, etc. quando houver valores configurados, ou `Tipo de Uso` como fallback legível quando não houver.

