import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  RefreshCw,
  ShieldCheck,
  Car,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropostaPendente } from '@/hooks/usePropostasPendentes';

interface PropostaHeroHeaderProps {
  proposta: PropostaPendente;
  onAprovar: () => void;
  onSolicitarDocs: () => void;
  onReprovar: () => void;
  onVoltar: () => void;
  onProxima?: () => void;
  isAprovando?: boolean;
  isAutovistoria?: boolean;
  podeAprovar?: boolean;
}

const statusConfig: Record<string, { 
  label: string; 
  color: string; 
  bgColor: string; 
  borderColor: string;
  icon: React.ReactNode;
}> = {
  assinado: { 
    label: 'Aguardando Análise', 
    color: 'text-warning', 
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    icon: <Clock className="h-4 w-4" />
  },
  em_analise: { 
    label: 'Em Análise', 
    color: 'text-info', 
    bgColor: 'bg-info/10',
    borderColor: 'border-info/30',
    icon: <Clock className="h-4 w-4" />
  },
  ativo: { 
    label: 'Aprovado', 
    color: 'text-success', 
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    icon: <CheckCircle className="h-4 w-4" />
  },
  reprovado: { 
    label: 'Reprovado', 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    icon: <XCircle className="h-4 w-4" />
  },
};

export function PropostaHeroHeader({
  proposta,
  onAprovar,
  onSolicitarDocs,
  onReprovar,
  onVoltar,
  onProxima,
  isAprovando = false,
  isAutovistoria = false,
  podeAprovar = true,
}: PropostaHeroHeaderProps) {
  const config = statusConfig[proposta.status || ''] || {
    label: proposta.status || 'Desconhecido',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-border',
    icon: <Clock className="h-4 w-4" />
  };

  const veiculoDescricao = [
    proposta.veiculo_marca,
    proposta.veiculo_modelo,
    proposta.veiculo_ano,
  ].filter(Boolean).join(' ');

  const temDocumentosNovos = proposta.documentos_solicitados_enviados && proposta.documentos_solicitados_enviados.length > 0;

  return (
    <div className="space-y-0">
      {/* Alerta de Reanálise - banner slim acima */}
      {temDocumentosNovos && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 border border-amber-500/30 rounded-t-xl">
          <RefreshCw className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-300 flex-1">
            Reanálise — {proposta.documentos_solicitados_enviados?.length} documento(s) reenviado(s)
          </span>
        </div>
      )}

      {/* Sticky navigation bar */}
      <div className={cn(
        "sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-card/95 backdrop-blur-sm border border-border",
        temDocumentosNovos ? "rounded-none border-t-0" : "rounded-t-xl"
      )}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onVoltar}
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        <span className="font-mono text-xs text-muted-foreground">
          #{proposta.numero || proposta.id?.slice(0, 8)}
        </span>
        
        {onProxima ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onProxima}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            Próxima
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-20" />
        )}
      </div>

      {/* Conteúdo principal - layout horizontal */}
      <div className="border border-border border-t-0 rounded-b-xl bg-card px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Lado esquerdo: Info do cliente + veículo + status */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar placeholder */}
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-foreground truncate">
                  {proposta.cliente_nome || proposta.associado?.nome || '---'}
                </h2>
                <Badge className={cn(
                  "text-xs px-2 py-0.5 gap-1",
                  config.color,
                  config.bgColor,
                  "border",
                  config.borderColor
                )}>
                  {config.icon}
                  {config.label}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Car className="h-3.5 w-3.5" />
                <span>{veiculoDescricao || '---'}</span>
                {proposta.veiculo_placa && (
                  <>
                    <span className="text-border">•</span>
                    <span className="font-mono font-medium text-foreground">{proposta.veiculo_placa}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Lado direito: Botões de ação */}
          {podeAprovar && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                className="bg-success hover:bg-success/90 text-white"
                size="sm"
                onClick={onAprovar}
                disabled={isAprovando}
              >
                {isAutovistoria ? (
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                ) : (
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                )}
                {isAprovando 
                  ? 'Aprovando...' 
                  : isAutovistoria 
                    ? 'Aprovar R/F' 
                    : 'Aprovar'
                }
              </Button>

              <Button
                variant="outline"
                className="border-warning text-warning hover:bg-warning/10"
                size="sm"
                onClick={onSolicitarDocs}
              >
                <FileText className="mr-1.5 h-4 w-4" />
                Docs
              </Button>

              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                size="sm"
                onClick={onReprovar}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Reprovar
              </Button>
            </div>
          )}

          {/* Mensagem quando não pode aprovar */}
          {!podeAprovar && (
            <div className="text-xs text-muted-foreground flex-shrink-0">
              {proposta.tem_documento_pendente ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-warning" />
                  <span>Aguardando docs do cliente</span>
                </div>
              ) : proposta.status === 'ativo' ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                  <span>Proposta aprovada</span>
                </div>
              ) : proposta.status === 'reprovado' ? (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  <span>Proposta reprovada</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
