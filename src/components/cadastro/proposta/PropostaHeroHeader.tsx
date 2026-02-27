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
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
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
  gradientFrom: string;
  icon: React.ReactNode;
}> = {
  assinado: { 
    label: 'Aguardando Análise', 
    color: 'text-warning', 
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    gradientFrom: 'from-warning/5',
    icon: <Clock className="h-4 w-4" />
  },
  em_analise: { 
    label: 'Em Análise', 
    color: 'text-info', 
    bgColor: 'bg-info/10',
    borderColor: 'border-info/30',
    gradientFrom: 'from-info/5',
    icon: <Clock className="h-4 w-4" />
  },
  ativo: { 
    label: 'Aprovado', 
    color: 'text-success', 
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    gradientFrom: 'from-success/5',
    icon: <CheckCircle className="h-4 w-4" />
  },
  reprovado: { 
    label: 'Reprovado', 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    gradientFrom: 'from-destructive/5',
    icon: <XCircle className="h-4 w-4" />
  },
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '---';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

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
    gradientFrom: 'from-muted/5',
    icon: <Clock className="h-4 w-4" />
  };

  const veiculoDescricao = [
    proposta.veiculo_marca,
    proposta.veiculo_modelo,
    proposta.veiculo_ano,
  ].filter(Boolean).join(' ');

  const temDocumentosNovos = proposta.documentos_solicitados_enviados && proposta.documentos_solicitados_enviados.length > 0;

  return (
    <div className="space-y-0 animate-fade-in">
      {/* Alerta de Reanálise */}
      {temDocumentosNovos && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/15 border-2 border-amber-500/30 rounded-t-2xl">
          <div className="relative">
            <RefreshCw className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          </div>
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex-1">
            Reanálise — {proposta.documentos_solicitados_enviados?.length} documento(s) reenviado(s)
          </span>
          <Badge className="bg-amber-500 text-white text-[9px] px-2 animate-pulse">NOVO</Badge>
        </div>
      )}

      {/* Navigation bar */}
      <div className={cn(
        "sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-card/95 backdrop-blur-sm border border-border",
        temDocumentosNovos ? "rounded-none border-t-0" : "rounded-t-2xl"
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

      {/* Conteúdo principal com gradiente */}
      <div className={cn(
        "border border-border border-t-0 rounded-b-2xl bg-gradient-to-br to-card px-5 py-4",
        config.gradientFrom
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Lado esquerdo: Avatar + Info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <UserAvatar
              name={proposta.cliente_nome || proposta.associado?.nome}
              size="lg"
              className="ring-2 ring-primary/20"
            />
            
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground truncate">
                  {proposta.cliente_nome || proposta.associado?.nome || '---'}
                </h2>
                <Badge className={cn(
                  "text-xs px-2.5 py-0.5 gap-1",
                  config.color,
                  config.bgColor,
                  "border",
                  config.borderColor
                )}>
                  {config.icon}
                  {config.label}
                </Badge>
              </div>
              
              {/* Quick stats inline */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Car className="h-3.5 w-3.5" />
                  <span className="truncate">{veiculoDescricao || '---'}</span>
                </div>
                {proposta.veiculo_placa && (
                  <span className="font-mono font-bold text-sm bg-foreground/10 text-foreground px-2 py-0.5 rounded-md">
                    {proposta.veiculo_placa}
                  </span>
                )}
                {proposta.valor_mensal && (
                  <div className="flex items-center gap-1 text-sm">
                    <DollarSign className="h-3.5 w-3.5 text-success" />
                    <span className="font-semibold text-success">{formatCurrency(proposta.valor_mensal)}</span>
                  </div>
                )}
                {(proposta.plano?.nome || proposta.plano_nome) && (
                  <Badge variant="secondary" className="text-[10px]">
                    {proposta.plano?.nome || proposta.plano_nome}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Lado direito: Botões de ação maiores */}
          {podeAprovar && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                className="bg-success hover:bg-success/90 text-white shadow-sm"
                onClick={onAprovar}
                disabled={isAprovando}
              >
                {isAutovistoria ? (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {isAprovando 
                  ? 'Aprovando...' 
                  : isAutovistoria 
                    ? 'Aprovar R/F' 
                    : 'Aprovar'
                }
              </Button>

              <Button
                className="bg-warning hover:bg-warning/90 text-warning-foreground shadow-sm"
                onClick={onSolicitarDocs}
              >
                <FileText className="mr-2 h-4 w-4" />
                Docs
              </Button>

              <Button
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm"
                onClick={onReprovar}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reprovar
              </Button>
            </div>
          )}

          {/* Mensagem quando não pode aprovar */}
          {!podeAprovar && (
            <div className="flex-shrink-0">
              {proposta.tem_documento_pendente ? (
                <Badge className="bg-warning/15 text-warning border-warning/30 gap-1.5 px-3 py-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Aguardando docs do cliente
                </Badge>
              ) : proposta.status === 'ativo' ? (
                <Badge className="bg-success/15 text-success border-success/30 gap-1.5 px-3 py-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Proposta aprovada
                </Badge>
              ) : proposta.status === 'reprovado' ? (
                <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1.5 px-3 py-1.5">
                  <XCircle className="h-3.5 w-3.5" />
                  Proposta reprovada
                </Badge>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
