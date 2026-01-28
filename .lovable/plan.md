
# Plano de Revisao Completa: Relatorios

## Status: ✅ IMPLEMENTADO

### Resumo das Alterações Realizadas
| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/config/relatoriosConfig.ts` | **Novo** | Configurações de query para cada relatório |
| `src/components/relatorios/RelatorioModal.tsx` | **Novo** | Modal genérico de geração de relatórios |
| `src/pages/relatorios/RelatoriosCentral.tsx` | Modificado | Conectar cliques a rotas existentes e modal |
| `src/pages/marketing/RelatoriosMarketing.tsx` | Modificado | Implementar exportação PDF real |

---

## Diagnostico Atual

### Estrutura da Area
| Pagina | Rota | Status |
|--------|------|--------|
| RelatoriosCentral.tsx | /relatorios | ✅ FUNCIONAL |
| RelatoriosVendas.tsx | /vendas/relatorios | ✅ FUNCIONAL |
| RelatoriosMarketing.tsx | /marketing/relatorios | ✅ FUNCIONAL |
| RelatoriosGerenciais.tsx | /diretoria/relatorios | ✅ FUNCIONAL |

### Status do Banco de Dados
| Tabela | Registros |
|--------|-----------|

| leads | 0 |
| cotacoes | 0 |
| contratos | 0 |
| associados | 0 |
| sinistros | 0 |
| cobrancas | 0 |
| instalacoes | 0 |
| campanhas | 0 |
| indicadores_atuariais | 0 |

**Obs:** O ambiente de producao esta vazio, mas o codigo esta preparado para quando houver dados.

---

## O que esta funcionando corretamente

| Pagina | Funcionalidade | Status |
|--------|----------------|--------|
| RelatoriosCentral | Sistema de favoritos (localStorage) | OK |
| RelatoriosCentral | Busca por nome/descricao/categoria | OK |
| RelatoriosCentral | Listagem de 32 relatorios em 6 categorias | OK |
| RelatoriosVendas | Filtros (data, vendedor, origem, etapa) | OK |
| RelatoriosVendas | Busca real no Supabase (leads) | OK |
| RelatoriosVendas | Exportacao Excel | OK |
| RelatoriosMarketing | KPIs calculados com dados reais | OK |
| RelatoriosMarketing | Filtro por periodo | OK |
| RelatoriosMarketing | Abas (Visao Geral, Por Canal, Por Campanha, Indicacoes) | OK |
| RelatoriosGerenciais | 11 relatorios gerenciais com dados reais | OK |
| RelatoriosGerenciais | Geracao PDF/CSV | OK |

---

## Problemas Identificados

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | handleRelatorioClick so exibe toast | RelatoriosCentral.tsx | 32 relatorios nao funcionam |
| 2 | Rotas individuais nao existem | App.tsx | Navegacao quebrada |
| 3 | Botao "Exportar PDF" so exibe toast | RelatoriosMarketing.tsx | Exportacao nao funciona |
| 4 | Nao ha redirecionamento para relatorios existentes | RelatoriosCentral.tsx | Duplicacao de acesso |

---

## Solucao Proposta

### Abordagem
Em vez de criar 32 paginas individuais (trabalho excessivo), vamos:
1. Criar um componente modal `RelatorioModal` que gera qualquer relatorio
2. Mapear cada relatorio do catalogo para uma configuracao de query
3. Redirecionar para paginas existentes quando aplicavel
4. Implementar exportacao PDF/Excel real

---

## Correcoes Necessarias

### 1. Criar RelatorioModal - Componente generico de geracao

**Novo arquivo**: `src/components/relatorios/RelatorioModal.tsx`

Componente que recebe configuracao e gera relatorio com dados reais:

```typescript
interface RelatorioConfig {
  id: string;
  titulo: string;
  tabela: string;
  colunas: string[];
  cabecalhos: string[];
  filtros?: Record<string, any>;
  agrupamento?: string;
  orderBy?: string;
}

// Configuracoes para cada relatorio
const relatorioConfigs: Record<string, RelatorioConfig> = {
  'leads-origem': {
    id: 'leads-origem',
    titulo: 'Leads por Origem',
    tabela: 'leads',
    colunas: ['origem', 'COUNT(*)'],
    cabecalhos: ['Origem', 'Quantidade'],
    agrupamento: 'origem',
  },
  'conversao-vendedor': {
    id: 'conversao-vendedor',
    titulo: 'Conversao por Vendedor',
    tabela: 'leads',
    colunas: ['vendedor_id', 'etapa'],
    cabecalhos: ['Vendedor', 'Total', 'Convertidos', 'Taxa'],
    // Query customizada
  },
  // ... demais configs
};
```

### 2. Atualizar RelatoriosCentral.tsx

**Arquivo**: `src/pages/relatorios/RelatoriosCentral.tsx`

Modificacoes:
1. Adicionar mapeamento de relatorios para rotas existentes
2. Abrir RelatorioModal para relatorios sem pagina dedicada

```typescript
// Mapeamento para relatorios que ja existem
const rotasExistentes: Record<string, string> = {
  'ranking-vendedores': '/vendas/relatorios',
  'vendas-periodo': '/vendas/relatorios',
  'conversao-vendedor': '/vendas/relatorios',
  'leads-origem': '/vendas/relatorios',
  'dashboard-executivo': '/diretoria',
  'sinistralidade-periodo': '/diretoria/relatorios',
  'sinistros-tipo': '/diretoria/relatorios',
  'associados-status': '/diretoria/relatorios',
  'receitas-despesas': '/diretoria/relatorios',
  'inadimplencia': '/diretoria/relatorios',
};

const handleRelatorioClick = (relatorio: Relatorio) => {
  // Se tem rota existente, navegar
  if (rotasExistentes[relatorio.id]) {
    navigate(rotasExistentes[relatorio.id]);
    return;
  }
  
  // Senao, abrir modal de geracao
  setSelectedRelatorio(relatorio);
  setShowModal(true);
};
```

### 3. Implementar Exportacao PDF em RelatoriosMarketing

**Arquivo**: `src/pages/marketing/RelatoriosMarketing.tsx`

Substituir toast por geracao real:

```typescript
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const handleExportarPDF = () => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Relatorio de Marketing', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Periodo: ${periodoLabels[periodo]}`, 14, 32);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 38);
  
  // KPIs
  autoTable(doc, {
    startY: 45,
    head: [['Indicador', 'Valor']],
    body: [
      ['Total Leads', kpis.totalLeads.toString()],
      ['Taxa Conversao', `${kpis.taxaConversao.toFixed(1)}%`],
      ['CPL Medio', `R$ ${kpis.cplMedio.toFixed(2)}`],
      ['Total Investido', `R$ ${kpis.totalInvestido.toLocaleString('pt-BR')}`],
      ['ROI', `${kpis.roi >= 0 ? '+' : ''}${kpis.roi.toFixed(1)}%`],
    ],
  });
  
  // Leads por Origem
  if (leadsPorOrigem.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Origem', 'Leads', 'Conversoes']],
      body: leadsPorOrigem.map(item => [
        item.origem,
        item.total.toString(),
        item.conversoes.toString(),
      ]),
    });
  }
  
  doc.save(`marketing-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  toast.success('Relatorio exportado!');
};
```

### 4. Configurar Relatorios Genericos

**Novo arquivo**: `src/config/relatoriosConfig.ts`

Configuracoes de query para cada relatorio do catalogo:

```typescript
export interface QueryConfig {
  tabela: string;
  select: string;
  filtros?: Record<string, any>;
  agrupamento?: string;
  cabecalhos: string[];
  formatadores?: Record<string, (value: any) => string>;
}

export const relatoriosQueryConfig: Record<string, QueryConfig> = {
  // COMERCIAL
  'leads-origem': {
    tabela: 'leads',
    select: 'origem',
    cabecalhos: ['Origem', 'Quantidade', '%'],
  },
  'tempo-conversao': {
    tabela: 'leads',
    select: 'created_at, updated_at, etapa',
    filtros: { etapa: 'ganho' },
    cabecalhos: ['Lead', 'Data Entrada', 'Data Conversao', 'Dias'],
  },
  'cotacoes-contratos': {
    tabela: 'cotacoes',
    select: 'status, created_at, valor_total_mensal',
    cabecalhos: ['Cotacao', 'Status', 'Data', 'Valor'],
  },
  
  // FINANCEIRO
  'receitas-plano': {
    tabela: 'cobrancas',
    select: 'valor_pago, plano:contratos(plano:planos(nome))',
    filtros: { status: 'pago' },
    cabecalhos: ['Plano', 'Quantidade', 'Receita Total'],
  },
  'aging-recebiveis': {
    tabela: 'cobrancas',
    select: 'data_vencimento, valor_final, associado:associados(nome)',
    filtros: { status: 'aguardando_pagamento' },
    cabecalhos: ['Faixa', 'Quantidade', 'Valor'],
  },
  
  // OPERACIONAL
  'instalacoes-regiao': {
    tabela: 'instalacoes',
    select: 'endereco_cidade, endereco_uf',
    cabecalhos: ['Regiao', 'Quantidade', '%'],
  },
  'tempo-instalacao': {
    tabela: 'instalacoes',
    select: 'agendada_para, concluida_em, status',
    filtros: { status: 'concluida' },
    cabecalhos: ['Periodo', 'Tempo Medio (dias)', 'Instalacoes'],
  },
  'estoque-rastreadores': {
    tabela: 'rastreadores',
    select: 'status, modelo, codigo',
    cabecalhos: ['Status', 'Modelo', 'Quantidade'],
  },
  
  // ASSOCIADOS
  'crescimento-base': {
    tabela: 'associados',
    select: 'created_at, status',
    cabecalhos: ['Mes', 'Novos', 'Acumulado'],
  },
  'churn-rate': {
    tabela: 'associados',
    select: 'updated_at, status',
    filtros: { status: 'cancelado' },
    cabecalhos: ['Mes', 'Cancelamentos', 'Taxa Churn'],
  },
  'veiculos-marca': {
    tabela: 'veiculos',
    select: 'marca, modelo',
    cabecalhos: ['Marca', 'Modelo', 'Quantidade', '%'],
  },
  
  // SINISTROS
  'top-sinistros': {
    tabela: 'sinistros',
    select: 'protocolo, tipo, valor_indenizacao, associado:associados(nome)',
    cabecalhos: ['Protocolo', 'Tipo', 'Valor', 'Associado'],
  },
  'tempo-regulacao': {
    tabela: 'sinistros',
    select: 'data_ocorrencia, data_resolucao, status',
    cabecalhos: ['Protocolo', 'Abertura', 'Resolucao', 'Dias'],
  },
  
  // GERENCIAL
  'comparativo-mensal': {
    tabela: 'indicadores_atuariais',
    select: '*',
    cabecalhos: ['Mes', 'Receita', 'Sinistros', 'Resultado', 'Margem'],
  },
};
```

---

## Resumo das Alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/components/relatorios/RelatorioModal.tsx` | **Novo** | Modal generico de geracao de relatorios |
| `src/config/relatoriosConfig.ts` | **Novo** | Configuracoes de query para cada relatorio |
| `src/pages/relatorios/RelatoriosCentral.tsx` | Modificar | Conectar cliques a rotas existentes e modal |
| `src/pages/marketing/RelatoriosMarketing.tsx` | Modificar | Implementar exportacao PDF real |

---

## Integracoes Existentes (NAO MEXER)

A area de Relatorios ja possui integracao correta com:

1. **Leads**: RelatoriosVendas busca dados de leads
2. **Campanhas**: RelatoriosMarketing busca campanhas e metricas
3. **Indicacoes**: RelatoriosMarketing busca indicacoes
4. **Indicadores Atuariais**: RelatoriosGerenciais busca indicadores
5. **Cobrancas**: RelatoriosGerenciais busca para DRE e inadimplencia
6. **Sinistros**: RelatoriosGerenciais busca para sinistralidade

**Nao e necessario alterar outras areas do sistema.**

---

## Fluxo de Funcionamento

1. Usuario acessa `/relatorios` (Central de Relatorios)
2. Usuario clica em um relatorio
3. Sistema verifica se existe rota dedicada
   - **SIM**: Redireciona para a pagina existente
   - **NAO**: Abre RelatorioModal
4. RelatorioModal exibe formulario de filtros (periodo, etc)
5. Usuario clica "Gerar"
6. Sistema busca dados do Supabase usando configuracao
7. Sistema gera PDF ou Excel
8. Arquivo e baixado automaticamente

---

## Verificacao Pos-Implementacao

1. Acessar Central de Relatorios
2. Clicar em "Ranking de Vendedores" - deve redirecionar para /vendas/relatorios
3. Clicar em "Leads por Origem" - deve abrir modal
4. No modal, selecionar periodo e gerar - deve baixar PDF
5. Acessar Relatorios Marketing e clicar "Exportar PDF" - deve baixar arquivo
6. Verificar que todos os 32 relatorios respondem ao clique
7. Verificar que dados do banco (quando houver) sao exibidos corretamente
