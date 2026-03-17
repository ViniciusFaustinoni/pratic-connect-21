

## Plano: Unificar em "Planos, Produtos e Preços"

### Resumo simples

A aba **Tabela de Preços** é a fonte da verdade. Vamos absorver nela o que só existe em **Produtos & Planos** (sidebar de planos, coberturas, benefícios, preço ajustado) e eliminar a aba duplicada.

### O que muda

#### 1. Renomear e remover aba duplicada

- **`TabNavigation.tsx`**: O item "Produtos & Planos" vira **"Planos, Produtos e Preços"**. Remove "Tabela de Preços" (index 2). Reindexar: Adicionais→2, Simulador→3, Elegibilidade→4.
- **`GestaoComercial.tsx`**: Remove import de `TabelaPrecosTab` e referência `activeTab === 2`. Ajustar índices.

#### 2. Redesenhar `ProdutosPlanos.tsx` com layout unificado

O componente passa a ter dois modos:

**Modo Global (nenhum plano selecionado no sidebar):**
- O painel direito (col-span-2) renderiza a view completa da `TabelaPrecosTab` — filtros por plano/linha/região/status, agrupamento por `linha_slug`, badges de planos vinculados, CRUD (editar/excluir/histórico), CSV import/export, paginação por grupo
- Ou seja: em vez de "Selecione um plano", aparece a tabela de preços completa

**Modo Plano Selecionado (clicou num plano no sidebar):**
- Sub-aba **"Faixas de Preço"** passa a buscar TODAS as faixas da `linha_slug` do plano (todos os `tipo_uso`), usando a mesma query da `TabelaPrecosTab` filtrada por `linha_slug`
- Adiciona colunas que faltam: **Combustível**, **Valor Deságio**, **Status**
- Adiciona botões de ação por faixa: **Editar**, **Histórico**, **Excluir** (reutiliza `FaixaPrecoModal` e `HistoricoPrecoModal`)
- Adiciona botões globais: **Nova Faixa**, **Importar CSV**, **Exportar CSV**
- Adiciona filtro **Ativo/Inativo** (Switch)
- **Mantém** o cálculo de preço ajustado (base + adicional − desconto%) com tooltip mostrando a decomposição — é o único dado que não existia na Tabela de Preços
- Sub-abas **Coberturas**, **Benefícios** e **Detalhes** permanecem inalteradas

#### 3. Imports e query keys

- Importar `FaixaPrecoModal` e `HistoricoPrecoModal` em `ProdutosPlanos.tsx`
- A query de faixas no modo plano passa a usar `tabelas_preco_mensalidade` filtrado por `linha_slug` (sem depender de `plano_preco_map` para mostrar faixas — o map continua existindo para o motor de cotação, mas a visualização mostra tudo da linha)
- Invalidar `tabela-precos-gc` e `plano-preco-mappings` ao editar/excluir faixas

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `TabNavigation.tsx` | Renomear tab 0, remover tab 2, reindexar |
| `GestaoComercial.tsx` | Remover `TabelaPrecosTab`, reindexar |
| `ProdutosPlanos.tsx` | Modo global = TabelaPrecosTab; modo plano = sub-aba preços enriquecida com CRUD + colunas + preço ajustado |

### O que NÃO muda

- Banco de dados (zero migrações)
- Hooks de cotação (`useCotacao`, `useCotacaoAvancada`, `useCalcularCotacao`)
- `plano_preco_map` (continua existindo, usado pelo motor de cotação)
- `TabelaPrecosTab.tsx` (permanece como componente, será renderizado dentro de ProdutosPlanos)
- Lógica de `resolverPrecoApp` / adicional app
- Fluxo de vendedores / cotação pública

