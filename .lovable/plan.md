

## Plano: Corrigir regras de linha faltantes + bug tipo_uso no motor

### Causa raiz

Dois problemas distintos causam diferenças entre RJ e SP/Lagos:

**Problema 1: Regras de LINHA não duplicadas**

A duplicação copiou regras de planos, coberturas e benefícios, mas **não copiou as regras de nível `linha`** (entity_type = 'linha'). As linhas SP e Lagos não têm `marca_modelo` nem `ano_range`, permitindo que veículos inelegíveis vejam planos que deveriam estar bloqueados.

| Linha | marca_modelo | ano_range |
|-------|-------------|-----------|
| SELECT (RJ) | 80+ modelos aceitos | min 2005 |
| LANÇAMENTO (RJ) | 21 modelos 2024+ | Nenhum |
| ADVANCED (RJ) | Motos Honda/Yamaha/etc | min 2005 |
| ESPECIAL (RJ) | 50+ modelos antigos | min 1994 |
| **Todas SP/Lagos** | **Nenhum** | **Nenhum** |

Impacto: Para LTB4J74 (Corolla 2014), LANÇAMENTO - SP mostra 19 planos quando deveria mostrar **0** (Corolla 2014 não está na whitelist de 2024+).

**Problema 2: Campo `tipos_uso` ignorado pelo motor**

31 planos + 195 coberturas + 380 benefícios usam `rule_config: { tipos_uso: [...] }`, mas o motor lê apenas `cfg.tipos || cfg.values`. Isso permite que planos "Aplicativo" apareçam para "Particular" e vice-versa, em TODAS as regiões.

### Correções

#### Parte 1: Copiar regras de linha para SP e Lagos (SQL migration)

Para cada linha original (SELECT, LANÇAMENTO, ADVANCED, ESPECIAL), copiar suas regras `marca_modelo` e `ano_range` para as linhas SP e Lagos correspondentes, ajustando apenas o `entity_id`.

São 8 regras a copiar (2 por linha original × 4 linhas — LANÇAMENTO não tem ano_range, então 7 regras no total × 2 destinos = 14 inserções).

#### Parte 2: Fix tipo_uso no motor (código)

**Arquivo:** `src/hooks/useEntityEligibilityRules.ts` (linha 282)

```typescript
// De:
const tipos: string[] = cfg.tipos || cfg.values || [];
// Para:
const tipos: string[] = cfg.tipos || cfg.values || cfg.tipos_uso || [];
```

#### Parte 3: Normalizar dados tipo_uso (SQL migration)

Atualizar as 606 regras com `tipos_uso` sem `valores`/`tipos` para incluir o campo `valores` padronizado:

```sql
UPDATE entity_eligibility_rules
SET rule_config = rule_config || jsonb_build_object('valores', rule_config->'tipos_uso')
WHERE rule_type = 'tipo_uso'
AND rule_config ? 'tipos_uso'
AND NOT (rule_config ? 'tipos')
AND NOT (rule_config ? 'values');
```

#### Parte 4: Fix salvamento admin (código)

**Arquivo:** `src/hooks/usePlansAdmin.ts` — alterar gravação de regras tipo_uso para usar `tipos` em vez de `tipos_uso`.

#### Parte 5: Fix duplicação para copiar regras de linha (código)

**Arquivo:** `src/hooks/usePlansAdmin.ts` — na função de duplicação de linhas, adicionar cópia das `entity_eligibility_rules` da linha original.

### Resumo

| Ação | Escopo |
|------|--------|
| Copiar regras de linha | 14 regras inseridas |
| Fix motor tipo_uso | 1 linha de código |
| Normalizar dados | ~606 regras atualizadas |
| Fix admin salvamento | 1 linha de código |
| Fix duplicação futura | ~10 linhas de código |

