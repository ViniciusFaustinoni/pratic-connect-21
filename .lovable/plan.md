
# Plano: Relatório Analítico de Custos de Reparos

## Objetivo
Criar um relatório atuarial que detalhe os custos de reparos de veículos em sinistros, separando por categoria: **Peças**, **Mão de Obra** e **Serviços Terceiros**. Este relatório será fundamental para análise de precificação, provisões técnicas e gestão de custos.

---

## Estrutura de Dados Existente

A estrutura já está pronta para suportar este relatório:

| Tabela | Campo | Valores |
|--------|-------|---------|
| `ordens_servico_itens` | `tipo` | `peca`, `mao_de_obra`, `servico_terceiro` |
| `ordens_servico` | `sinistro_id` | Vincula OS ao sinistro |
| `sinistros` | `tipo` | Tipo de evento (colisão, roubo, etc.) |

---

## Componentes a Criar

### 1. Componente Principal: `CustosReparosTable.tsx`

**Localização:** `src/components/diretoria/CustosReparosTable.tsx`

**Funcionalidades:**
- Buscar ordens de serviço pagas/concluídas do período
- Agregar itens por tipo (`peca`, `mao_de_obra`, `servico_terceiro`)
- Exibir tabela com totais e percentuais
- Permitir drill-down por tipo de sinistro
- Calcular ticket médio por categoria

```text
┌─────────────────────────────────────────────────────────────────────┐
│  CUSTOS DE REPAROS - ANÁLISE POR CATEGORIA                         │
│  Período: Jan/2026 - Dez/2026                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────┬──────────┬─────────────┬──────────┬─────────────┐   │
│  │ Categoria  │ Qtd Itens│ Valor Total │ % Total  │ Ticket Médio│   │
│  ├────────────┼──────────┼─────────────┼──────────┼─────────────┤   │
│  │ Peças      │ 245      │ R$ 156.780  │ 52,3%    │ R$ 640      │   │
│  │ Mão de Obra│ 180      │ R$ 89.500   │ 29,9%    │ R$ 497      │   │
│  │ Serv.Terc. │ 67       │ R$ 53.220   │ 17,8%    │ R$ 794      │   │
│  ├────────────┼──────────┼─────────────┼──────────┼─────────────┤   │
│  │ TOTAL      │ 492      │ R$ 299.500  │ 100%     │ R$ 609      │   │
│  └────────────┴──────────┴─────────────┴──────────┴─────────────┘   │
│                                                                     │
│  [===========================] 52,3% Peças                          │
│  [==================]         29,9% Mão de Obra                     │
│  [==========]                 17,8% Serviços Terceiros              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Componente Detalhado: `CustosReparosPorTipoSinistro.tsx`

**Localização:** `src/components/diretoria/CustosReparosPorTipoSinistro.tsx`

**Funcionalidades:**
- Cruzar custos por tipo de sinistro (colisão, roubo, incêndio, etc.)
- Mostrar composição de custos para cada tipo
- Identificar padrões de custo por evento

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  COMPOSIÇÃO DE CUSTOS POR TIPO DE SINISTRO                              │
├────────────────┬─────────────┬─────────────┬────────────┬───────────────┤
│ Tipo Sinistro  │ Peças       │ Mão de Obra │ Serv.Terc. │ Total         │
├────────────────┼─────────────┼─────────────┼────────────┼───────────────┤
│ Colisão        │ R$ 98.450   │ R$ 56.200   │ R$ 12.300  │ R$ 166.950    │
│                │ (59%)       │ (34%)       │ (7%)       │               │
├────────────────┼─────────────┼─────────────┼────────────┼───────────────┤
│ Roubo Recup.   │ R$ 45.330   │ R$ 28.100   │ R$ 35.420  │ R$ 108.850    │
│                │ (42%)       │ (26%)       │ (32%)      │               │
├────────────────┼─────────────┼─────────────┼────────────┼───────────────┤
│ Fenôm. Natural │ R$ 12.000   │ R$ 5.200    │ R$ 5.500   │ R$ 22.700     │
│                │ (53%)       │ (23%)       │ (24%)      │               │
└────────────────┴─────────────┴─────────────┴────────────┴───────────────┘
```

### 3. Gráfico de Evolução Mensal: `CustosReparosChart.tsx`

**Localização:** `src/components/diretoria/CustosReparosChart.tsx`

**Funcionalidades:**
- Gráfico de barras empilhadas (stacked bar chart)
- Mostrar evolução mensal de cada categoria
- Linha de tendência do custo total

```text
          │
 R$ 50k   │        ▓▓▓
          │    ▓▓▓ ▓▓▓     ▓▓▓
 R$ 40k   │    ▓▓▓ ▓▓▓ ▓▓▓ ▓▓▓
          │▓▓▓ ░░░ ░░░ ░░░ ░░░ ▓▓▓
 R$ 30k   │▓▓▓ ░░░ ░░░ ░░░ ░░░ ▓▓▓
          │░░░ ▒▒▒ ▒▒▒ ▒▒▒ ▒▒▒ ░░░
 R$ 20k   │░░░ ▒▒▒ ▒▒▒ ▒▒▒ ▒▒▒ ░░░
          │▒▒▒ ▒▒▒ ▒▒▒ ▒▒▒ ▒▒▒ ▒▒▒
 R$ 10k   │▒▒▒ ▒▒▒ ▒▒▒ ▒▒▒ ▒▒▒ ▒▒▒
          └─────────────────────────
           Jan  Fev  Mar  Abr  Mai  Jun

          ▒▒▒ Peças  ░░░ M.O.  ▓▓▓ Serv.Terc.
```

---

## Integração na Página de Indicadores Atuariais

**Arquivo:** `src/pages/diretoria/IndicadoresAtuariais.tsx`

Adicionar nova aba "Custos de Reparos" no componente `Tabs`:

```tsx
<TabsList>
  <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
  <TabsTrigger value="sinistralidade">Sinistralidade</TabsTrigger>
  <TabsTrigger value="custos-reparos">Custos de Reparos</TabsTrigger>  {/* NOVA */}
  <TabsTrigger value="crescimento">Crescimento</TabsTrigger>
  <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
</TabsList>
```

---

## Relatório Gerencial para Exportação

**Arquivo:** `src/pages/diretoria/RelatoriosGerenciais.tsx`

Adicionar novo relatório na categoria "Atuarial":

```tsx
{ 
  id: 'custos-reparos', 
  categoria: 'atuarial',
  titulo: 'Custos de Reparos por Categoria', 
  descricao: 'Análise de peças, mão de obra e serviços terceiros',
  icon: Wrench
},
```

**Lógica de geração:**

```typescript
case 'custos-reparos': {
  // Buscar itens de OS vinculadas a sinistros do período
  const { data } = await supabase
    .from('ordens_servico_itens')
    .select(`
      tipo,
      valor_total,
      ordem_servico:ordens_servico!inner(
        sinistro_id,
        status,
        created_at
      )
    `)
    .in('ordem_servico.status', ['concluido', 'pago'])
    .not('ordem_servico.sinistro_id', 'is', null)
    .gte('ordem_servico.created_at', reportFilters.dataInicio)
    .lte('ordem_servico.created_at', reportFilters.dataFim + 'T23:59:59');

  // Agrupar por tipo
  const agrupado = { peca: 0, mao_de_obra: 0, servico_terceiro: 0 };
  data?.forEach(item => {
    agrupado[item.tipo] += item.valor_total || 0;
  });

  const total = Object.values(agrupado).reduce((s, v) => s + v, 0);

  cabecalhos = ['Categoria', 'Valor', '% Total'];
  dados = [
    ['Peças', formatCurrency(agrupado.peca), `${((agrupado.peca/total)*100).toFixed(1)}%`],
    ['Mão de Obra', formatCurrency(agrupado.mao_de_obra), `${((agrupado.mao_de_obra/total)*100).toFixed(1)}%`],
    ['Serviços Terceiros', formatCurrency(agrupado.servico_terceiro), `${((agrupado.servico_terceiro/total)*100).toFixed(1)}%`],
    ['TOTAL', formatCurrency(total), '100%'],
  ];
  break;
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/diretoria/CustosReparosTable.tsx` | **Criar** | Tabela principal com totais por categoria |
| `src/components/diretoria/CustosReparosPorTipoSinistro.tsx` | **Criar** | Cruzamento custo x tipo sinistro |
| `src/components/diretoria/CustosReparosChart.tsx` | **Criar** | Gráfico de evolução mensal |
| `src/components/diretoria/index.ts` | Editar | Exportar novos componentes |
| `src/pages/diretoria/IndicadoresAtuariais.tsx` | Editar | Adicionar aba "Custos de Reparos" |
| `src/pages/diretoria/RelatoriosGerenciais.tsx` | Editar | Adicionar relatório exportável |

---

## Fluxo de Dados

```text
┌─────────────────────┐
│  ordens_servico     │
│  (status = pago)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐        ┌─────────────────────┐
│ ordens_servico_itens│───────▶│     sinistros       │
│  tipo:              │        │  tipo:              │
│  - peca             │        │  - colisao          │
│  - mao_de_obra      │        │  - roubo            │
│  - servico_terceiro │        │  - incendio         │
└─────────────────────┘        │  - etc.             │
          │                    └─────────────────────┘
          ▼
┌─────────────────────────────────────────────────────┐
│                    RELATÓRIO                        │
│                                                     │
│  ┌────────────┬─────────────┬────────────────────┐  │
│  │ Por        │ Categoria   │ Por Tipo Sinistro  │  │
│  │ Período    │ de Custo    │                    │  │
│  └────────────┴─────────────┴────────────────────┘  │
│                                                     │
│  [PDF]  [CSV]  [Gráfico]                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Indicadores Atuariais Derivados

O relatório permitirá calcular métricas importantes:

| Indicador | Fórmula | Uso Atuarial |
|-----------|---------|--------------|
| **% Peças** | Peças / Total | Monitorar inflação de autopeças |
| **% Mão de Obra** | M.O. / Total | Avaliar produtividade oficinas |
| **Custo Médio Reparo** | Total / Qtd OS | Precificação de cotas |
| **Ratio Peça/MO** | Peças / M.O. | Comparar com mercado |
| **Serv.Terc./Total** | Terc. / Total | Avaliar terceirização |

---

## Estrutura Visual da Aba

```text
┌─────────────────────────────────────────────────────────────────────┐
│  INDICADORES ATUARIAIS                              [2026 ▼] [🔄]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Visão Geral | Sinistralidade | Custos de Reparos* | ...    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  RESUMO DE CUSTOS (Ano)                                      │   │
│  │                                                              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │   │
│  │  │ R$156k  │  │ R$89k   │  │ R$53k   │  │ R$299k  │         │   │
│  │  │ Peças   │  │ M.O.    │  │ Terc.   │  │ TOTAL   │         │   │
│  │  │ 52,3%   │  │ 29,9%   │  │ 17,8%   │  │         │         │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐   │
│  │  Evolução Mensal        │  │  Composição por Tipo Sinistro   │   │
│  │  [Gráfico Barras Stack] │  │  [Tabela Detalhada]             │   │
│  └─────────────────────────┘  └─────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  DETALHAMENTO POR OFICINA (Top 10)                           │   │
│  │  [Tabela com oficina, qtd OS, total peças, total MO, ...]   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Resumo Técnico

### Query Principal

```typescript
const { data } = await supabase
  .from('ordens_servico_itens')
  .select(`
    id,
    tipo,
    valor_unitario,
    quantidade,
    valor_total,
    descricao,
    ordem_servico:ordens_servico!inner(
      id,
      numero,
      status,
      created_at,
      sinistro_id,
      oficina:oficinas(id, nome_fantasia),
      sinistro:sinistros(id, tipo, tipo_dano)
    )
  `)
  .in('ordem_servico.status', ['concluido', 'pago', 'aguardando_pagamento'])
  .not('ordem_servico.sinistro_id', 'is', null)
  .gte('ordem_servico.created_at', inicioAno)
  .lte('ordem_servico.created_at', fimAno);
```

### Agrupamento

```typescript
const porCategoria = {
  peca: { quantidade: 0, valor: 0, itens: 0 },
  mao_de_obra: { quantidade: 0, valor: 0, itens: 0 },
  servico_terceiro: { quantidade: 0, valor: 0, itens: 0 },
};

data?.forEach(item => {
  const tipo = item.tipo;
  porCategoria[tipo].valor += item.valor_total || 0;
  porCategoria[tipo].quantidade += item.quantidade || 0;
  porCategoria[tipo].itens += 1;
});
```
