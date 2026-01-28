// Configurações de relatórios genéricos para a Central de Relatórios

export interface RelatorioQueryConfig {
  id: string;
  titulo: string;
  tabela: string;
  select: string;
  cabecalhos: string[];
  filtros?: Record<string, any>;
  orderBy?: string;
  descricao?: string;
  processarDados?: (dados: any[]) => any[];
}

// Mapeamento de relatórios para rotas existentes
export const rotasExistentes: Record<string, string> = {
  // Comercial -> Vendas
  'leads-origem': '/vendas/relatorios',
  'conversao-vendedor': '/vendas/relatorios',
  'ranking-vendedores': '/vendas/relatorios',
  
  // Gerencial -> Diretoria
  'dashboard-executivo': '/diretoria',
  'sinistralidade-periodo': '/diretoria/relatorios',
  'sinistros-tipo': '/diretoria/relatorios',
  'comparativo-mensal': '/diretoria/relatorios',
  'kpis': '/diretoria/relatorios',
  'performance-geral': '/diretoria/relatorios',
  
  // Financeiro -> Diretoria (se existir relatórios financeiros)
  'receitas-plano': '/diretoria/relatorios',
  'inadimplencia-faixa': '/diretoria/relatorios',
  
  // Marketing
  'campanhas': '/marketing/relatorios',
};

// Configurações de queries para relatórios genéricos
export const relatoriosQueryConfig: Record<string, RelatorioQueryConfig> = {
  // COMERCIAL
  'tempo-conversao': {
    id: 'tempo-conversao',
    titulo: 'Tempo Médio de Conversão',
    tabela: 'leads',
    select: 'id, nome, created_at, updated_at, etapa',
    filtros: { etapa: 'ganho' },
    cabecalhos: ['Lead', 'Entrada', 'Conversão', 'Dias'],
    descricao: 'Tempo entre criação do lead e conversão',
  },
  'cotacoes-contratos': {
    id: 'cotacoes-contratos',
    titulo: 'Cotações x Contratos',
    tabela: 'cotacoes',
    select: 'id, numero, status, created_at, valor_total_mensal',
    cabecalhos: ['Número', 'Status', 'Data', 'Valor'],
    orderBy: 'created_at',
    descricao: 'Análise do funil de vendas',
  },
  'metas-realizado': {
    id: 'metas-realizado',
    titulo: 'Metas vs Realizado',
    tabela: 'leads',
    select: 'vendedor_id, etapa, created_at',
    cabecalhos: ['Vendedor', 'Meta', 'Realizado', '%'],
    descricao: 'Acompanhamento de metas da equipe',
  },
  
  // FINANCEIRO
  'aging-recebiveis': {
    id: 'aging-recebiveis',
    titulo: 'Aging de Recebíveis',
    tabela: 'cobrancas',
    select: 'id, data_vencimento, valor_final, status, associado:associados(nome)',
    filtros: { status: 'aguardando_pagamento' },
    cabecalhos: ['Associado', 'Vencimento', 'Valor', 'Dias em Atraso'],
    orderBy: 'data_vencimento',
    descricao: 'Contas a receber por vencimento',
  },
  'fluxo-caixa': {
    id: 'fluxo-caixa',
    titulo: 'Fluxo de Caixa Projetado',
    tabela: 'cobrancas',
    select: 'data_vencimento, valor_final, status',
    cabecalhos: ['Período', 'Entradas', 'Saídas', 'Saldo'],
    descricao: 'Projeção de entradas e saídas',
  },
  'conciliacao-bancaria': {
    id: 'conciliacao-bancaria',
    titulo: 'Conciliação Bancária',
    tabela: 'lancamentos_caixa',
    select: 'id, data, descricao, valor, tipo',
    cabecalhos: ['Data', 'Descrição', 'Valor', 'Tipo'],
    orderBy: 'data',
    descricao: 'Confronto bancário',
  },
  'custos-centro': {
    id: 'custos-centro',
    titulo: 'Custos por Centro',
    tabela: 'lancamentos_caixa',
    select: 'centro_custo, SUM(valor)',
    cabecalhos: ['Centro de Custo', 'Total', '%'],
    descricao: 'Despesas por centro de custo',
  },
  
  // OPERACIONAL
  'instalacoes-regiao': {
    id: 'instalacoes-regiao',
    titulo: 'Instalações por Região',
    tabela: 'instalacoes',
    select: 'endereco_cidade, endereco_uf, status',
    cabecalhos: ['Cidade', 'UF', 'Quantidade', '%'],
    descricao: 'Distribuição geográfica das instalações',
  },
  'tempo-instalacao': {
    id: 'tempo-instalacao',
    titulo: 'Tempo Médio de Instalação',
    tabela: 'instalacoes',
    select: 'id, agendada_para, concluida_em, status',
    filtros: { status: 'concluida' },
    cabecalhos: ['Período', 'Tempo Médio', 'Qtd'],
    descricao: 'Eficiência operacional',
  },
  'produtividade-instalador': {
    id: 'produtividade-instalador',
    titulo: 'Produtividade por Instalador',
    tabela: 'instalacoes',
    select: 'instalador_responsavel_id, status, concluida_em',
    cabecalhos: ['Instalador', 'Concluídas', 'Pendentes', 'Média/Dia'],
    descricao: 'Performance da equipe técnica',
  },
  'estoque-rastreadores': {
    id: 'estoque-rastreadores',
    titulo: 'Estoque de Rastreadores',
    tabela: 'rastreadores',
    select: 'status, modelo, codigo',
    cabecalhos: ['Status', 'Modelo', 'Quantidade'],
    descricao: 'Posição atual de estoque',
  },
  'chamados-tipo': {
    id: 'chamados-tipo',
    titulo: 'Chamados por Tipo',
    tabela: 'chamados_assistencia',
    select: 'tipo_servico, status, data_abertura',
    cabecalhos: ['Tipo', 'Abertos', 'Concluídos', 'Em Andamento'],
    descricao: 'Assistência 24h por categoria',
  },
  
  // ASSOCIADOS
  'crescimento-base': {
    id: 'crescimento-base',
    titulo: 'Crescimento da Base',
    tabela: 'associados',
    select: 'id, created_at, status',
    cabecalhos: ['Mês', 'Novos', 'Cancelados', 'Saldo'],
    descricao: 'Evolução mensal de associados',
  },
  'churn-rate': {
    id: 'churn-rate',
    titulo: 'Churn Rate',
    tabela: 'associados',
    select: 'id, updated_at, status',
    filtros: { status: 'cancelado' },
    cabecalhos: ['Mês', 'Cancelamentos', 'Base Inicial', 'Taxa'],
    descricao: 'Taxa de cancelamento mensal',
  },
  'ltv-segmento': {
    id: 'ltv-segmento',
    titulo: 'LTV por Segmento',
    tabela: 'associados',
    select: 'id, plano_id, created_at, status',
    cabecalhos: ['Segmento', 'Associados', 'Ticket Médio', 'LTV'],
    descricao: 'Lifetime value por perfil',
  },
  'associados-regiao': {
    id: 'associados-regiao',
    titulo: 'Associados por Região',
    tabela: 'associados',
    select: 'cidade, uf, status',
    cabecalhos: ['Cidade', 'UF', 'Ativos', '%'],
    descricao: 'Distribuição geográfica',
  },
  'veiculos-marca': {
    id: 'veiculos-marca',
    titulo: 'Veículos por Marca/Modelo',
    tabela: 'veiculos',
    select: 'marca, modelo',
    cabecalhos: ['Marca', 'Modelo', 'Quantidade', '%'],
    descricao: 'Perfil da frota protegida',
  },
  
  // SINISTROS
  'tempo-regulacao': {
    id: 'tempo-regulacao',
    titulo: 'Tempo Médio de Regulação',
    tabela: 'sinistros',
    select: 'id, protocolo, data_ocorrencia, data_resolucao, status',
    cabecalhos: ['Protocolo', 'Abertura', 'Resolução', 'Dias'],
    descricao: 'SLA de atendimento',
  },
  'valores-pagos': {
    id: 'valores-pagos',
    titulo: 'Valores Pagos vs Provisões',
    tabela: 'sinistros',
    select: 'tipo, valor_indenizacao, status',
    cabecalhos: ['Tipo', 'Provisão', 'Pago', 'Diferença'],
    descricao: 'Análise de provisões',
  },
  'top-sinistros': {
    id: 'top-sinistros',
    titulo: 'Top 10 Sinistros',
    tabela: 'sinistros',
    select: 'id, protocolo, tipo, valor_indenizacao, associado:associados(nome)',
    orderBy: 'valor_indenizacao',
    cabecalhos: ['Protocolo', 'Tipo', 'Valor', 'Associado'],
    descricao: 'Maiores ocorrências por valor',
  },
  
  // GERENCIAL
  'analise-tendencias': {
    id: 'analise-tendencias',
    titulo: 'Análise de Tendências',
    tabela: 'indicadores_atuariais',
    select: '*',
    cabecalhos: ['Mês', 'Receita', 'Sinistros', 'Tendência'],
    descricao: 'Projeções e tendências',
  },
};

export function getRelatorioConfig(id: string): RelatorioQueryConfig | null {
  return relatoriosQueryConfig[id] || null;
}

export function getRotaExistente(id: string): string | null {
  return rotasExistentes[id] || null;
}
