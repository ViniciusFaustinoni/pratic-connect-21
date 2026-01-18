import { useAssinaturaVistoria } from '@/hooks/useAssinaturaVistoria';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Send, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle,
  FileSignature,
  Mail,
  ExternalLink,
  Loader2
} from 'lucide-react';

interface AssinaturaVistoriaProps {
  vistoriaId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  hodometro: number;
  avarias: string[];
  vistoriadorNome: string;
  onAssinaturaConcluida?: () => void;
}

export function AssinaturaVistoria({
  vistoriaId,
  clienteNome,
  clienteEmail,
  clienteCpf,
  veiculoModelo,
  veiculoPlaca,
  hodometro,
  avarias,
  vistoriadorNome,
  onAssinaturaConcluida,
}: AssinaturaVistoriaProps) {
  const {
    assinatura,
    isLoading,
    solicitarAssinatura,
    isSolicitando,
    verificarStatus,
    isVerificando,
    reenviarEmail,
    isReenviando,
  } = useAssinaturaVistoria(vistoriaId);

  const handleSolicitar = () => {
    solicitarAssinatura({
      vistoriaId,
      clienteNome,
      clienteEmail,
      clienteCpf,
      veiculoModelo,
      veiculoPlaca,
      hodometro,
      avarias,
      vistoriadorNome,
    });
  };

  const handleVerificar = () => {
    verificarStatus(undefined, {
      onSuccess: (data) => {
        if (data.status === 'assinada' && onAssinaturaConcluida) {
          onAssinaturaConcluida();
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  const status = assinatura?.status || 'pendente';

  const getStatusConfig = () => {
    switch (status) {
      case 'pendente':
        return {
          icon: Clock,
          iconClass: 'text-muted-foreground',
          label: 'Aguardando envio',
          badge: 'Pendente',
          badgeVariant: 'secondary' as const,
        };
      case 'enviada':
        return {
          icon: Clock,
          iconClass: 'text-yellow-600',
          label: 'Aguardando assinatura do cliente',
          badge: 'Enviado',
          badgeVariant: 'default' as const,
        };
      case 'assinada':
        return {
          icon: CheckCircle,
          iconClass: 'text-green-600',
          label: 'Documento assinado',
          badge: 'Assinado',
          badgeVariant: 'default' as const,
        };
      case 'recusada':
        return {
          icon: XCircle,
          iconClass: 'text-destructive',
          label: 'Assinatura recusada pelo cliente',
          badge: 'Recusado',
          badgeVariant: 'destructive' as const,
        };
      case 'expirada':
        return {
          icon: AlertTriangle,
          iconClass: 'text-orange-600',
          label: 'Link de assinatura expirado',
          badge: 'Expirado',
          badgeVariant: 'outline' as const,
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSignature className="h-5 w-5" />
          Assinatura do Termo de Vistoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status da Assinatura */}
        <div className="flex items-start justify-between rounded-lg border bg-card p-4">
          <div className="flex items-start gap-3">
            <StatusIcon className={`mt-0.5 h-5 w-5 ${statusConfig.iconClass}`} />
            
            <div className="space-y-1">
              <p className="font-medium">{statusConfig.label}</p>
              
              {assinatura?.enviada_em && status !== 'assinada' && (
                <p className="text-sm text-muted-foreground">
                  Enviado em {new Date(assinatura.enviada_em).toLocaleString('pt-BR')}
                </p>
              )}
              {assinatura?.assinada_em && (
                <p className="text-sm text-muted-foreground">
                  Assinado em {new Date(assinatura.assinada_em).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
          
          <Badge 
            variant={statusConfig.badgeVariant}
            className={status === 'assinada' ? 'bg-green-600' : ''}
          >
            {statusConfig.badge}
          </Badge>
        </div>

        {/* Informações do Cliente */}
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">A assinatura será enviada para:</span>{' '}
            <span className="text-primary">{clienteEmail}</span>
            <p className="mt-1 text-sm text-muted-foreground">
              O cliente receberá um link por email para assinar o termo digitalmente.
            </p>
          </AlertDescription>
        </Alert>

        {/* Ações baseadas no status */}
        <div className="flex flex-col gap-2">
          
          {/* Botão Solicitar (apenas se pendente) */}
          {status === 'pendente' && (
            <Button
              onClick={handleSolicitar}
              disabled={isSolicitando}
              className="w-full"
            >
              {isSolicitando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Solicitação de Assinatura
                </>
              )}
            </Button>
          )}

          {/* Botões quando enviado */}
          {status === 'enviada' && (
            <>
              <Button
                onClick={handleVerificar}
                disabled={isVerificando}
                className="w-full"
              >
                {isVerificando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar se já assinou
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => reenviarEmail()}
                disabled={isReenviando}
                className="w-full"
              >
                {isReenviando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Reenviar email
                  </>
                )}
              </Button>
            </>
          )}

          {/* Link do documento assinado */}
          {status === 'assinada' && assinatura?.documento_url && (
            <Button
              variant="outline"
              onClick={() => window.open(assinatura.documento_url!, '_blank')}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver documento assinado
            </Button>
          )}

          {/* Reenviar se expirado ou recusado */}
          {(status === 'expirada' || status === 'recusada') && (
            <Button
              onClick={handleSolicitar}
              disabled={isSolicitando}
              className="w-full"
            >
              {isSolicitando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Enviar nova solicitação
                </>
              )}
            </Button>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
