

## Plano: Corrigir coberturas de reboque e assistência em todos os planos

### Problemas identificados

1. **Falta o benefício de acionamentos**: Nenhum plano menciona "5 acionamentos mensais de reboque (1 por ocorrência, não cumulativo)" nas coberturas.
2. **Ambiguidade assistência vs reboque**: Planos como SELECT PREMIUM mostram simultaneamente "Assistência 24h 400km" e "1000km Reboque", gerando confusão. O "400km" na assistência se refere ao raio de atendimento geral (chaveiro, pane, etc.), enquanto "1000km Reboque" é o limite de km por guincho. Isso precisa ser clarificado.

### Solução

Atualizar a coluna `coberturas` (JSON array) na tabela `planos` para todos os planos ativos:

**Mudanças nos textos:**
- `"Assistência 24h 400km"` → `"Assistência 24h"` (remover km — o km é do reboque, não da assistência geral)
- `"Assistência 24h 1000km"` → `"Assistência 24h"` (idem)
- Manter `"1000km Reboque"` onde já existe (planos premium/exclusive/one)
- **Adicionar** `"5 acionamentos de reboque/mês (1 por ocorrência)"` em **todos** os planos que possuem assistência

### Edições

**1. Migração SQL — Atualizar coberturas de todos os planos ativos**

Para cada plano, substituir o texto ambíguo e adicionar o item de acionamentos. Isso será feito via UPDATEs individuais por plano, atualizando o array `coberturas`.

Exemplos (serão feitos para todos os ~15 planos ativos):

```sql
-- Planos com "Assistência 24h 400km" (sem 1000km Reboque separado)
-- Ex: SELECT BASIC, ESPECIAL PLUS, LANÇAMENTO BASIC
-- Trocar "Assistência 24h 400km" por "Assistência 24h" + adicionar acionamentos

-- Planos com "Assistência 24h 400km" + "1000km Reboque"
-- Ex: SELECT PREMIUM, LANÇAMENTO PREMIUM
-- Trocar "Assistência 24h 400km" por "Assistência 24h" + adicionar acionamentos + manter "1000km Reboque"

-- Planos com "Assistência 24h 1000km"
-- Ex: SELECT ONE, ELÉTRICOS
-- Trocar "Assistência 24h 1000km" por "Assistência 24h" + adicionar acionamentos + manter "1000km Reboque"
```

**2. Sem alteração de código** — Os componentes (`PlanoCardCotacao`, `PlanoCardSelecao`, `PlanoCard`, PDF) já renderizam dinamicamente o array `coberturas` do banco. A correção é puramente de dados.

### Resultado
- Todos os planos exibem "5 acionamentos de reboque/mês (1 por ocorrência)" como item de cobertura
- A assistência 24h não menciona mais km (evita confusão com reboque)
- O reboque 1000km continua listado separadamente onde aplicável
- Mudanças refletem automaticamente no sistema e no PDF

