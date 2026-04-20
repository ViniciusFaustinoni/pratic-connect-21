

## Liberar K2500 apenas na linha Select Diesel

### Diagnóstico
O KIA K2500 não aparece na cotação porque não está cadastrado na regra `marca_modelo` (whitelist) das `entity_eligibility_rules`. Mesmo aparecendo como "veículo pesado" na tela de elegibilidade, o motor de cotação (`useEntityEligibilityRules.ts`) bloqueia modelos não listados explicitamente quando o modo é `include`.

### Escopo da correção
Liberar o K2500 **exclusivamente na Linha Select** (variantes Diesel), seguindo a mesma configuração já aplicada ao BONGO. Nas demais linhas (Especial, Premium, Lançamento, etc.) o K2500 permanece **não aceito**.

### O que será feito

#### 1. Migration de dados — adicionar K2500 na Linha Select
Inserir entrada do K2500 na regra `marca_modelo` da Linha Select Diesel (`entity_id` correspondente em `entity_eligibility_rules`), via `jsonb_set`/append ao array `modelos`:

```json
{ "marca": "KIA", "modelo": "K2500", "status": "aceito", "combustivel": "diesel", "categoria": "veiculo_pesado" }
```

Não criar entrada em nenhuma outra linha. Não tocar em planos flex/gasolina.

#### 2. Normalização defensiva da marca BONGO
Onde o BONGO estiver cadastrado como `"KIA MOTORS"`, normalizar para `"KIA"` para alinhar com o que a FIPE devolve. Apenas update de string dentro do JSON, sem mudar status/categoria.

#### 3. Normalização no motor de matching
Pequeno ajuste em `src/hooks/useEntityEligibilityRules.ts` e em `supabase/functions/agente-consultor-ia/index.ts`: comparar marca pelo primeiro token uppercased (`"KIA MOTORS"` ≡ `"KIA"`), evitando que cadastros divergentes futuros quebrem o matching.

### Arquivos editados
- **Nova migration** `supabase/migrations/<timestamp>_add_k2500_select_eligibility.sql` — adiciona K2500 na Select Diesel + normaliza marca do BONGO.
- `src/hooks/useEntityEligibilityRules.ts` — normalização do primeiro token da marca.
- `supabase/functions/agente-consultor-ia/index.ts` — mesma normalização server-side.

### Validação
1. Cotação **KIA / K2500 HD / Diesel** → lista planos da **Select Diesel** (e somente dela).
2. Cotação **KIA / K2500** em qualquer outra linha (Especial, Premium, Lançamento) → continua **sem planos**.
3. BONGO continua funcionando em todas as linhas onde já era aceito (sem regressão).
4. Tela `/diretoria/gestao-comercial` → Elegibilidade da Select passa a mostrar K2500 ao lado do BONGO.
5. Motor da IA (`agente-consultor-ia`) devolve os mesmos planos do frontend para o K2500.

