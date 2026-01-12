import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Clock, 
  FileSignature, 
  ClipboardCheck,
  Phone,
  Car,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtivacaoContrato } from "@/hooks/useAtivacoes";

interface AtivacaoCardNewProps {
  contrato: AtivacaoContrato;
  onAtivar: () => void;
  onClickRequisito: (tipo: 'proposta' | 'vistoria') => void;
  isAtivando?: boolean;
}

export function AtivacaoCardNew({ 
  contrato, 
  onAtivar, 
  onClickRequisito,
  isAtivando 
}: AtivacaoCardNewProps) {
  const propostaAssinada = !!contrato.data_assinatura;
  const vistoriaOk = contrato.vistoria?.status === 'aprovada';
  const isAtivado = contrato.status === 'ativo';
  
  const requisitos = (propostaAssinada ? 1 : 0) + (vistoriaOk ? 1 : 0);
  const progressValue = (requisitos / 2) * 100;

  // Determinar cor do status
  const getStatusColor = () => {
    if (isAtivado) return 'border-l-blue-500';
    if (requisitos === 2) return 'border-l-emerald-500';
    if (requisitos === 1) return 'border-l-amber-500';
    return 'border-l-red-500';
  };

  const getStatusBg = () => {
    if (isAtivado) return 'bg-blue-500/5';
    if (requisitos === 2) return 'bg-emerald-500/5';
    if (requisitos === 1) return 'bg-amber-500/5';
    return 'bg-red-500/5';
  };

  return (
    <Card className={cn(
      "border-l-4 transition-all hover:shadow-md",
      getStatusColor(),
      getStatusBg()
    )}>
      <CardContent className="p-5 space-y-4">
        {/* Header com nome e info básica */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-base line-clamp-1">
                {contrato.lead?.nome || 'Cliente não informado'}
              </h3>
            </div>
            {isAtivado && (
              <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">
                Ativado
              </Badge>
            )}
          </div>
          
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {contrato.lead?.telefone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                <span>{contrato.lead.telefone}</span>
              </div>
            )}
            {(contrato.lead?.veiculo_marca || contrato.lead?.veiculo_modelo) && (
              <div className="flex items-center gap-1">
                <Car className="h-3.5 w-3.5" />
                <span>
                  {[contrato.lead?.veiculo_marca, contrato.lead?.veiculo_modelo, contrato.lead?.veiculo_placa]
                    .filter(Boolean)
                    .join(' - ')}
                </span>
              </div>
            )}
          </div>

          {contrato.created_at && (
            <p className="text-xs text-muted-foreground">
              Proposta: {format(new Date(contrato.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
        </div>

        {/* Requisitos */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => !propostaAssinada && onClickRequisito('proposta')}
            disabled={propostaAssinada}
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-lg transition-all text-left",
              propostaAssinada 
                ? "bg-emerald-500/10 cursor-default" 
                : "bg-muted/50 hover:bg-muted cursor-pointer"
            )}
          >
            {propostaAssinada ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <FileSignature className="h-4 w-4 flex-shrink-0" />
            <span className={cn(
              "text-sm font-medium",
              propostaAssinada ? "text-emerald-700" : "text-muted-foreground"
            )}>
              Proposta Assinada
            </span>
          </button>

          <button
            onClick={() => !vistoriaOk && onClickRequisito('vistoria')}
            disabled={vistoriaOk}
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-lg transition-all text-left",
              vistoriaOk 
                ? "bg-emerald-500/10 cursor-default" 
                : "bg-muted/50 hover:bg-muted cursor-pointer"
            )}
          >
            {vistoriaOk ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <ClipboardCheck className="h-4 w-4 flex-shrink-0" />
            <span className={cn(
              "text-sm font-medium",
              vistoriaOk ? "text-emerald-700" : "text-muted-foreground"
            )}>
              Vistoria de Entrada
            </span>
          </button>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-1.5">
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {requisitos}/2 requisitos
          </p>
        </div>

        {/* Footer com botão ou status */}
        <div className="pt-2 border-t">
          {isAtivado ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ativado em:</span>
              <span className="font-medium text-blue-600">
                {contrato.data_ativacao 
                  ? format(new Date(contrato.data_ativacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : '-'}
              </span>
            </div>
          ) : requisitos === 2 ? (
            <Button
              onClick={onAtivar}
              disabled={isAtivando}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white animate-pulse"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isAtivando ? 'Ativando...' : 'Ativar Contrato'}
            </Button>
          ) : (
            <Button
              disabled
              variant="secondary"
              className="w-full"
            >
              Aguardando Requisitos
            </Button>
          )}

          {contrato.vendedor?.nome && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Consultor: {contrato.vendedor.nome}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
