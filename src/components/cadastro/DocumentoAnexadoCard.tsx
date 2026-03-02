import { 
  FileText, Eye, CheckCircle, Shield, Clock, XCircle,
  CreditCard, Car, Home, Camera, FileSignature, Image, AlertCircle, Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { DocumentoAnexadoCompleto, TipoDocumentoAnexo } from '@/types/documentos';
import type { StatusDocumento } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DocumentoAnexadoCardProps {
  documento: DocumentoAnexadoCompleto;
  onView: (documento: DocumentoAnexadoCompleto) => void;
  onAprovar?: (docId: string) => Promise<void>;
  onReprovar?: (docId: string, motivo: string) => Promise<void>;
}

// Mapeamento de ícones por tipo
const tipoIcones: Record<TipoDocumentoAnexo, React.ReactNode> = {
  cnh: <CreditCard className="h-4 w-4" />,
  crlv: <Car className="h-4 w-4" />,
  comprovante_residencia: <Home className="h-4 w-4" />,
  selfie_documento: <Camera className="h-4 w-4" />,
  contrato_assinado: <FileSignature className="h-4 w-4" />,
  laudo_vistoria: <FileText className="h-4 w-4" />,
  foto_veiculo_frente: <Image className="h-4 w-4" />,
  foto_veiculo_traseira: <Image className="h-4 w-4" />,
  foto_veiculo_lateral_esquerda: <Image className="h-4 w-4" />,
  foto_veiculo_lateral_direita: <Image className="h-4 w-4" />,
  foto_hodometro: <Car className="h-4 w-4" />,
  foto_chassi: <Car className="h-4 w-4" />,
  outro: <FileText className="h-4 w-4" />,
};

// Labels para tipos
const tipoLabels: Record<TipoDocumentoAnexo, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comprovante_residencia: 'Comprovante de Residência',
  selfie_documento: 'Selfie com Documento',
  contrato_assinado: 'Contrato Assinado',
  laudo_vistoria: 'Laudo de Vistoria',
  foto_veiculo_frente: 'Foto Frente',
  foto_veiculo_traseira: 'Foto Traseira',
  foto_veiculo_lateral_esquerda: 'Foto Lateral Esq.',
  foto_veiculo_lateral_direita: 'Foto Lateral Dir.',
  foto_hodometro: 'Hodômetro',
  foto_chassi: 'Chassi',
  outro: 'Outro',
};

// Cores do badge por status
const statusConfig: Record<StatusDocumento, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  pendente: { 
    bg: 'bg-warning/20', 
    text: 'text-warning',
    icon: <Clock className="h-3 w-3" />,
    label: 'Pendente'
  },
  em_analise: { 
    bg: 'bg-info/20', 
    text: 'text-info',
    icon: <AlertCircle className="h-3 w-3" />,
    label: 'Em Análise'
  },
  aprovado: { 
    bg: 'bg-success/20', 
    text: 'text-success',
    icon: <CheckCircle className="h-3 w-3" />,
    label: 'Aprovado'
  },
  reprovado: { 
    bg: 'bg-destructive/20', 
    text: 'text-destructive',
    icon: <XCircle className="h-3 w-3" />,
    label: 'Reprovado'
  },
  expirado: { 
    bg: 'bg-muted', 
    text: 'text-muted-foreground',
    icon: <Clock className="h-3 w-3" />,
    label: 'Expirado'
  },
};

function formatDateTime(dateString: string): string {
  return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function DocumentoAnexadoCard({ documento, onView, onAprovar, onReprovar }: DocumentoAnexadoCardProps) {
  const isContrato = documento.tipo === 'contrato_assinado';
  const status = statusConfig[documento.status] || statusConfig.pendente;
  const podeAnalisar = (documento.status === 'pendente' || documento.status === 'em_analise') && (onAprovar || onReprovar);

  const [loadingAction, setLoadingAction] = useState<'aprovar' | 'reprovar' | null>(null);

  const handleAprovar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAprovar) return;
    setLoadingAction('aprovar');
    try {
      await onAprovar(documento.id);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReprovar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onReprovar) return;
    setLoadingAction('reprovar');
    try {
      await onReprovar(documento.id, 'Documento reprovado pelo analista');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      onClick={() => onView(documento)}
      className={cn(
        'p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md group',
        isContrato && documento.status === 'aprovado' && 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30',
        isContrato && documento.status !== 'aprovado' && 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10',
        !isContrato && 'border-border bg-card hover:bg-muted/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Ícone do tipo */}
        <div className={cn(
          'p-2.5 rounded-lg shrink-0',
          isContrato ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
        )}>
          {tipoIcones[documento.tipo] || <FileText className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Tipo e status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'font-medium text-sm',
              isContrato ? 'text-emerald-800 dark:text-emerald-300' : 'text-foreground'
            )}>
              {tipoLabels[documento.tipo] || documento.tipo}
            </span>
            
            <Badge className={cn('text-xs', status.bg, status.text, 'border-0')}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
          </div>

          {/* Data de envio */}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDateTime(documento.created_at)}
          </p>

          {/* Info adicional para Contrato Assinado */}
          {isContrato && documento.assinado_em && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Assinado em {formatDateTime(documento.assinado_em)}
              </p>
              
              {documento.validado_autentique && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-xs border-0">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Validado Autentique
                </Badge>
              )}
            </div>
          )}

          {/* Botões de ação rápida para documentos pendentes */}
          {podeAnalisar && (
            <div className="flex items-center gap-2 mt-2">
              {onAprovar && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-success/30 text-success hover:bg-success/10"
                  onClick={handleAprovar}
                  disabled={!!loadingAction}
                >
                  {loadingAction === 'aprovar' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                  Aprovar
                </Button>
              )}
              {onReprovar && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={handleReprovar}
                  disabled={!!loadingAction}
                >
                  {loadingAction === 'reprovar' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  Reprovar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Botão de visualização */}
        <Button
          variant="ghost"
          size="sm"
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onView(documento);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
