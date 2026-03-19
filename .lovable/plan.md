

# Redesign Completo — Planos e Benefícios

## Problemas identificados

1. **Visão Geral embolada**: mostra TODAS as linhas (carros + motos) juntas, sem separação clara — parece igual à aba "Carros"
2. **Scroll longo nas tabelas de preço**: a `TabelaPrecosGeneric` renderiza todas as faixas FIPE de uma vez (potencialmente centenas de linhas)
3. **Ranking não funciona**: o hook `useRankingVendedores` depende de contratos com `vendedor_id` e cotações — se não houver dados no período, exibe "Nenhuma atividade" sem contexto útil
4. **Tabs desorganizadas**: 7 tabs (com permissões) competem por espaço, muita informação redundante entre "Visão Geral" e "Carros"

## Nova arquitetura da página

```text
┌─────────────────────────────────────────────────┐
│ Header: título + Calculadora + Se fechar hoje?  │
├─────────────────────────────────────────────────┤
│ Tabs: Carros │ Motos │ Comparador │ Ranking │   │
│       Glossário │ [Adicionais] │ [Regiões]     │
├─────────────────────────────────────────────────┤
│ Tab Carros (default):                           │
│  ┌──────────────────────────────────────────┐   │
│  │ Planos por Linha (cards dinâmicos)       │   │
│  │ Coberturas Principais (ícones)           │   │
│  │ Tabela de Preços (colapsada + paginada)  │   │
│  │ Veículos Aceitos (colapsado)             │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│ Tab Motos: (mesma estrutura, dados de moto)     │
│ Tab Comparador: ComparadorNiveis unificado      │
│ Tab Ranking: Vendedores (com fallback melhor)   │
└─────────────────────────────────────────────────┘
```

## Mudanças específicas

### 1. Eliminar "Visão Geral" — "Carros" vira tab default

A tab "Visão Geral" é redundante (mostra as mesmas linhas de carros + motos misturadas). Removê-la e tornar **Carros** a tab padrão. Coberturas Principais e alerta de deságio vão para dentro de cada tab (Carros/Motos) contextualmente.

### 2. Tabela de Preços — colapsável + paginação

**Arquivo:** `src/components/planos/TabelaPrecos.tsx`

- Renderizar dentro de um `Collapsible` (fechado por padrão) com título "Ver tabela de preços"
- Limitar a 20 linhas visíveis + botão "Mostrar mais" (paginação local)
- Labels de linhas dinâmicos (buscar de `product_lines` ao invés de hardcoded `LINHA_LABELS`)

### 3. Veículos Aceitos — colapsável

Já usa Accordion internamente, mas o Card inteiro deve iniciar colapsado dentro de um `Collapsible` na tab.

### 4. Ranking — fallback útil + indicador de status

**Arquivo:** `src/components/planos/RankingVendedores.tsx`

- Quando não houver dados: exibir card com mensagem contextual ("Nenhum contrato ou cotação registrado neste mês. O ranking será atualizado conforme novos dados entrarem.")
- Adicionar indicador visual de "última atualização" baseado no `staleTime`
- Mover resumo (Contratos/Valor/Cotações/Vendedores) para o topo como KPI cards ao invés de ficar no rodapé

### 5. Comparador em tab própria

Mover `ComparadorNiveisSelect` e `ComparadorNiveisMotos` para uma tab "Comparador" única, com toggle Carros/Motos, em vez de embutido nas tabs individuais.

### 6. PlanoCardDynamic — compactar

Reduzir padding, diminuir `BENEFICIOS_VISIVEIS` de 4 para 3, e mover cotas para uma linha mais compacta.

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/vendas/PlanosBeneficios.tsx` | Reestruturar tabs: remover "Visão Geral", Carros como default, criar tab "Comparador", reorganizar conteúdo |
| `src/components/planos/TabelaPrecos.tsx` | Colapsável por padrão + paginação de 20 linhas + labels dinâmicos |
| `src/components/planos/RankingVendedores.tsx` | KPIs no topo + fallback contextual melhorado |
| `src/components/planos/PlanoCardDynamic.tsx` | Layout mais compacto (3 benefícios visíveis, cotas em linha única) |
| `src/components/planos/PlanoLineSection.tsx` | Ajustar grid para max 4 cols em telas grandes |

Nenhum arquivo novo. Nenhuma mudança de schema ou hooks — apenas reorganização visual e UX.

