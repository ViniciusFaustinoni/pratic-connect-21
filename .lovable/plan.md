

# Plano: Simplificar modal de plano — scroll contínuo com campos essenciais

## Resumo

Eliminar abas, remover campos que pertencem a outros níveis (linha, cobertura, benefício), e manter apenas os 10 campos solicitados em scroll contínuo.

## Alterações em `PlanFormModal.tsx`

### Remover da UI (sem dropar colunas)

Campos/seções inteiras a remover do JSX e do `formData`:
- `coverage_type` (Tipo de Cobertura)
- `additional_price` (Preço Adicional)
- `desconto_percentual` (Desconto Promocional)
- `cota_participacao` (Cota de Participação % FIPE)
- `categorias_veiculo` (Categorias de Veículo Aceitas) + checkboxes
- Regiões Disponíveis (checkboxes + `selectedRegioes`)
- Cotas por Categoria (bloco inteiro + `cotasCategorias` state)

### Remover imports e lógica associada

- Import de `Tabs, TabsContent, TabsList, TabsTrigger`
- Import de `useRegioes`
- Import de `useCategoriasVeiculoPlano`
- Import de `useUpdateBenefitExclusions`
- States: `selectedRegioes`, `cotasCategorias`, `pendingExclusions`
- useEffects de sync de regiões, cotas, exclusões
- Query `currentRegioes` e `existingCotasCat`
- Callback `handleExclusionsChange`
- No payload do `handleSubmit`: remover `tipo_uso`, `coverage_type`, `additional_price`, `desconto_percentual`, `cota_participacao`, `categorias_veiculo`, `regioes`
- Bloco de save de `planos_cotas_categoria` e `pendingExclusions`
- Prop `onExclusionsChange` passada ao `BenefitsSelector`
- Prop `pendingExclusions` passada ao `PlanPreview`

### Estrutura final do formulário (scroll contínuo, sem abas)

```text
ScrollArea
├── Nome *                          (Input, grid col 1)
├── Slug                            (Input, grid col 2)
├── Linha de Produto *              (Select)
├── Badge + Cor do Badge            (grid 2 cols)
├── Ativo (toggle) + Ordem          (inline)
├── ─── Separador "Coberturas" ───
├── Coberturas vinculadas           (checkboxes via BenefitsSelector)
├── ─── Separador "Benefícios" ───
├── Benefícios vinculados           (checkboxes via BenefitsSelector)
├── ─── Separador "Observações" ───
├── Alerta de Restrição             (Textarea)
└── Nota de Rodapé                  (Textarea)
```

### Payload do submit (mantido no banco)

Apenas: `name`, `slug`, `product_line_id`, `badge_text`, `badge_color`, `restriction_alert`, `footer_note`, `display_order`, `is_active`, `benefits`, `coberturas`.

## Arquivo modificado

- `src/components/admin/planos/PlanFormModal.tsx`

