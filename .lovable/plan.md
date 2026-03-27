

# Adicionar Botões de Duplicar em Coberturas/Benefícios e Linhas/Planos

## Estado atual

| Componente | Entidade | Botão Duplicar |
|---|---|---|
| `BeneficiosCoberturas.tsx` (admin/planos) | Coberturas, Benefícios | ✅ Já tem |
| `ProdutosPlanos.tsx` (gestão comercial) | Planos | ✅ Já tem |
| `CatalogoCoberturasBeneficios.tsx` (gestão comercial) | Coberturas, Benefícios | ❌ Falta |
| `LinhasPlanos.tsx` (gestão comercial) | Linhas, Planos | ❌ Falta |

Os hooks de duplicação já existem todos em `usePlansAdmin.ts`: `useDuplicateCobertura`, `useDuplicateBenefit`, `useDuplicatePlan`, `useDuplicateProductLine`.

## Alterações

### 1. `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx`
- Importar `Copy` do lucide-react e `useDuplicateCobertura`, `useDuplicateBenefit` de `usePlansAdmin`
- No componente `ItemList`, adicionar prop `onDuplicate` e um botão `Copy` ao lado de Edit/Trash
- Passar as funções de duplicação via props na chamada de `ItemList`

### 2. `src/components/gestao-comercial/LinhasPlanos.tsx`
- Importar `Copy` do lucide-react e `useDuplicateProductLine`, `useDuplicatePlan` de `usePlansAdmin`
- Nas ações da **linha** (ao lado de Pencil/Trash2, ~linha 232): adicionar botão Copy que chama `duplicateProductLine.mutate(linha.id)`
- Nas ações do **plano** (ao lado de Trash2, ~linha 262): adicionar botão Copy que chama `duplicatePlan.mutate(plano.id)`

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/gestao-comercial/CatalogoCoberturasBeneficios.tsx` | Adicionar botão duplicar em coberturas e benefícios |
| `src/components/gestao-comercial/LinhasPlanos.tsx` | Adicionar botão duplicar em linhas e planos |

