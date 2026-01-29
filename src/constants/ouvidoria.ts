import {
  Truck,
  FileText,
  Receipt,
  UserCheck,
  Calculator,
  AlertCircle,
  DollarSign,
  Scale,
  Megaphone,
  MapPin,
  Wrench,
  Heart,
  LucideIcon,
  Phone,
  Building2,
  Mail,
  MessageCircle,
  Share2,
  HelpCircle,
  Smartphone,
} from "lucide-react";

export interface SetorElogioConfig {
  value: string;
  label: string;
  icon: LucideIcon;
}

// Setores disponíveis para elogio (ordem alfabética)
export const setoresElogio: SetorElogioConfig[] = [
  { value: 'assistencia_24h', label: 'Assistência 24h', icon: Truck },
  { value: 'cadastro', label: 'Cadastro', icon: FileText },
  { value: 'cobranca', label: 'Cobrança', icon: Receipt },
  { value: 'consultor', label: 'Consultor(a)', icon: UserCheck },
  { value: 'contabilidade', label: 'Contabilidade', icon: Calculator },
  { value: 'eventos', label: 'Eventos', icon: AlertCircle },
  { value: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { value: 'juridico', label: 'Jurídico', icon: Scale },
  { value: 'marketing', label: 'Marketing', icon: Megaphone },
  { value: 'monitoramento', label: 'Monitoramento', icon: MapPin },
  { value: 'oficina', label: 'Oficina', icon: Wrench },
  { value: 'relacionamento', label: 'Relacionamento', icon: Heart },
];

export type SetorElogioValue = typeof setoresElogio[number]['value'];

// Canais de origem para cadastro manual
export interface CanalOrigemConfig {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const canaisOrigem: CanalOrigemConfig[] = [
  { value: 'telefone', label: 'Telefone', icon: Phone },
  { value: 'presencial', label: 'Presencial', icon: Building2 },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'whatsapp_manual', label: 'WhatsApp (manual)', icon: MessageCircle },
  { value: 'carta', label: 'Carta', icon: FileText },
  { value: 'redes_sociais', label: 'Redes Sociais', icon: Share2 },
  { value: 'outro', label: 'Outro', icon: HelpCircle },
];

// Ícones de canal para exibição na lista
export const canalIcons: Record<string, { icon: LucideIcon; label: string }> = {
  app: { icon: Smartphone, label: 'App' },
  telefone: { icon: Phone, label: 'Tel' },
  presencial: { icon: Building2, label: 'Pres' },
  email: { icon: Mail, label: 'Email' },
  whatsapp: { icon: MessageCircle, label: 'WA' },
  whatsapp_manual: { icon: MessageCircle, label: 'WA' },
  carta: { icon: FileText, label: 'Carta' },
  redes_sociais: { icon: Share2, label: 'Social' },
  outro: { icon: HelpCircle, label: 'Outro' },
};

// Categorias de manifestação
export const categoriasManifestacao = [
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'financeiro', label: 'Financeiro / Cobranças' },
  { value: 'sinistro', label: 'Sinistros' },
  { value: 'assistencia', label: 'Assistência 24h' },
  { value: 'rastreamento', label: 'Rastreamento' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'instalacao', label: 'Instalação' },
  { value: 'app', label: 'Aplicativo' },
  { value: 'outro', label: 'Outro' },
];

// Tipos de manifestação
export const tiposManifestacao = [
  { value: 'reclamacao', label: 'Reclamação' },
  { value: 'reclamacao_urgente', label: 'Reclamação Urgente' },
  { value: 'denuncia', label: 'Denúncia' },
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'elogio', label: 'Elogio' },
  { value: 'solicitacao', label: 'Solicitação' },
];

// Categorias de solicitação
export const categoriasSolicitacao = [
  { value: 'documentos', label: 'Documentos' },
  { value: 'informacoes', label: 'Informações' },
  { value: 'providencias', label: 'Providências' },
  { value: 'acesso', label: 'Acesso' },
];

// Opções de procedência para encerramento
export const procedenciaOptions = [
  { value: 'procedente', label: 'Sim, Procedente' },
  { value: 'parcial', label: 'Parcialmente Procedente' },
  { value: 'improcedente', label: 'Não, Improcedente' },
];

// Prioridades
export const prioridades = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

// Mock de analistas para atribuição
export const analistasOuvidoria = [
  { id: 'eu', nome: 'Eu mesmo' },
  { id: '1', nome: 'Ana Paula' },
  { id: '2', nome: 'Carlos Lima' },
  { id: '3', nome: 'Maria Oliveira' },
];

// Mock de associados para busca
export const mockAssociados = [
  { id: '1', nome: 'João Silva', cpf: '123.456.789-12', telefone: '(11) 99999-1234', email: 'joao@email.com', codigo: 'A001' },
  { id: '2', nome: 'Maria Santos', cpf: '987.654.321-00', telefone: '(21) 98888-5678', email: 'maria@email.com', codigo: 'A002' },
  { id: '3', nome: 'Pedro Costa', cpf: '456.789.123-45', telefone: '(31) 97777-4321', email: 'pedro@email.com', codigo: 'A003' },
  { id: '4', nome: 'Lucia Ferreira', cpf: '321.654.987-67', telefone: '(41) 96666-8765', email: 'lucia@email.com', codigo: 'A004' },
  { id: '5', nome: 'Roberto Almeida', cpf: '789.123.456-89', telefone: '(51) 95555-2109', email: 'roberto@email.com', codigo: 'A005' },
];
