import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Copy, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ChevronRight,
  Download,
  Share2,
  Barcode,
  Calendar,
  Loader2,
  Check,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================
// TIPOS
// ============================================

type StatusBoleto = 'pendente' | 'pago' | 'vencido' | 'cancelado' | 'processando';
type VariacaoCard = 'mini' | 'compacto' | 'expandido';

export interface BoletoData {
  id: string;
  competencia: string;
  competenciaMes?: number;
  competenciaAno?: number;
  dataVencimento: string;
  dataPagamento?: string;
  valorOriginal: number;
  valorFinal: number;
  valorPago?: number;
  valorDesconto?: number;
  valorJuros?: number;
  valorMulta?: number;
  status: StatusBoleto;
  pixCopiaCola?: string;
  pixQrCode?: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  urlBoleto?: string;
  urlPdf?: string;
}

interface CardBoletoProps {
  boleto: BoletoData;
  variacao?: VariacaoCard;
  onClick?: () => void;
  onPagar?: () => void;
  mostrarAcoes?: boolean;
  destacar?: boolean;
  className?: string;
}

// ============================================
// CONFIGURAÇÕES DE STATUS
// ============================================

interface StatusConfig {
  label: string;
  cor: string;
  corFundo: string;
  corBorda: string;
  corHeader: string;
  icone: typeof Clock;
  prioridade: number;
}

const statusConfig: Record<StatusBoleto, StatusConfig> = {
  vencido: {
    label: 'Vencido',
    cor: 'text-red-700',
    corFundo: 'bg-red-50',
    corBorda: 'border-l-red-500',
    corHeader: 'bg-red-100',
    icone: AlertTriangle,
    prioridade: 0
  },
  pendente: {
    label: 'Pendente',
    cor: 'text-yellow-700',
    corFundo: 'bg-yellow-50',
    corBorda: 'border-l-yellow-500',
    corHeader: 'bg-yellow-100',
    icone: Clock,
    prioridade: 1
  },
  processando: {
    label: 'Processando',
    cor: 'text-blue-700',
    corFundo: 'bg-blue-50',
    corBorda: 'border-l-blue-500',
    corHeader: 'bg-blue-100',
    icone: Loader2,
    prioridade: 2
  },
  pago: {
    label: 'Pago',
    cor: 'text-green-700',
    corFundo: 'bg-green-50',
    corBorda: 'border-l-green-500',
    corHeader: 'bg-green-100',
    icone: CheckCircle,
    prioridade: 3
  },
  cancelado: {
    label: 'Cancelado',
    cor: 'text-gray-500',
    corFundo: 'bg-gray-50',
    corBorda: 'border-l-gray-400',
    corHeader: 'bg-gray-100',
    icone: X,
    prioridade: 4
  }
};

// ============================================
// UTILITÁRIOS
// ============================================

export const formatarValor = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

export const calcularDiasParaVencer = (dataVencimento: string): number => {
  const partes = dataVencimento.split('/');
  if (partes.length !== 3) return 0;
  
  const [dia, mes, ano] = partes;
  const vencimento = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  vencimento.setHours(0, 0, 0, 0);
  const diffTime = vencimento.getTime() - hoje.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getMensagemUrgencia = (dias: number, status: StatusBoleto): { mensagem: string; tipo: 'erro' | 'alerta' | 'info' | null } => {
  if (status === 'pago' || status === 'cancelado' || status === 'processando') {
    return { mensagem: '', tipo: null };
  }
  
  if (status === 'vencido' || dias < 0) {
    const diasVencido = Math.abs(dias);
    return { 
      mensagem: `Vencido há ${diasVencido} dia${diasVencido !== 1 ? 's' : ''}`, 
      tipo: 'erro' 
    };
  }
  
  if (dias === 0) return { mensagem: 'Vence hoje!', tipo: 'erro' };
  if (dias === 1) return { mensagem: 'Vence amanhã!', tipo: 'alerta' };
  if (dias <= 3) return { mensagem: `Vence em ${dias} dias`, tipo: 'alerta' };
  if (dias <= 7) return { mensagem: `Vence em ${dias} dias`, tipo: 'info' };
  
  return { mensagem: '', tipo: null };
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function CardBoleto({
  boleto,
  variacao = 'compacto',
  onClick,
  mostrarAcoes = true,
  destacar = false,
  className
}: CardBoletoProps) {
  const navigate = useNavigate();
  const config = statusConfig[boleto.status];
  
  const diasParaVencer = calcularDiasParaVencer(boleto.dataVencimento);
  const urgencia = getMensagemUrgencia(diasParaVencer, boleto.status);
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/app/boletos/${boleto.id}`);
    }
  };

  switch (variacao) {
    case 'mini':
      return (
        <CardBoletoMini 
          boleto={boleto} 
          config={config} 
          onClick={handleClick}
          className={className}
        />
      );
    case 'expandido':
      return (
        <CardBoletoExpandido 
          boleto={boleto} 
          config={config}
          urgencia={urgencia}
          diasParaVencer={diasParaVencer}
          onClick={handleClick}
          mostrarAcoes={mostrarAcoes}
          destacar={destacar}
          className={className}
        />
      );
    default:
      return (
        <CardBoletoCompacto 
          boleto={boleto} 
          config={config}
          urgencia={urgencia}
          onClick={handleClick}
          mostrarAcoes={mostrarAcoes}
          className={className}
        />
      );
  }
}

// ============================================
// VARIAÇÃO MINI
// ============================================

function CardBoletoMini({ 
  boleto, 
  config, 
  onClick,
  className 
}: { 
  boleto: BoletoData;
  config: StatusConfig;
  onClick: () => void;
  className?: string;
}) {
  const StatusIcon = config.icone;
  const mesAbrev = boleto.competencia.substring(0, 3);
  const partes = boleto.competencia.split('/');
  const ano = partes.length > 1 ? partes[1] : '';
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
        "bg-muted/50 hover:bg-muted",
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon className={cn("h-3.5 w-3.5", config.cor)} />
        <span className="font-medium text-foreground">
          {mesAbrev}/{ano}
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="font-semibold text-foreground">
          {formatarValor(boleto.valorFinal)}
        </span>
      </div>
      <Badge variant="secondary" className={cn("text-xs", config.cor, config.corFundo)}>
        {config.label}
      </Badge>
    </div>
  );
}

// ============================================
// VARIAÇÃO COMPACTA
// ============================================

function CardBoletoCompacto({ 
  boleto, 
  config,
  urgencia,
  onClick,
  mostrarAcoes,
  className 
}: { 
  boleto: BoletoData;
  config: StatusConfig;
  urgencia: ReturnType<typeof getMensagemUrgencia>;
  onClick: () => void;
  mostrarAcoes: boolean;
  className?: string;
}) {
  const [copiando, setCopiando] = useState<'pix' | 'linha' | null>(null);
  const StatusIcon = config.icone;
  const podeAcoes = boleto.status === 'pendente' || boleto.status === 'vencido';

  const copiarTexto = async (texto: string, tipo: 'pix' | 'linha', e: React.MouseEvent) => {
    e.stopPropagation();
    setCopiando(tipo);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(tipo === 'pix' ? 'Código Pix copiado!' : 'Linha digitável copiada!');
    } catch {
      toast.error('Erro ao copiar. Tente novamente.');
    } finally {
      setTimeout(() => setCopiando(null), 1500);
    }
  };

  return (
    <Card 
      className={cn(
        "border-0 shadow-sm cursor-pointer transition-all hover:shadow-md border-l-4",
        config.corBorda,
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Ícone */}
          <div className={cn(
            "rounded-full p-2.5 shrink-0",
            config.corFundo
          )}>
            <StatusIcon className={cn(
              "h-5 w-5",
              config.cor,
              boleto.status === 'processando' && "animate-spin"
            )} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-foreground">
                {boleto.competencia}
              </div>
              <Badge variant="secondary" className={cn("text-xs shrink-0", config.cor, config.corFundo)}>
                {config.label}
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {boleto.status === 'pago' ? (
                <>Pago em {boleto.dataPagamento}</>
              ) : (
                <>Vence em {boleto.dataVencimento}</>
              )}
            </div>

            {/* Indicador de urgência */}
            {urgencia.tipo && (
              <div className={cn(
                "text-xs mt-1.5 font-medium",
                urgencia.tipo === 'erro' && "text-red-600",
                urgencia.tipo === 'alerta' && "text-yellow-600",
                urgencia.tipo === 'info' && "text-blue-600"
              )}>
                ⚠️ {urgencia.mensagem}
              </div>
            )}
          </div>

          {/* Valor e Ações */}
          <div className="text-right shrink-0">
            <div className="text-lg font-bold text-foreground">
              {formatarValor(boleto.valorFinal)}
            </div>
            
            {boleto.valorPago && boleto.valorPago !== boleto.valorOriginal && (
              <div className="text-xs text-muted-foreground line-through">
                {formatarValor(boleto.valorOriginal)}
              </div>
            )}
            
            {/* Botão de ação rápida */}
            {mostrarAcoes && podeAcoes && boleto.pixCopiaCola && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs gap-1"
                onClick={(e) => copiarTexto(boleto.pixCopiaCola!, 'pix', e)}
                disabled={copiando !== null}
              >
                {copiando === 'pix' ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Pix
                  </>
                )}
              </Button>
            )}

            {/* Seta para pagos */}
            {boleto.status === 'pago' && (
              <ChevronRight className="h-5 w-5 text-muted-foreground mt-2 ml-auto" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// VARIAÇÃO EXPANDIDA
// ============================================

function CardBoletoExpandido({ 
  boleto, 
  config,
  urgencia,
  diasParaVencer,
  onClick,
  mostrarAcoes,
  destacar,
  className 
}: { 
  boleto: BoletoData;
  config: StatusConfig;
  urgencia: ReturnType<typeof getMensagemUrgencia>;
  diasParaVencer: number;
  onClick: () => void;
  mostrarAcoes: boolean;
  destacar: boolean;
  className?: string;
}) {
  const [copiando, setCopiando] = useState<'pix' | 'linha' | null>(null);
  const [compartilhando, setCompartilhando] = useState(false);
  const StatusIcon = config.icone;
  const podeAcoes = boleto.status === 'pendente' || boleto.status === 'vencido';

  const copiarTexto = async (texto: string, tipo: 'pix' | 'linha', e: React.MouseEvent) => {
    e.stopPropagation();
    setCopiando(tipo);
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(tipo === 'pix' ? 'Código Pix copiado!' : 'Linha digitável copiada!');
    } catch {
      toast.error('Erro ao copiar. Tente novamente.');
    } finally {
      setTimeout(() => setCopiando(null), 1500);
    }
  };

  const abrirBoleto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (boleto.urlPdf || boleto.urlBoleto) {
      window.open(boleto.urlPdf || boleto.urlBoleto, '_blank');
    }
  };

  const compartilhar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCompartilhando(true);
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Boleto ${boleto.competencia}`,
          text: `Boleto PRATIC - ${boleto.competencia} - ${formatarValor(boleto.valorFinal)}`,
          url: boleto.urlBoleto || window.location.href
        });
        toast.success('Compartilhado com sucesso!');
      } else {
        await navigator.clipboard.writeText(boleto.urlBoleto || window.location.href);
        toast.success('Link copiado para compartilhar!');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao compartilhar');
      }
    } finally {
      setCompartilhando(false);
    }
  };

  const progressoPorcentagem = podeAcoes && diasParaVencer > 0 && diasParaVencer <= 30 
    ? Math.max(0, Math.min(100, (diasParaVencer / 30) * 100))
    : 0;

  return (
    <Card className={cn(
      "border-0 shadow-sm overflow-hidden",
      destacar && "ring-2 ring-primary/20",
      className
    )}>
      {/* Header */}
      <CardHeader className={cn("py-3 px-4", config.corHeader)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn(
              "h-4 w-4",
              config.cor,
              boleto.status === 'processando' && "animate-spin"
            )} />
            <span className={cn("font-medium text-sm", config.cor)}>
              {boleto.status === 'vencido' ? 'Boleto Vencido' : 
               boleto.status === 'pago' ? 'Boleto Pago' :
               boleto.status === 'processando' ? 'Processando Pagamento' :
               'Próximo Boleto'}
            </span>
          </div>
          <Badge variant="secondary" className={cn("text-xs", config.cor, config.corFundo)}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Info principal */}
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{boleto.competencia}</h3>
          <div className="text-3xl font-bold text-foreground">
            {formatarValor(boleto.valorFinal)}
          </div>
          
          {/* Detalhes de valor */}
          {(boleto.valorDesconto || boleto.valorJuros || boleto.valorMulta) && (
            <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
              {boleto.valorOriginal !== boleto.valorFinal && (
                <p>Original: {formatarValor(boleto.valorOriginal)}</p>
              )}
              {boleto.valorDesconto && (
                <p className="text-green-600">Desconto: -{formatarValor(boleto.valorDesconto)}</p>
              )}
              {boleto.valorJuros && (
                <p className="text-red-600">Juros: +{formatarValor(boleto.valorJuros)}</p>
              )}
              {boleto.valorMulta && (
                <p className="text-red-600">Multa: +{formatarValor(boleto.valorMulta)}</p>
              )}
            </div>
          )}

          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1 pt-1">
            <Calendar className="h-3.5 w-3.5" />
            {boleto.status === 'pago' ? (
              <span>Pago em {boleto.dataPagamento}</span>
            ) : (
              <span>Vencimento: {boleto.dataVencimento}</span>
            )}
          </div>
        </div>

        {/* Alerta de urgência */}
        {urgencia.tipo && (
          <div className={cn(
            "text-center py-2 px-3 rounded-lg text-sm font-medium",
            urgencia.tipo === 'erro' && "bg-red-100 text-red-700",
            urgencia.tipo === 'alerta' && "bg-yellow-100 text-yellow-700",
            urgencia.tipo === 'info' && "bg-blue-100 text-blue-700"
          )}>
            ⚠️ {urgencia.mensagem}
          </div>
        )}

        {/* Barra de progresso até vencer */}
        {podeAcoes && diasParaVencer > 0 && diasParaVencer <= 30 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tempo restante</span>
              <span>{diasParaVencer} dias</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  diasParaVencer <= 3 ? "bg-red-500" :
                  diasParaVencer <= 7 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${progressoPorcentagem}%` }}
              />
            </div>
          </div>
        )}

        {/* Botões de ação */}
        {mostrarAcoes && podeAcoes && (
          <TooltipProvider>
            <div className="grid grid-cols-2 gap-2">
              {/* Copiar Pix */}
              {boleto.pixCopiaCola && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={(e) => copiarTexto(boleto.pixCopiaCola!, 'pix', e)}
                      disabled={copiando !== null}
                    >
                      {copiando === 'pix' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copiando === 'pix' ? 'Copiado!' : 'Copiar Pix'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copiar código Pix copia e cola</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Ver/Baixar Boleto */}
              {(boleto.urlPdf || boleto.urlBoleto) && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={abrirBoleto}
                >
                  <Download className="h-4 w-4" />
                  Ver Boleto
                </Button>
              )}

              {/* Copiar Linha Digitável */}
              {boleto.linhaDigitavel && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={(e) => copiarTexto(boleto.linhaDigitavel!, 'linha', e)}
                      disabled={copiando !== null}
                    >
                      {copiando === 'linha' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Barcode className="h-4 w-4" />
                      )}
                      {copiando === 'linha' ? 'Copiado!' : 'Linha Digit.'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copiar linha digitável do boleto</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Compartilhar */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={compartilhar}
                disabled={compartilhando}
              >
                {compartilhando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Compartilhar
              </Button>
            </div>
          </TooltipProvider>
        )}

        {/* Botão ver detalhes */}
        <Button 
          variant="ghost" 
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={onClick}
        >
          Ver detalhes completos
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// SKELETON LOADING
// ============================================

export function CardBoletoSkeleton({ variacao = 'compacto' }: { variacao?: VariacaoCard }) {
  if (variacao === 'mini') {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  if (variacao === 'expandido') {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="py-3 px-4 bg-muted">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="text-center space-y-2">
            <Skeleton className="h-6 w-32 mx-auto" />
            <Skeleton className="h-10 w-40 mx-auto" />
            <Skeleton className="h-4 w-36 mx-auto" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-7 w-16 ml-auto" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// EXPORTS
// ============================================

export default CardBoleto;
export { statusConfig };
