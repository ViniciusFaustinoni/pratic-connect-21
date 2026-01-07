import { useParams, useNavigate } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import { ArrowLeft, Copy, ExternalLink, QrCode, FileText, CheckCircle, AlertCircle, Clock, Calendar, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useCobranca } from '@/hooks/useCobrancas';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  aguardando_pagamento: { label: 'Aguardando Pagamento', variant: 'secondary', color: 'bg-yellow-500' },
  pago: { label: 'Pago', variant: 'default', color: 'bg-green-500' },
  vencido: { label: 'Vencido', variant: 'destructive', color: 'bg-red-500' },
  cancelado: { label: 'Cancelado', variant: 'outline', color: 'bg-gray-500' },
};

const tipoLabels: Record<string, string> = {
  mensalidade: 'Mensalidade',
  adesao: 'Adesão',
  taxa_instalacao: 'Taxa de Instalação',
  taxa_vistoria: 'Taxa de Vistoria',
  participacao_sinistro: 'Participação Sinistro',
  avulso: 'Avulso',
};

export default function BoletoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: cobranca, isLoading } = useCobranca(id);

  const copiarTexto = async (texto: string, tipo: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${tipo} copiado!`);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const compartilhar = async () => {
    if (!cobranca) return;
    const texto = `Boleto PRATIC - ${tipoLabels[cobranca.tipo] || cobranca.tipo}\nValor: ${formatCurrency(Number(cobranca.valor_final))}\nVencimento: ${format(new Date(cobranca.data_vencimento), "dd/MM/yyyy")}\n\nLinha digitável:\n${cobranca.linha_digitavel || 'Não disponível'}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Boleto PRATIC',
          text: texto,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      if (cobranca.linha_digitavel) {
        copiarTexto(cobranca.linha_digitavel, 'Linha digitável');
      }
    }
  };

  const getStatus = () => {
    if (!cobranca) return 'aguardando_pagamento';
    if (cobranca.status === 'pago') return 'pago';
    if (cobranca.status === 'cancelado') return 'cancelado';
    if (isPast(new Date(cobranca.data_vencimento)) && !isToday(new Date(cobranca.data_vencimento))) {
      return 'vencido';
    }
    return 'aguardando_pagamento';
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!cobranca) {
    return (
      <div className="p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/boletos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="mt-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">Boleto não encontrado</p>
        </div>
      </div>
    );
  }

  const status = getStatus();
  const config = statusConfig[status];
  const isPago = status === 'pago';
  const isVencido = status === 'vencido';

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <button 
        onClick={() => navigate('/app/boletos')} 
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Voltar</span>
      </button>

      {/* Card Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <Badge variant={config.variant} className="text-base px-4 py-2">
              {status === 'pago' && <CheckCircle className="h-4 w-4 mr-2" />}
              {status === 'vencido' && <AlertCircle className="h-4 w-4 mr-2" />}
              {status === 'aguardando_pagamento' && <Clock className="h-4 w-4 mr-2" />}
              {config.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Alerta de Vencido */}
      {isVencido && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Este boleto está vencido. Entre em contato para regularização.
          </AlertDescription>
        </Alert>
      )}

      {/* Card Valores */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Referência</p>
              <p className="font-medium">
                {cobranca.referencia_mes && cobranca.referencia_ano
                  ? `${String(cobranca.referencia_mes).padStart(2, '0')}/${cobranca.referencia_ano}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <p className="font-medium">{tipoLabels[cobranca.tipo] || cobranca.tipo}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(Number(cobranca.valor_final))}</p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Vencimento:</span>
            <span className={`font-medium ${isVencido ? 'text-destructive' : ''}`}>
              {format(new Date(cobranca.data_vencimento), "dd/MM/yyyy")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Card Pago */}
      {isPago && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  Boleto pago em {format(new Date(cobranca.data_pagamento!), "dd/MM/yyyy")}
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">
                  Valor pago: {formatCurrency(Number(cobranca.valor_pago))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card PIX */}
      {!isPago && cobranca.pix_copia_cola && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5" />
              Pague com PIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cobranca.pix_qrcode && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img 
                  src={cobranca.pix_qrcode} 
                  alt="QR Code PIX" 
                  className="w-48 h-48"
                />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Código Copia e Cola:</p>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-mono break-all">{cobranca.pix_copia_cola}</p>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={() => copiarTexto(cobranca.pix_copia_cola!, 'Código PIX')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Código PIX
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Use o app do seu banco para escanear o QR Code ou colar o código
            </p>
          </CardContent>
        </Card>
      )}

      {/* Card Boleto */}
      {!isPago && cobranca.linha_digitavel && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Ou pague com boleto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Linha Digitável:</p>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-mono break-all">{cobranca.linha_digitavel}</p>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={() => copiarTexto(cobranca.linha_digitavel!, 'Linha digitável')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Linha Digitável
            </Button>

            {cobranca.boleto_url && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(cobranca.boleto_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir PDF
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Descrição */}
      {cobranca.descricao && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{cobranca.descricao}</p>
          </CardContent>
        </Card>
      )}

      {/* Botão Compartilhar */}
      {!isPago && (
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={compartilhar}
        >
          <Share2 className="h-4 w-4 mr-2" />
          Compartilhar Boleto
        </Button>
      )}
    </div>
  );
}
