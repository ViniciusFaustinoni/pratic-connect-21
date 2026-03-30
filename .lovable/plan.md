

# Adicionar Campo de Carência (dias) nos Formulários de Cobertura e Benefício

## Contexto

A tabela `coberturas` já possui a coluna `carencia_dias`, mas o formulário de criação/edição (`CoberturaUnificadaFormModal`) não exibe esse campo. A tabela `benefits` **não possui** a coluna `carencia_dias` — precisa de migration.

## Alterações

### 1. Migration — Adicionar `carencia_dias` na tabela `benefits`
```sql
ALTER TABLE benefits ADD COLUMN carencia_dias integer DEFAULT NULL;
```

### 2. `CoberturaUnificadaFormModal.tsx` — Adicionar campo carência
- Adicionar `carencia_dias` ao state do formulário
- Carregar valor existente no `useEffect`
- Incluir no payload do submit
- Renderizar input numérico com label "Carência (dias)" e placeholder "Ex: 30"

### 3. `BeneficioFormModal.tsx` — Adicionar campo carência
- Mesmo padrão: state, useEffect, payload, input numérico
- Incluir `carencia_dias` no payload enviado ao `createBenefit` / `updateBenefit`

### 4. Hooks `usePlansAdmin` — Verificar se mutations suportam o campo
Confirmar que `useCreateCobertura`, `useUpdateCobertura`, `useCreateBenefit`, `useUpdateBenefit` passam campos extras para o Supabase (provavelmente já fazem spread do payload).

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | `ALTER TABLE benefits ADD COLUMN carencia_dias integer` |
| `src/components/admin/planos/CoberturaUnificadaFormModal.tsx` | Adicionar input de carência em dias |
| `src/components/admin/planos/BeneficioFormModal.tsx` | Adicionar input de carência em dias |

