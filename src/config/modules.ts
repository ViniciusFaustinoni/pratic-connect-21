/**
 * Configuração centralizada de módulos do sistema.
 * Fonte única para MODULE_LABELS, MODULE_ITEMS e lista de módulos.
 * Usado por Perfis.tsx, UsuarioForm.tsx, useModuleVisibility.ts, etc.
 */

export interface ModuleConfig {
  id: string;
  label: string;
}

export interface ModuleItem {
  id: string;
  label: string;
}

/** 18 módulos do sistema (correspondem aos grupos do sidebar) */
export const MODULES: ModuleConfig[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'monitoramento', label: 'Monitoramento' },
  { id: 'eventos', label: 'Eventos/Sinistros' },
  { id: 'assistencia', label: 'Assistência 24h' },
  { id: 'oficinas', label: 'Oficinas' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'cobranca', label: 'Relacionamento' },
  { id: 'contabilidade', label: 'Contabilidade' },
  { id: 'juridico', label: 'Jurídico' },
  { id: 'rh', label: 'Recursos Humanos' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'ouvidoria', label: 'Ouvidoria' },
  { id: 'diretoria', label: 'Diretoria' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'configuracoes', label: 'Configurações' },
];

/** Mapa id → label (substituto de MODULE_LABELS) */
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  MODULES.map(m => [m.id, m.label])
);

/** Sub-itens de cada módulo */
export const MODULE_ITEMS: Record<string, ModuleItem[]> = {
  vendas: [
    { id: 'leads', label: 'Leads' },
    { id: 'cotacoes', label: 'Cotação' },
    { id: 'propostas', label: 'Propostas' },
    { id: 'ativacoes', label: 'Ativações' },
    { id: 'consultores', label: 'Consultores' },
    { id: 'planos', label: 'Planos e Benefícios' },
  ],
  cadastro: [
    { id: 'propostas_pendentes', label: 'Propostas Pendentes' },
    { id: 'associados', label: 'Associados' },
    { id: 'veiculos', label: 'Veículos' },
    { id: 'substituicoes', label: 'Substituições' },
  ],
  monitoramento: [
    { id: 'equipe', label: 'Equipe' },
    { id: 'instalacoes', label: 'Instalações' },
    { id: 'vistorias', label: 'Vistorias' },
    { id: 'retiradas', label: 'Retiradas' },
    { id: 'calendario', label: 'Calendário' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'rastreadores', label: 'Rastreadores' },
    { id: 'mapa', label: 'Mapa' },
    { id: 'alertas', label: 'Alertas' },
  ],
  eventos: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sinistros', label: 'Sinistros' },
    { id: 'pre_analise', label: 'Pré-Análise' },
    { id: 'sla', label: 'SLA' },
    { id: 'sindicancias', label: 'Sindicâncias' },
    { id: 'sindicantes', label: 'Sindicantes' },
    { id: 'solicitacoes_ia', label: 'Solicitações IA' },
  ],
  assistencia: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'chamados', label: 'Fila de Chamados' },
    { id: 'prestadores', label: 'Prestadores' },
  ],
  oficinas: [
    { id: 'oficinas', label: 'Oficinas' },
    { id: 'auto_centers', label: 'Auto Centers' },
    { id: 'ordens_servico', label: 'Ordens de Serviço' },
    { id: 'relatorios', label: 'Relatórios' },
  ],
  financeiro: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'cobrancas', label: 'Cobranças' },
    { id: 'contas_pagar', label: 'Contas a Pagar' },
    { id: 'faturamento', label: 'Faturamento' },
    { id: 'extrato', label: 'Extrato' },
    { id: 'extratos_bancarios', label: 'Extratos Bancários' },
    { id: 'contas_bancarias', label: 'Contas Bancárias' },
  ],
  cobranca: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inadimplentes', label: 'Inadimplentes' },
    { id: 'fila', label: 'Fila de Trabalho' },
    { id: 'acordos', label: 'Acordos' },
    { id: 'negativacao', label: 'Negativação' },
    { id: 'regua', label: 'Régua' },
  ],
  contabilidade: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'plano_contas', label: 'Plano de Contas' },
    { id: 'lancamentos', label: 'Lançamentos' },
    { id: 'balancete', label: 'Balancete' },
    { id: 'balanco_patrimonial', label: 'Balanço Patrimonial' },
    { id: 'dre', label: 'DRE' },
    { id: 'fechamento', label: 'Fechamento' },
  ],
  juridico: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'casos', label: 'Casos' },
    { id: 'processos', label: 'Processos' },
    { id: 'advogados', label: 'Advogados' },
    { id: 'prazos', label: 'Prazos' },
    { id: 'audiencias', label: 'Audiências' },
    { id: 'consultas', label: 'Consultas 360' },
    { id: 'pareceres', label: 'Pareceres' },
  ],
  rh: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'funcionarios', label: 'Funcionários' },
    { id: 'jornadas', label: 'Jornadas' },
    { id: 'folha_pagamento', label: 'Folha de Pagamento' },
    { id: 'ponto', label: 'Ponto' },
    { id: 'ferias', label: 'Férias' },
    { id: 'organograma', label: 'Organograma' },
    { id: 'departamentos', label: 'Departamentos' },
    { id: 'beneficios', label: 'Benefícios' },
  ],
  marketing: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'campanhas', label: 'Campanhas' },
    { id: 'canais', label: 'Canais' },
    { id: 'indicacoes', label: 'Indicações' },
    { id: 'utms', label: 'UTMs' },
    { id: 'distribuicao', label: 'Distribuição' },
    { id: 'relatorios', label: 'Relatórios' },
  ],
  ouvidoria: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'fila', label: 'Fila' },
  ],
  diretoria: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'produtos', label: 'Produtos' },
    { id: 'planos_beneficios', label: 'Planos/Benefícios' },
    { id: 'precos', label: 'Tabela de Preços' },
    { id: 'rateio', label: 'Rateio' },
    { id: 'atuarial', label: 'Atuarial' },
    { id: 'blacklist', label: 'Blacklist' },
    { id: 'configuracoes', label: 'Configurações' },
    { id: 'perfis', label: 'Perfis' },
    { id: 'logs', label: 'Logs' },
    { id: 'relatorios', label: 'Relatórios' },
  ],
  documentos: [
    { id: 'gerar', label: 'Gerar Documento' },
    { id: 'historico', label: 'Histórico' },
    { id: 'templates', label: 'Templates' },
    { id: 'aditivos', label: 'Aditivos' },
  ],
};
