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
