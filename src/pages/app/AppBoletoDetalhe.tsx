import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  QrCode, 
  Download, 
  Share2, 
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  X,
  Loader2,
  Mail,
  Eye,
  CreditCard,
  History,
  Receipt
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useMyBoleto, BoletoHistorico } from '@/hooks/useMyData';
import { formatarValor, statusConfig as boletoStatusConfig } from '@/components/app/CardBoleto';

// ============================================
// COMPONENTE DE CÓDIGO DE BARRAS VISUAL
// ============================================

function BarcodeVisual({ codigo }: { codigo: string }) {
  // Gera barras baseado no código - representação visual simplificada
  const barras = codigo.replace(/\s/g, '').split('').map((char, i) => {
    const num = parseInt(char) || 0;
    return {
      width: num % 2 === 0 ? 'w-0.5' : 'w-1',
      key: i
    };
  });

  return (
    <div className="flex items-center justify-center gap-px h-12 px-4">
      {barras.slice(0, 50).map(({ width, key }) => (
        <div 
          key={key}
          className={cn("h-full bg-foreground", width)}
        />
      ))}
    </div>
  );
}

// ============================================
// ÍCONES DO HISTÓRICO
// ============================================

const historicoIcons: Record<BoletoHistorico['tipo'], React.ElementType> = {
  geracao: FileText,
  envio: Mail,
  visualizacao: Eye,
  tentativa: Clock,
  pagamento: CreditCard,
  cancelamento: X,
};

const historicoColors: Record<BoletoHistorico['tipo'], string> = {
  geracao: 'text-blue-600 bg-blue-100',
  envio: 'text-purple-600 bg-purple-100',
  visualizacao: 'text-gray-600 bg-gray-100',
  tentativa: 'text-yellow-600 bg-yellow-100',
  pagamento: 'text-green-600 bg-green-100',
  cancelamento: 'text-red-600 bg-red-100',
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function AppBoletoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { boleto, historico, isLoading, notFound } = useMyBoleto(id);
  
  const [copiando, setCopiando] = useState<'pix' | 'linha' | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);

  // ============================================
  // HANDLERS
  // ============================================

  const copiarTexto = async (texto: string, tipo: 'pix' | 'linha') => {
    setCopiando(tipo);
    try {
      await navigator.clipboard.writeText(texto.replace(/\s/g, ''));
      toast.success(tipo === 'pix' ? 'Código Pix copiado!' : 'Linha digitável copiada!');
    } catch {
      toast.error('Erro ao copiar. Tente novamente.');
    } finally {
      setTimeout(() => setCopiando(null), 1500);
    }
  };

  const baixarPdf = async () => {
    if (!boleto?.urlPdf && !boleto?.urlBoleto) {
      toast.error('PDF não disponível');
      return;
    }
    
    setBaixando(true);
    try {
      window.open(boleto.urlPdf || boleto.urlBoleto, '_blank');
      toast.success('Abrindo boleto...');
    } catch {
      toast.error('Erro ao abrir boleto');
    } finally {
      setTimeout(() => setBaixando(false), 1000);
    }
  };

  const compartilhar = async () => {
    if (!boleto) return;
    
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

  // ============================================
  // LOADING STATE
  // ============================================

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  // ============================================
  // NOT FOUND STATE
  // ============================================

  if (notFound || !boleto) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="p-4 rounded-full bg-muted">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Boleto não encontrado</h2>
        <p className="text-sm text-muted-foreground text-center">
          O boleto que você está procurando não existe ou foi removido.
        </p>
        <Button onClick={() => navigate('/app/boletos')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Boletos
        </Button>
      </div>
    );
  }

  // ============================================
  // CONFIGURAÇÕES DE STATUS
  // ============================================

  const config = boletoStatusConfig[boleto.status];
  const StatusIcon = config.icone;
  const podeAcoes = boleto.status === 'pendente' || boleto.status === 'vencido';

  // Calcular dias para vencer
  const calcularDias = () => {
    const [dia, mes, ano] = boleto.dataVencimento.split('/');
    const vencimento = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  };

  const diasParaVencer = calcularDias();
  const mostrarUrgencia = podeAcoes && diasParaVencer <= 7;
  
  const getMensagemUrgencia = () => {
    if (boleto.status === 'vencido' || diasParaVencer < 0) {
      return `Vencido há ${Math.abs(diasParaVencer)} dia${Math.abs(diasParaVencer) !== 1 ? 's' : ''}`;
    }
    if (diasParaVencer === 0) return 'Vence hoje!';
    if (diasParaVencer === 1) return 'Vence amanhã!';
    return `Vence em ${diasParaVencer} dias`;
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Boleto</h1>
            <p className="text-sm text-muted-foreground">{boleto.competencia}</p>
          </div>
        </div>
        <Badge className={cn(config.corFundo, config.cor, 'border-0')}>
          <StatusIcon className={cn("h-3 w-3 mr-1", boleto.status === 'processando' && "animate-spin")} />
          {config.label}
        </Badge>
      </div>

      {/* Card Principal (Hero) */}
      <Card className="border-0 bg-primary text-primary-foreground shadow-lg overflow-hidden">
        <CardContent className="p-6 text-center relative">
          {/* Background decorativo */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
          
          <p className="text-sm opacity-80 mb-1">
            {boleto.status === 'pago' ? 'Valor pago' : 'Valor do boleto'}
          </p>
          <p className="text-4xl font-bold mb-2">
            {formatarValor(boleto.valorFinal)}
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm opacity-80">
            <Calendar className="h-4 w-4" />
            {boleto.status === 'pago' ? (
              <span>Pago em {boleto.dataPagamento}</span>
            ) : (
              <span>Vencimento: {boleto.dataVencimento}</span>
            )}
          </div>

          {/* Alerta de urgência */}
          {mostrarUrgencia && (
            <div className={cn(
              "mt-4 py-2 px-4 rounded-lg inline-flex items-center gap-2 text-sm font-medium",
              diasParaVencer <= 1 ? "bg-red-500/20 text-white" : 
              diasParaVencer <= 3 ? "bg-yellow-500/20 text-white" :
              "bg-white/20 text-white"
            )}>
              <AlertTriangle className="h-4 w-4" />
              {getMensagemUrgencia()}
            </div>
          )}

          {/* Badge de pago */}
          {boleto.status === 'pago' && (
            <div className="mt-4 py-2 px-4 rounded-lg inline-flex items-center gap-2 text-sm font-medium bg-white/20">
              <CheckCircle className="h-4 w-4" />
              Pagamento confirmado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card Pix - apenas se pendente/vencido */}
      {podeAcoes && boleto.pixCopiaCola && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5 text-primary" />
              Pagar com PIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Code */}
            <div className="flex items-center justify-center rounded-lg bg-muted p-4">
              <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-white p-2">
                {boleto.pixQrCode ? (
                  <img 
                    src={boleto.pixQrCode} 
                    alt="QR Code PIX" 
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <QrCode className="h-32 w-32 text-foreground" />
                )}
              </div>
            </div>

            {/* Código Pix */}
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">Código PIX Copia e Cola:</p>
              <p className="text-xs font-mono break-all text-foreground">
                {boleto.pixCopiaCola}
              </p>
            </div>

            {/* Botão Copiar */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    className="w-full"
                    onClick={() => copiarTexto(boleto.pixCopiaCola!, 'pix')}
                    disabled={copiando !== null}
                  >
                    {copiando === 'pix' ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-green-400" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar código PIX
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copiar código para pagar no app do banco</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}

      {/* Card Código de Barras - apenas se pendente/vencido */}
      {podeAcoes && boleto.linhaDigitavel && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5 text-primary" />
              Código de Barras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Código de barras visual */}
            {boleto.codigoBarras && (
              <div className="rounded-lg bg-white p-4 border">
                <BarcodeVisual codigo={boleto.codigoBarras || boleto.linhaDigitavel} />
              </div>
            )}

            {/* Linha digitável */}
            <div className="rounded-lg bg-muted p-4">
              <p className="text-center font-mono text-sm text-foreground tracking-wider">
                {boleto.linhaDigitavel}
              </p>
            </div>

            {/* Botão Copiar */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => copiarTexto(boleto.linhaDigitavel!, 'linha')}
                    disabled={copiando !== null}
                  >
                    {copiando === 'linha' ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar linha digitável
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copiar para pagar via código de barras</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}

      {/* Card Ver/Baixar Boleto */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Documento do Boleto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={baixarPdf}
              disabled={baixando || (!boleto.urlPdf && !boleto.urlBoleto)}
            >
              {baixando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {baixando ? 'Abrindo...' : 'Ver PDF'}
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={compartilhar}
              disabled={compartilhando}
            >
              {compartilhando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              Compartilhar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card Detalhes do Valor - se houver diferenças */}
      {(boleto.valorDesconto || boleto.valorJuros || boleto.valorMulta || boleto.valorOriginal !== boleto.valorFinal) && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalhes do Valor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor original</span>
              <span>{formatarValor(boleto.valorOriginal)}</span>
            </div>
            {boleto.valorDesconto && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Desconto</span>
                <span className="text-green-600">-{formatarValor(boleto.valorDesconto)}</span>
              </div>
            )}
            {boleto.valorJuros && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Juros</span>
                <span className="text-red-600">+{formatarValor(boleto.valorJuros)}</span>
              </div>
            )}
            {boleto.valorMulta && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Multa</span>
                <span className="text-red-600">+{formatarValor(boleto.valorMulta)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t">
              <span>Total</span>
              <span>{formatarValor(boleto.valorFinal)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card Histórico */}
      {historico.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Linha vertical da timeline */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
              
              <div className="space-y-4">
                {historico.map((evento, index) => {
                  const Icon = historicoIcons[evento.tipo];
                  const colorClass = historicoColors[evento.tipo];
                  
                  return (
                    <div key={evento.id} className="flex gap-4 relative">
                      {/* Ícone */}
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 z-10",
                        colorClass
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      
                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0 pb-4">
                        <p className="text-sm font-medium text-foreground">
                          {evento.descricao}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {evento.data}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
