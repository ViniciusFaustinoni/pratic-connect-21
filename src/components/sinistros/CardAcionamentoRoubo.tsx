import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  MapPin, 
  Radio, 
  Clock, 
  User, 
  ExternalLink,
  XCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { useAcionamentoSinistro, ACIONAMENTO_STATUS_LABELS, TIPO_ORIGEM_LABELS } from "@/hooks/useAcionamentoRoubo";
import { Skeleton } from "@/components/ui/skeleton";

interface CardAcionamentoRouboProps {
  sinistroId: string;
  onAcionar?: () => void;
  podeAcionar?: boolean;
}

export function CardAcionamentoRoubo({ 
  sinistroId, 
  onAcionar,
  podeAcionar = true 
}: CardAcionamentoRouboProps) {
  const { data: acionamento, isLoading } = useAcionamentoSinistro(sinistroId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Sem acionamento - mostrar botão para acionar
  if (!acionamento) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-muted-foreground" />
            Acionamento de Recuperação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Nenhum acionamento de recuperação registrado para este sinistro.
            </p>
            {podeAcionar && onAcionar && (
              <Button variant="destructive" onClick={onAcionar}>
                <Radio className="mr-2 h-4 w-4" />
                Acionar Recuperação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Com acionamento - mostrar detalhes
  const statusInfo = ACIONAMENTO_STATUS_LABELS[acionamento.status] || { 
    label: acionamento.status, 
    color: 'bg-gray-500' 
  };

  const isAtivo = ['solicitado', 'autorizado', 'enviado', 'confirmado'].includes(acionamento.status);

  return (
    <Card className={isAtivo ? 'border-red-300 bg-red-50/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isAtivo ? (
              <Radio className="h-4 w-4 text-red-500 animate-pulse" />
            ) : acionamento.status === 'erro' ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            Acionamento de Recuperação
          </CardTitle>
          <Badge className={`${statusInfo.color} text-white`}>
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Protocolo externo */}
        {acionamento.protocolo_externo && (
          <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Protocolo Central</p>
              <p className="font-mono font-bold">{acionamento.protocolo_externo}</p>
            </div>
            <Badge variant="outline">{acionamento.plataforma}</Badge>
          </div>
        )}

        {/* Informações */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Solicitado por</p>
              <p className="font-medium">{acionamento.solicitado_por_nome || '-'}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Data/Hora</p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(acionamento.solicitado_em), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Origem */}
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Origem:</span>
          <span className="font-medium">{TIPO_ORIGEM_LABELS[acionamento.tipo_origem] || acionamento.tipo_origem}</span>
        </div>

        {/* Última posição */}
        {acionamento.ultima_posicao_lat && acionamento.ultima_posicao_lng && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Última posição conhecida</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              asChild
            >
              <a 
                href={`https://www.google.com/maps?q=${acionamento.ultima_posicao_lat},${acionamento.ultima_posicao_lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Ver no Mapa
              </a>
            </Button>
          </div>
        )}

        {/* Erro */}
        {acionamento.status === 'erro' && acionamento.erro_mensagem && (
          <div className="bg-red-100 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">
              <strong>Erro:</strong> {acionamento.erro_mensagem}
            </p>
          </div>
        )}

        {/* Observações */}
        {acionamento.observacoes && (
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Observações</p>
            <p className="text-sm">{acionamento.observacoes}</p>
          </div>
        )}

        {/* Encerramento */}
        {acionamento.status === 'encerrado' && acionamento.encerrado_em && (
          <div className="bg-slate-100 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">
              Encerrado em {new Date(acionamento.encerrado_em).toLocaleString('pt-BR')}
            </p>
            {acionamento.motivo_encerramento && (
              <p className="text-sm">{acionamento.motivo_encerramento}</p>
            )}
          </div>
        )}

        {/* Indicador de rastreamento ativo */}
        {isAtivo && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-100 p-3 rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Rastreamento intensivo em andamento...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
