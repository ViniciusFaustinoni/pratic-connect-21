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

// Configuração de status
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
    icon: <Clock className="h-5 w-5" />
  },
  em_analise: { 
    label: 'Em Análise', 
    color: 'text-info', 
    bgColor: 'bg-info/10',
    borderColor: 'border-info/30',
    icon: <Clock className="h-5 w-5" />
  },
  ativo: { 
    label: 'Aprovado', 
    color: 'text-success', 
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    icon: <CheckCircle className="h-5 w-5" />
  },
  reprovado: { 
    label: 'Reprovado', 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    icon: <XCircle className="h-5 w-5" />
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
    icon: <Clock className="h-5 w-5" />
  };

  const veiculoDescricao = [
    proposta.veiculo_marca,
    proposta.veiculo_modelo,
    proposta.veiculo_ano,
  ].filter(Boolean).join(' ');

  const veiculoDetalhe = [
    proposta.veiculo_placa,
    proposta.veiculo_cor,
  ].filter(Boolean).join(' • ');

  const temDocumentosNovos = proposta.documentos_solicitados_enviados && proposta.documentos_solicitados_enviados.length > 0;

  return (
    <div className={cn(
      "rounded-xl border-2 overflow-hidden",
      config.borderColor,
      config.bgColor
    )}>
      {/* Header com navegação */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/50 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={onVoltar}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        <span className="font-mono text-sm text-muted-foreground">
          #{proposta.numero || proposta.id?.slice(0, 8)}
        </span>
        
        {onProxima ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onProxima}
            className="text-muted-foreground hover:text-foreground"
          >
            Próxima
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <div className="w-24" />
        )}
      </div>

      {/* Alerta de Reanálise */}
      {temDocumentosNovos && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/20 border-b border-amber-500/30">
          <RefreshCw className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <span className="font-medium text-amber-700 dark:text-amber-300 flex-1">
            Reanálise Necessária
          </span>
          <Badge className="bg-amber-500/30 text-amber-700 dark:text-amber-300 border-amber-500/50">
            {proposta.documentos_solicitados_enviados?.length} novo(s)
          </Badge>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="p-6 space-y-5">
        {/* Status Badge Grande */}
        <div className="flex justify-center">
          <Badge className={cn(
            "text-base px-6 py-2 gap-2",
            config.color,
            config.bgColor,
            "border-2",
            config.borderColor
          )}>
            {config.icon}
            {config.label}
          </Badge>
        </div>

        {/* Dados do Cliente e Veículo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground">
              {proposta.cliente_nome || proposta.associado?.nome || '---'}
            </h2>
          </div>
          
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Car className="h-4 w-4" />
            <span className="font-medium">{veiculoDescricao || '---'}</span>
            {veiculoDetalhe && (
              <>
                <span className="text-border">•</span>
                <span>{veiculoDetalhe}</span>
              </>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        {podeAprovar && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              className="flex-1 bg-success hover:bg-success/90 text-white"
              size="lg"
              onClick={onAprovar}
              disabled={isAprovando}
            >
              {isAutovistoria ? (
                <ShieldCheck className="mr-2 h-5 w-5" />
              ) : (
                <CheckCircle className="mr-2 h-5 w-5" />
              )}
              {isAprovando 
                ? 'Aprovando...' 
                : isAutovistoria 
                  ? 'Aprovar Roubo/Furto' 
                  : 'Aprovar'
              }
            </Button>

            <Button
              variant="outline"
              className="flex-1 border-warning text-warning hover:bg-warning/10"
              size="lg"
              onClick={onSolicitarDocs}
            >
              <FileText className="mr-2 h-5 w-5" />
              Solicitar Docs
            </Button>

            <Button
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
              size="lg"
              onClick={onReprovar}
            >
              <XCircle className="mr-2 h-5 w-5" />
              Reprovar
            </Button>
          </div>
        )}

        {/* Mensagem quando não pode aprovar */}
        {!podeAprovar && (
          <div className="text-center text-sm text-muted-foreground">
            {proposta.tem_documento_pendente ? (
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                <span>Aguardando envio de documentos pelo cliente</span>
              </div>
            ) : proposta.status === 'ativo' ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Esta proposta já foi aprovada</span>
              </div>
            ) : proposta.status === 'reprovado' ? (
              <div className="flex items-center justify-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>Esta proposta foi reprovada</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
