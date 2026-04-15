

## Plano: Corrigir regras de elegibilidade faltantes nas linhas SP e Lagos

### Causa raiz
A função `fetchRulesChunked` usa chunks de 500 IDs, mas cada cobertura tem ~5 regras. Resultado: 500 × 5 = 2500 linhas por query, mas o Supabase retorna no máximo 1000. As regras além do limite são silenciosamente descartadas.

### Dados do problema
| Linha | Regras combustivel esperadas | Existentes | Faltantes |
|-------|------------------------------|------------|-----------|
| SELECT | 333 | 333 | 0 |
| SELECT - SP | 333 | 202 | **131** |
| SELECT - Lagos | 333 | 202 | **131** |
| LANÇAMENTO | 333 | 333 | 0 |
| LANÇAMENTO - SP | 333 | 208 | **125** |
| LANÇAMENTO - Lagos | 333 | 208 | **125** |

Padrão similar para `fipe_range`, `tipo_uso`, `tipo_placa` e `fipe_eligibility`.

### Parte 1: Correção de dados (script via exec)

Executar um script Python/SQL que:

1. Para cada linha duplicada (SP e Lagos), mapeia cada cobertura à sua original via `codigo` (removendo o sufixo `-{timestamp}-{suffix}`)
2. Para as ~80 coberturas com código truncado, usa fallback via LIKE no código
3. Para cada par (original → duplicada), identifica rule_types faltantes na duplicada
4. Copia as regras faltantes do original, atualizando `entity_id` para a cobertura duplicada
5. Aplica o desconto de 10% nas faixas FIPE das regras copiadas (consistente com a duplicação)

### Parte 2: Correção do código de duplicação

**Arquivo:** `src/hooks/usePlansAdmin.ts`

Reduzir o `CHUNK` size de 500 para **150** na função `fetchRulesChunked` (linha ~1112). Com ~5 regras por entidade, 150 × 5 = 750 rows — seguro abaixo do limite de 1000.

```typescript
const CHUNK = 150; // era 500; 150 × ~5 rules/entity = 750, seguro < 1000
```

### Resumo
| Ação | Escopo |
|------|--------|
| Script de dados | ~1960 regras faltantes inseridas em 4 linhas |
| Código | Chunk size reduzido para prevenir perda futura |

