import { Loader2, CheckCircle2, XCircle, Car, FileText } from 'lucide-react';
import type { ProcessingStatus } from '@/hooks/useNewLeadFlow';

interface ProcessingStepProps {
  status: ProcessingStatus;
}

export function ProcessingStep({ status }: ProcessingStepProps) {
  const getStatusIcon = (itemStatus: 'idle' | 'processing' | 'done' | 'error') => {
    switch (itemStatus) {
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'done':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  const getStatusText = (itemStatus: 'idle' | 'processing' | 'done' | 'error') => {
    switch (itemStatus) {
      case 'processing':
        return 'Processando...';
      case 'done':
        return 'Concluído';
      case 'error':
        return 'Erro - preencha manualmente';
      default:
        return 'Aguardando';
    }
  };

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <p className="text-lg font-medium text-center">
          Processando seus dados...
        </p>
        <p className="text-sm text-muted-foreground text-center">
          Aguarde enquanto consultamos as informações
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        {/* Status da consulta de placa */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30">
          <Car className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium">Consulta de Veículo</p>
            <p className="text-sm text-muted-foreground">
              {getStatusText(status.plate)}
            </p>
          </div>
          {getStatusIcon(status.plate)}
        </div>

        {/* Status do OCR do documento */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="font-medium">Extração de Documento</p>
            <p className="text-sm text-muted-foreground">
              {getStatusText(status.document)}
            </p>
          </div>
          {getStatusIcon(status.document)}
        </div>
      </div>
    </div>
  );
}
