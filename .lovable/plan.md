

# Remover km da Assistência 24h + Tornar km do Reboque dinâmico

## Situação atual

### Dados no banco
- **Assistência 24h** (`custom_text`): "Assistência 24h 400km" (13 registros), "Assistência 24h 600km" (1 registro)
- **Reboque** (`custom_text`): "1000km Reboque" (estático, mesmo para planos com `valor_limite` diferente)
- **`planos_coberturas`** com `COB-ASS`: já tem os km corretos por plano (400, 600, 1000)

### Problema
- "Assistência 24h 400km" é redundante — o km já aparece no Reboque
- "1000km Reboque" é hardcoded no `custom_text` — deveria vir de `planos_coberturas.valor_limite`

## Plano de correção

### 1. UPDATE nos dados (via insert tool — não é migration)

**Assistência 24h** — remover km de todos os `custom_text`:
```sql
UPDATE planos_beneficios
SET custom_text = 'Assistência 24h', updated_at = now()
WHERE benefit_id = 'ce0c5167-991c-4e0a-b5c2-21b23bc91807'
  AND custom_text LIKE 'Assistência 24h %km';
```
Afeta 14 registros.

**Reboque** — limpar o `custom_text` estático para permitir exibição dinâmica:
```sql
UPDATE planos_beneficios
SET custom_text = NULL, updated_at = now()
WHERE benefit_id = 'be1fa928-b1fe-4bbb-a402-ec0604bc9e8e'
  AND custom_text LIKE '%km Reboque%';
```
Afeta ~8 registros. Com `custom_text = NULL`, o sistema passará a usar o `name` do benefício ("Reboque") + a lógica dinâmica de km.

### 2. Alterar o hook `usePlans.ts` — buscar km do Reboque via `planos_coberturas`

Na query principal (e nas variantes `usePlanById`, `usePlanBySlug`, `usePlanosCotacao`), adicionar um sub-select de `planos_coberturas` filtrando por `COB-ASS` para obter o `valor_limite`:

```sql
planos_coberturas!inner (valor_limite, coberturas!inner(codigo))
```

No mapeamento de `plan_benefits`, quando o benefício for "Reboque" (id `be1fa928-...`), compor o texto dinâmico:
```typescript
custom_text: pb.benefit_id === REBOQUE_ID 
  ? `${valorLimiteKm}km Reboque` 
  : pb.custom_text
```

### 3. Componentes afetados (sem alteração necessária)

Os componentes já usam a lógica `custom_text || benefits.name`:
- `PlanoCardDynamic.tsx` — `getBenefitDisplayName()` usa `custom_text` primeiro
- `PlanPreview.tsx` — exibe `benefits.name`
- `AppPlano.tsx` — app do associado

Como o `custom_text` será preenchido dinamicamente no hook, nenhum componente precisa mudar.

### Resumo de alterações
- **1 UPDATE** para limpar Assistência (14 registros)
- **1 UPDATE** para limpar Reboque (8 registros) 
- **1 arquivo** modificado: `src/hooks/usePlans.ts` — enriquecer `plan_benefits` com km dinâmico do `planos_coberturas`

