// =============================================
// TIPOS DO MÓDULO DE DOCUMENTOS
// =============================================

/**
 * Categoria de documentos (Contratos, Termos, Declarações, etc.)
 */
export interface DocumentoCategoria {
  id: string;
  nome: string;
  descricao?: string;
  icone: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Configurações de layout do PDF
 */
export interface ConfiguracaoLayout {
  margemTopo: number;
  margemBaixo: number;
  margemEsquerda: number;
  margemDireita: number;
  tamanhoFonte: number;
  fontePrincipal: 'Helvetica' | 'Times' | 'Courier';
  mostrarCabecalho: boolean;
  mostrarRodape: boolean;
  mostrarNumeroPagina: boolean;
  orientacao: 'retrato' | 'paisagem';
}

/**
 * Variável usada dentro de um template
 */
export interface VariavelTemplate {
  codigo: string;
  nome: string;
  obrigatoria: boolean;
  valorPadrao?: string;
}

/**
 * Template de documento com conteúdo e configurações
 */
export interface DocumentoTemplate {
  id: string;
  categoria_id: string;
  nome: string;
  codigo: string;
  descricao?: string;
  versao: number;
  conteudo: string; // HTML/texto com {{variaveis}}
  variaveis: VariavelTemplate[];
  config_layout: ConfiguracaoLayout;
  cabecalho_html?: string;
  rodape_html?: string;
  ativo: boolean;
  requer_assinatura: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Relacionamento
  categoria?: DocumentoCategoria;
}

/**
 * Variável de referência disponível no sistema
 */
export interface DocumentoVariavel {
  id: string;
  codigo: string;
  nome_exibicao: string;
  grupo: 'associado' | 'veiculo' | 'contrato' | 'sistema' | 'empresa';
  tipo: 'texto' | 'data' | 'moeda' | 'numero';
  origem_tabela?: string;
  origem_campo?: string;
  formato?: string;
  exemplo?: string;
}

/**
 * Documento gerado (histórico)
 */
export interface DocumentoGerado {
  id: string;
  template_id: string;
  associado_id: string;
  numero_documento?: string;
  dados_utilizados: Record<string, any>;
  arquivo_url?: string;
  arquivo_nome?: string;
  gerado_por?: string;
  gerado_em: string;
  assinado: boolean;
  assinado_em?: string;
  assinatura_ip?: string;
  autentique_id?: string;
  // Relacionamentos
  template?: DocumentoTemplate;
  associado?: {
    id: string;
    nome: string;
    cpf: string;
  };
}

// =============================================
// TIPOS AUXILIARES
// =============================================

/**
 * Estrutura de dados para substituição de variáveis (merge)
 */
export interface DadosMerge {
  associado: Record<string, any>;
  veiculo: Record<string, any>;
  contrato: Record<string, any>;
  sistema: Record<string, any>;
  empresa: Record<string, any>;
  [key: string]: Record<string, any>;
}

/**
 * Opções para geração de PDF
 */
export interface OpcaoGeracaoPDF {
  modo: 'baixar' | 'abrir' | 'bytes' | 'salvar';
  nomeArquivo?: string;
  salvarHistorico?: boolean;
}

/**
 * Configuração padrão de layout
 */
export const CONFIG_LAYOUT_PADRAO: ConfiguracaoLayout = {
  margemTopo: 50,
  margemBaixo: 50,
  margemEsquerda: 50,
  margemDireita: 50,
  tamanhoFonte: 12,
  fontePrincipal: 'Helvetica',
  mostrarCabecalho: true,
  mostrarRodape: true,
  mostrarNumeroPagina: true,
  orientacao: 'retrato',
};

/**
 * Grupos de variáveis disponíveis
 */
export const GRUPOS_VARIAVEIS = [
  { id: 'associado', nome: 'Associado', icone: 'User' },
  { id: 'veiculo', nome: 'Veículo', icone: 'Car' },
  { id: 'contrato', nome: 'Contrato', icone: 'FileText' },
  { id: 'sistema', nome: 'Sistema', icone: 'Settings' },
  { id: 'empresa', nome: 'Empresa', icone: 'Building' },
] as const;

/**
 * Cores disponíveis para categorias
 */
export const CORES_CATEGORIAS = [
  { id: 'blue', nome: 'Azul', classe: 'bg-blue-500' },
  { id: 'green', nome: 'Verde', classe: 'bg-green-500' },
  { id: 'purple', nome: 'Roxo', classe: 'bg-purple-500' },
  { id: 'orange', nome: 'Laranja', classe: 'bg-orange-500' },
  { id: 'red', nome: 'Vermelho', classe: 'bg-red-500' },
  { id: 'yellow', nome: 'Amarelo', classe: 'bg-yellow-500' },
  { id: 'pink', nome: 'Rosa', classe: 'bg-pink-500' },
  { id: 'teal', nome: 'Verde-água', classe: 'bg-teal-500' },
] as const;
