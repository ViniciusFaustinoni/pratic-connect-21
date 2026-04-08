

# Plano: Aba "Coberturas e Benefícios" no modal de edição de plano

## Problema

A aba "Benefícios" do `PlanFormModal` exibe apenas benefícios da tabela `benefits`. As coberturas da tabela `coberturas` não aparecem como opções selecionáveis, e o sistema não salva/carrega vínculos de `planos_coberturas` pelo modal.

## Alterações

### 1. `PlanFormModal.tsx` — Renomear aba e adicionar estado de coberturas

- Renomear tab trigger de "Benefícios" para "Coberturas e Benefícios"
- Importar `useCoberturas` de `@/hooks/usePlans`
- Adicionar estado `selectedCoberturas` como array de `{ cobertura_id: string }`
- No `useEffect` que carrega `fullPlanData`, popular `selectedCoberturas` a partir de `planos_coberturas`
- No `handleSubmit`, incluir lógica de delete+insert para `planos_coberturas` (mesmo padrão usado para `planos_beneficios`)
- Passar coberturas disponíveis e selecionadas para o `BenefitsSelector` (ou novo componente combinado)

### 2. `BenefitsSelector.tsx` — Aceitar coberturas como props

- Adicionar props: `coberturas` (lista do catálogo) e `selectedCoberturas` / `onCoberturasChange`
- Renderizar uma seção "Coberturas" acima dos benefícios com checkboxes para cada cobertura (nome, código, tipo)
- Coberturas são simples checkboxes (sem custom_text/valor estruturado como benefícios)
- Agrupar coberturas por `tipo` (ex: "cobertura", "assistencia")

### 3. `usePlansAdmin.ts` — Salvar coberturas no create/update

- Em `useCreatePlan`: após inserir benefícios, inserir `planos_coberturas` com `plano_id` e `cobertura_id`
- Em `useUpdatePlan`: após atualizar benefícios, delete+insert `planos_coberturas`
- Adicionar `coberturas?: { cobertura_id: string }[]` ao `PlanInput`

## Estrutura visual da aba

```text
┌─ Coberturas e Benefícios ─────────────────────┐
│                                                │
│ COBERTURAS                                     │
│ ☑ Roubo/Furto (COB-RF)                        │
│ ☑ Colisão (COB-COL)                           │
│ ☐ Incêndio (COB-INC)                          │
│ ☑ Danos a Terceiros (COB-TER)                 │
│                                                │
│ ─────────────────────────────────              │
│                                                │
│ BENEFÍCIOS                                     │
│ geral                                          │
│ ☑ Assistência 24h - 400km                     │
│ ☐ Kit Gás - R$ 2.200                          │
│ ...                                            │
└────────────────────────────────────────────────┘
```

## Arquivos modificados

- `src/components/admin/planos/PlanFormModal.tsx` — Renomear aba, estado de coberturas, submit com coberturas
- `src/components/admin/planos/BenefitsSelector.tsx` — Seção de coberturas com checkboxes
- `src/hooks/usePlansAdmin.ts` — `PlanInput.coberturas`, create/update salvam `planos_coberturas`

