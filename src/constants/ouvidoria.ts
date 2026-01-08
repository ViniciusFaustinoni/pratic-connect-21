import {
  Headphones,
  Users,
  DollarSign,
  Car,
  Truck,
  MapPin,
  Wrench,
  FileText,
  Scale,
  Building,
  MoreHorizontal,
  LucideIcon,
} from "lucide-react";

export interface SetorElogioConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  desc: string;
}

export const setoresElogio: SetorElogioConfig[] = [
  { id: 'atendimento', icon: Headphones, label: 'Atendimento ao Associado', desc: 'Central de atendimento, SAC, suporte' },
  { id: 'comercial', icon: Users, label: 'Comercial / Vendas', desc: 'Vendedores, consultores, equipe comercial' },
  { id: 'financeiro', icon: DollarSign, label: 'Financeiro', desc: 'Cobranças, boletos, pagamentos' },
  { id: 'sinistros', icon: Car, label: 'Sinistros', desc: 'Regulação, análise de sinistros' },
  { id: 'assistencia', icon: Truck, label: 'Assistência 24h', desc: 'Guincho, chaveiro, socorro' },
  { id: 'monitoramento', icon: MapPin, label: 'Monitoramento', desc: 'Rastreamento, central de monitoramento' },
  { id: 'instalacao', icon: Wrench, label: 'Instalação', desc: 'Instaladores, vistoriadores' },
  { id: 'cadastro', icon: FileText, label: 'Cadastro', desc: 'Análise de documentos, aprovações' },
  { id: 'juridico', icon: Scale, label: 'Jurídico', desc: 'Departamento jurídico' },
  { id: 'diretoria', icon: Building, label: 'Diretoria', desc: 'Gestão, direção da empresa' },
  { id: 'outro', icon: MoreHorizontal, label: 'Outro Setor', desc: 'Especificar no campo de descrição' },
];
