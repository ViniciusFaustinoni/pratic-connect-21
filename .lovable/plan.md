

# Plano: Remover "Tabela de Preços" e corrigir modal de plano

## Problemas identificados

1. **"Tabela de Preços (Linha)"** e um campo hardcoded: busca slugs da tabela `tabelas_preco_mensalidade` e exibe como dropdown. A tabela `plano_preco_map` esta vazia — nenhum plano usa esse mapeamento. O preco e resolvido automaticamente pelo motor de cotacao via product_line. Esse campo deve ser removido.

2. **Loop infinito** ao clicar em coberturas: o `useEffect` principal do `PlanFormModal` tem `currentPrecoMap` e `currentRegioes` como dependencias. Quando qualquer state muda, essas queries podem retornar novas referencias, resetando todo o form (incluindo `selectedCoberturas`), criando um ciclo.

3. **Campos de cota legados** (`cota_passeio_percent/min`, `cota_desagio_percent/min`, `cota_app_percent/min`) convivem com o novo sistema de "Cotas por Categoria" (`planos_cotas_categoria`). Os campos legados sao redundantes.

## Alteracoes

### 1. `PlanFormModal.tsx` — Remover campo "Tabela de Precos" e codigo relacionado

- Remover a query `availableLinhaSlugs` (busca slugs de `tabelas_preco_mensalidade`)
- Remover a query `currentPrecoMap` (busca `plano_preco_map`)
- Remover `linha_slug` do `formData` e do reset/init
- Remover o bloco UI "Tabela de Precos (Linha)" (linhas 622-645)
- Remover `linha_slug` do payload de `handleSubmit`
- Remover o `useEffect` que sincroniza `linha_slug` com `currentPrecoMap` (linhas 296-300)

### 2. `PlanFormModal.tsx` — Remover campos de cota legados

Os campos `cota_passeio_percent`, `cota_passeio_min`, `cota_desagio_percent`, `cota_desagio_min`, `cota_app_percent`, `cota_app_min` sao redundantes com o sistema de "Cotas por Categoria" ja implementado. Remover do `formData`, do init, do payload e da UI.

### 3. `PlanFormModal.tsx` — Corrigir loop infinito

Com a remocao de `currentPrecoMap` das dependencias do useEffect principal, o loop causado por referencia instavel sera resolvido. Alem disso, separar a inicializacao de `selectedRegioes` para um efeito proprio (ja existe, mas `currentRegioes` tambem esta no efeito principal — remover de la).

### 4. `usePlansAdmin.ts` — Limpar mapeamento de campos

- Remover logica de `plano_preco_map` (insert/delete) do create e update
- Remover campos `linha_slug` do `PlanInput`
- Manter campos legados de cota no DB mapping por compatibilidade, mas zerar/nullar eles

## Resumo de campos no form apos limpeza

**Aba Basico**: Nome, Slug, Linha de Produto, Badge, Cor Badge, Tipo de Cobertura, Ano Minimo, Ano Maximo, Categorias de Veiculo, Regioes, Ativo, Preco Adicional, Desconto Promocional, Cotas por Categoria (dinamico)

**Aba Coberturas e Beneficios**: Checkboxes de coberturas e beneficios do catalogo

**Aba Regras**: EligibilityRulesEditor + MarcaModeloExclusionEditor (somente edicao)

**Aba Outros**: Alerta de Restricao, Nota de Rodape, Ordem de Exibicao

## Arquivos modificados

- `src/components/admin/planos/PlanFormModal.tsx` — Remover campo tabela de precos, campos cota legados, corrigir loop
- `src/hooks/usePlansAdmin.ts` — Remover logica de plano_preco_map e campo linha_slug

