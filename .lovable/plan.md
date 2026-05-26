## Diagnóstico (código real)

Arquivo único afetado: `src/components/admin/planos/PlanBeneficiosList.tsx`

### Erro 2 — Benefício criado para o plano não aparece na lista de "Atribuir Existente"

Lógica atual (linhas 210-225):

```ts
// Get all existing bindings with plan names
const { data: allBindings, error: vErr } = await supabase
  .from('planos_beneficios')
  .select('benefit_id, planos:plano_id(nome)');
...
// Exclude benefits already assigned to ANY plan
const assignedIds = new Set(Array.from(vinculoMap.keys()));
return (allBenefits || [])
  .filter((b: any) => !assignedIds.has(b.id));
```

O filtro exclui qualquer benefício que tenha vínculo em `planos_beneficios` com QUALQUER plano. Como a regra canônica é 1:1 (memória `Plan uniqueness` / `Decoupled items`), todo benefício criado já nasce vinculado a um plano — então a lista quase sempre vem vazia. O benefício que o usuário criou "para esse plano" já tem vínculo e é descartado. O único que sobrou no print ("Rastreador/Monitoramento - Select Premium - Aplicativo") é um caso órfão (sem registro em `planos_beneficios`).

A intenção real desta tela é "atribuir um benefício existente a ESTE plano". Então deve excluir apenas o que já está vinculado a `planId` atual — não a outros planos. Benefícios vinculados a outros planos não podem ser reaproveitados (regra 1:1), mas a fonte de verdade para isso já é a unicidade no banco; a UI deve mostrar candidatos não-vinculados ao plano atual e a operação `insert` em `planos_beneficios` falharia se houvesse conflito.

### Erro 1 — Modal aparece cortado horizontalmente

DialogContent (linha 355):

```tsx
<DialogContent className="max-w-md max-h-[80vh]" onInteractOutside={(e) => e.preventDefault()}>
```

Lista (linha 369):
```tsx
<div className="max-h-[40vh] overflow-y-auto space-y-1 border rounded-lg p-2">
```

Rodapé (linhas 396-409): `flex items-center justify-between` com "0 selecionado(s)" + Cancelar + "Vincular Selecionados" não cabe em `max-w-md` em viewports estreitos — o botão "Vincular Selecionados" estoura, força overflow horizontal no DialogContent e o usuário vê o título do botão cortado + uma scrollbar horizontal embaixo (visível no print). A lista interna também só tem `overflow-y-auto`, sem `overflow-x-hidden`, então qualquer nome longo (ex.: "Rastreador/Monitoramento - Select Premium - Aplicativo") também empurra a largura mesmo com `truncate` se o ancestral não tiver `min-w-0`.

## Correções

Apenas no arquivo `src/components/admin/planos/PlanBeneficiosList.tsx`:

**Fix Erro 2 (queryFn `beneficios-disponiveis-all`, linhas 199-228):**
- Trocar o `select` de bindings por `.eq('plano_id', planId)` para trazer só vínculos do plano atual.
- Filtrar `allBenefits` excluindo apenas os IDs vinculados a este plano.
- Atualizar comentários para refletir a nova semântica.

**Fix Erro 1 (DialogContent, linhas 354-411):**
- Ampliar largura: `max-w-md` → `max-w-lg w-[calc(100vw-2rem)]` e adicionar `overflow-hidden` para impedir scroll horizontal externo.
- Lista interna: adicionar `overflow-x-hidden` em complemento ao `overflow-y-auto`.
- Garantir truncamento: adicionar `min-w-0` no `<label>` da linha 380 (já existe no filho `flex items-center gap-2 min-w-0 flex-1`, mas o label pai precisa também).
- Rodapé (linha 396): trocar para `flex flex-wrap items-center justify-between gap-2 pt-1` para os botões quebrarem linha em telas estreitas em vez de transbordar.

## Fora de escopo

- Nenhuma mudança em hooks, edge functions, schema, RLS ou regra de unicidade 1:1 (continua sendo enforçada no banco).
- Nenhuma mudança no fluxo de criar/excluir benefício, no inline form, em coberturas, eligibility, ou no botão "Novo Benefício".

## Verificação manual após implementar

1. Abrir Editar Plano do "Select Basic - Até 30 Mil com rastreador" → clicar "Atribuir Existente".
2. Modal abre dentro da viewport, sem scrollbar horizontal e com botão "Vincular Selecionados" inteiro visível.
3. Lista mostra benefícios não vinculados a este plano (inclusive os recém-criados para outros planos que ficaram órfãos, e qualquer benefício sem vínculo).
4. Selecionar um item e vincular: se já estiver vinculado a outro plano via regra 1:1, o insert falha com erro de unicidade do banco (comportamento pré-existente).
