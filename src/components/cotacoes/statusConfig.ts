import { FileText, Send, Check, X, Eye } from 'lucide-react';
import type { StatusCotacaoExtended } from '@/types/database';

export type { StatusCotacaoExtended };

/**
 * Fonte única do mapa visual de status de cotação (label/cores/ícone).
 * Consumido por CotacoesTable, CotacaoCard e CotacoesMobileList.
 */
export const statusConfig: Record<StatusCotacaoExtended, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof FileText;
}> = {
  rascunho: {
    label: 'Rascunho',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/15',
    borderColor: 'border-l-yellow-500',
    icon: FileText,
  },
  enviada: {
    label: 'Enviada',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-l-blue-500',
    icon: Send,
  },
  visualizada: {
    label: 'Visualizada',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    borderColor: 'border-l-cyan-500',
    icon: Eye,
  },
  aceita: {
    label: 'Aceita',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/15',
    borderColor: 'border-l-green-500',
    icon: Check,
  },
  recusada: {
    label: 'Recusada',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-l-red-500',
    icon: X,
  },
  expirada: {
    label: 'Expirada',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-l-muted-foreground/50',
    icon: FileText,
  },
};
