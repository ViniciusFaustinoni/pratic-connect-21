

# Plano: Adicionar campo "Cota de Participação (%)" no modal de plano

## Contexto

A coluna `cota_participacao` (numeric) ja existe na tabela `planos`. O motor de cotacao e o termo de afiliacao ja a utilizam. Porem o modal de criacao/edicao de plano nao expoe esse campo — ele so pode ser definido via banco direto.

## Alteracoes

### 1. `PlanFormModal.tsx`

- Adicionar `cota_participacao: ''` ao `formData` inicial
- No init (quando `plan` existe), carregar `p.cota_participacao?.toString() || ''`
- Adicionar campo Input type="number" com label "Cota de Participação (% FIPE)" na aba Basico, proximo ao campo "Tipo de Cobertura" (apos ano maximo)
- Placeholder: "Ex: 6" com hint explicando que e a porcentagem da FIPE cobrada do associado em eventos de colisao
- No `handleSubmit`, incluir `cota_participacao` no payload

### 2. `usePlansAdmin.ts` — `PlanInput`

- Adicionar `cota_participacao?: number | null` ao `PlanInput`
- No `planoData` do create e update, mapear: `cota_participacao: planData.cota_participacao ?? null`

## Arquivos modificados

- `src/components/admin/planos/PlanFormModal.tsx`
- `src/hooks/usePlansAdmin.ts`

