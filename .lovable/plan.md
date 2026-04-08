

# Plano: Remover campos "Ano Mínimo" e "Ano Máximo" do modal de plano

## Contexto

A configuração de faixa de ano de fabricação deve existir apenas na Linha de Produto, não no Plano individual. O modal de plano possui campos "Ano Mínimo" e "Ano Máximo" que devem ser removidos.

## Alterações em `PlanFormModal.tsx`

1. **Remover do `formData` inicial**: campos `min_vehicle_year` e `ano_fabricacao_maximo` (linhas 147-148, 230-231)
2. **Remover do init** quando plan existe (linhas 193-194)
3. **Remover do payload** no `handleSubmit` (linhas 298-301)
4. **Remover os dois blocos UI** — "Ano Mínimo" (linhas 502-515) e "Ano Máximo" (linhas 517-530)

## Arquivo modificado

- `src/components/admin/planos/PlanFormModal.tsx`

