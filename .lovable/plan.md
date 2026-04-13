

## Plano: Corrigir exibição de coberturas no Termo de Filiação

### Problema
As coberturas do plano **não aparecem** no documento gerado — apenas os benefícios são exibidos. O título "COBERTURAS E BENEFÍCIOS DO PLANO" aparece, mas a tabela de coberturas fica vazia.

### Causa raiz
A query Supabase em ambas as Edge Functions (`autentique-create` e `autentique-create-by-token`) solicita a coluna `valor_personalizado` da tabela `planos_coberturas`, mas **essa coluna não existe**. Isso causa erro silencioso no Supabase (retorna `null` em vez dos dados), resultando em array vazio de coberturas.

A tabela `planos_coberturas` tem estas colunas: `id, plano_id, cobertura_id, percentual_cobertura, valor_limite, franquia_percentual, franquia_valor, carencia_dias, obrigatoria, created_at`.

### Correção

**1. `supabase/functions/autentique-create/index.ts` (~linha 344)**
Alterar o select de:
```
.select('cobertura_id, valor_personalizado, carencia_dias, franquia_percentual, coberturas:cobertura_id(id, nome, descricao)')
```
Para:
```
.select('cobertura_id, carencia_dias, franquia_percentual, valor_limite, coberturas:cobertura_id(id, nome, descricao)')
```

E ajustar o mapeamento (~linha 375) para usar `valor_limite` em vez de `valor_personalizado`.

**2. `supabase/functions/autentique-create-by-token/index.ts` (~linha 219)**
Mesma correção no select e no mapeamento (~linha 250).

**3. Redeploy** de ambas as Edge Functions.

### Escopo
- 2 Edge Functions modificadas + redeploy
- Sem migrations necessárias

