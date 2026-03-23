// =============================================
// TIPOS DO EDITOR VISUAL (FABRIC.JS)
// =============================================

import type { Object as FabricObject } from 'fabric';

/**
 * Status de um template
 */
export type TemplateStatus = 'draft' | 'active' | 'archived';

/**
 * Tipo de documento do sistema (fixo)
 */
export interface DocumentType {
  id: string;
  code: string;
  name: string;
  description?: string;
  send_moment?: string;
  target_audience?: string;
  required_variables: string[];
  icon: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Dados customizados em objetos do Fabric.js
 */
export interface CustomFabricData {
  variableName?: string;
  elementType?: 'text' | 'shape' | 'image' | 'table' | 'variable';
  isVariable?: boolean;
  variableGroup?: string;
}

/**
 * Objeto do canvas com dados customizados
 */
export interface CanvasFabricObject {
  type: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  flipX?: boolean;
  flipY?: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: string;
  lineHeight?: number;
  underline?: boolean;
  src?: string;
  customData?: CustomFabricData;
  [key: string]: unknown;
}

/**
 * Estrutura completa do canvas salvo
 */
export interface CanvasData {
  version: string;
  objects: CanvasFabricObject[];
  background?: string;
  backgroundImage?: CanvasFabricObject;
  width: number;
  height: number;
}

/**
 * Configuração padrão do canvas A4
 */
export const CANVAS_A4_CONFIG = {
  // Tamanho A4 em pixels (72 DPI para web)
  width: 595,
  height: 842,
  
  // Margens seguras (em pixels)
  margins: {
    top: 40,
    right: 40,
    bottom: 40,
    left: 40,
  },
  
  // Background padrão
  backgroundColor: '#ffffff',
  
  // Grid
  gridSize: 10,
  showGrid: false,
  snapToGrid: true,
} as const;

/**
 * Zoom levels disponíveis
 */
export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Categoria de elemento do editor
 */
export interface EditorElementCategory {
  id: string;
  name: string;
  icon: string;
  items: EditorElementItem[];
}

/**
 * Item de elemento arrastrável
 */
export interface EditorElementItem {
  id: string;
  label: string;
  icon?: string;
  defaultStyle?: Partial<CanvasFabricObject>;
  isVariable?: boolean;
  variableName?: string;
}

/**
 * Elementos disponíveis no editor
 */
export const EDITOR_ELEMENTS: EditorElementCategory[] = [
  {
    id: 'text',
    name: 'Texto',
    icon: 'type',
    items: [
      { id: 'title', label: 'Título', defaultStyle: { fontSize: 28, fontWeight: 'bold' } },
      { id: 'subtitle', label: 'Subtítulo', defaultStyle: { fontSize: 20, fontWeight: '500' } },
      { id: 'paragraph', label: 'Parágrafo', defaultStyle: { fontSize: 12 } },
      { id: 'caption', label: 'Legenda', defaultStyle: { fontSize: 10, opacity: 0.7 } },
    ],
  },
  {
    id: 'shapes',
    name: 'Formas',
    icon: 'shapes',
    items: [
      { id: 'rectangle', label: 'Retângulo', icon: 'square' },
      { id: 'circle', label: 'Círculo', icon: 'circle' },
      { id: 'line', label: 'Linha', icon: 'minus' },
      { id: 'divider', label: 'Divisor', icon: 'grip-horizontal' },
    ],
  },
  {
    id: 'media',
    name: 'Mídia',
    icon: 'image',
    items: [
      { id: 'image', label: 'Imagem', icon: 'image' },
      { id: 'logo', label: 'Logo da Empresa', icon: 'building-2' },
    ],
  },
  {
    id: 'tables',
    name: 'Tabelas',
    icon: 'table',
    items: [
      { id: 'table', label: 'Tabela Simples', icon: 'table' },
      { id: 'comparison', label: 'Tabela Comparativa', icon: 'columns-3' },
    ],
  },
];

/**
 * Grupos de variáveis do sistema
 */
export const VARIABLE_GROUPS = [
  {
    id: 'cliente',
    name: 'Dados do Cliente',
    icon: 'user',
    variables: [
      { name: 'nome_cliente', label: 'Nome do Cliente', example: 'João da Silva' },
      { name: 'cpf', label: 'CPF', example: '123.456.789-00' },
      { name: 'rg', label: 'RG', example: '12.345.678-9' },
      { name: 'email', label: 'Email', example: 'joao@email.com' },
      { name: 'telefone', label: 'Telefone', example: '(11) 99999-9999' },
      { name: 'endereco', label: 'Endereço Completo', example: 'Rua das Flores, 123 - São Paulo/SP' },
    ],
  },
  {
    id: 'veiculo',
    name: 'Dados do Veículo',
    icon: 'car',
    variables: [
      { name: 'veiculo', label: 'Veículo (Marca/Modelo)', example: 'Honda Civic 2020' },
      { name: 'placa', label: 'Placa', example: 'ABC-1234' },
      { name: 'ano', label: 'Ano', example: '2020' },
      { name: 'cor', label: 'Cor', example: 'Prata' },
      { name: 'chassi', label: 'Chassi', example: '9BWZZZ377VT004251' },
      { name: 'renavam', label: 'Renavam', example: '12345678901' },
    ],
  },
  {
    id: 'plano',
    name: 'Dados do Plano',
    icon: 'shield',
    variables: [
      { name: 'plano', label: 'Nome do Plano', example: 'Proteção 360º' },
      { name: 'valor_mensalidade', label: 'Valor da Mensalidade', example: 'R$ 189,90' },
      { name: 'valor_adesao', label: 'Taxa de Adesão', example: 'R$ 150,00' },
      { name: 'coberturas', label: 'Lista de Coberturas', example: 'Roubo/Furto, Colisão, Terceiros' },
    ],
  },
  {
    id: 'datas',
    name: 'Datas',
    icon: 'calendar',
    variables: [
      { name: 'data_atual', label: 'Data Atual', example: '31/01/2026' },
      { name: 'data_adesao', label: 'Data de Adesão', example: '15/01/2026' },
      { name: 'data_vencimento', label: 'Data de Vencimento', example: '10/02/2026' },
    ],
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    icon: 'dollar-sign',
    variables: [
      { name: 'valor', label: 'Valor', example: 'R$ 189,90' },
      { name: 'valor_extenso', label: 'Valor por Extenso', example: 'cento e oitenta e nove reais e noventa centavos' },
      { name: 'dias_atraso', label: 'Dias em Atraso', example: '15' },
      { name: 'referencia', label: 'Referência', example: 'Janeiro/2026' },
    ],
  },
  {
    id: 'sistema',
    name: 'Sistema',
    icon: 'settings',
    variables: [
      { name: 'numero_contrato', label: 'Número do Contrato', example: 'CTR-2026-0001' },
      { name: 'numero_proposta', label: 'Número da Proposta', example: 'PROP-2026-0001' },
      { name: 'nome_empresa', label: 'Nome da Empresa', example: 'PRATIC Proteção Veicular' },
    ],
  },
] as const;

/**
 * Todas as variáveis em formato flat
 */
export const ALL_VARIABLES = VARIABLE_GROUPS.flatMap((group) =>
  group.variables.map((v) => ({
    ...v,
    group: group.id,
    groupName: group.name,
    code: `{{${v.name}}}`,
  }))
);

/**
 * Estado do editor
 */
export interface EditorState {
  zoom: number;
  selectedObjectIds: string[];
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
}

/**
 * Ações do editor
 */
export type EditorAction =
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SELECT_OBJECTS'; payload: string[] }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'UPDATE_HISTORY'; payload: { canUndo: boolean; canRedo: boolean } };

/**
 * Props do componente CanvasEditor
 */
export interface CanvasEditorProps {
  initialData?: CanvasData;
  onSave?: (data: CanvasData) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  readOnly?: boolean;
}

/**
 * Versão de um template (para histórico)
 */
export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  canvas_data?: CanvasData;
  conteudo?: string;
  config_layout?: Record<string, unknown>;
  change_description?: string;
  created_by?: string;
  created_at: string;
}

/**
 * Regras de proteção para tipos de documento
 */
export const DOCTYPE_RULES = {
  canDelete: false,
  canDeactivate: true,
  mustHaveDefault: true,
} as const;

/**
 * Regras de proteção para templates
 */
export const TEMPLATE_RULES = {
  deleteDefault: false,
  archiveWithDocs: true,
  softDelete: true,
} as const;

/**
 * Badges de status do template
 */
export const STATUS_BADGES: Record<TemplateStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  active: { label: 'Ativo', variant: 'default' },
  archived: { label: 'Arquivado', variant: 'destructive' },
};
