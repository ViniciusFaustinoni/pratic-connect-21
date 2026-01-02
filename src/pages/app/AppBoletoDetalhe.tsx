import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Copy, CheckCircle, QrCode, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AppBoletoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Mock data
  const boleto = {
    id,
    valor: 189.90,
    vencimento: new Date(2026, 0, 15),
    status: 'aberto' as 'aberto' | 'pago' | 'vencido',
    referencia: 'Janeiro/2026',
    linhaDigitavel: '23793.38128 60000.000003 00000.000406 1 84340000018990',
    pixCopiaCola: '00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleCopyLinhaDigitavel = async () => {
    try {
      await navigator.clipboard.writeText(boleto.linhaDigitavel.replace(/\s/g, ''));
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar código');
    }
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(boleto.pixCopiaCola);
      toast.success('Código PIX copiado!');
    } catch {
      toast.error('Erro ao copiar código PIX');
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Boleto</h1>
          <p className="text-sm text-muted-foreground">{boleto.referencia}</p>
        </div>
      </div>

      {/* Value Card */}
      <Card className="border-0 bg-primary text-primary-foreground shadow-sm">
        <CardContent className="p-6 text-center">
          <p className="text-sm opacity-80">Valor do boleto</p>
          <p className="text-3xl font-bold">
            R$ {boleto.valor.toFixed(2).replace('.', ',')}
          </p>
          <p className="mt-2 text-sm opacity-80">
            Vencimento: {formatDate(boleto.vencimento)}
          </p>
          <Badge className="mt-3 bg-white/20 text-white hover:bg-white/30">
            {boleto.status === 'pago' ? 'Pago' : 'Em aberto'}
          </Badge>
        </CardContent>
      </Card>

      {boleto.status !== 'pago' && (
        <>
          {/* PIX */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-5 w-5 text-primary" />
                Pagar com PIX
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center rounded-lg bg-muted p-4">
                <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-white">
                  <QrCode className="h-24 w-24 text-foreground" />
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleCopyPix}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar código PIX
              </Button>
            </CardContent>
          </Card>

          {/* Código de Barras */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ReceiptText className="h-5 w-5 text-primary" />
                Código de barras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="break-all text-center font-mono text-sm text-foreground">
                  {boleto.linhaDigitavel}
                </p>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleCopyLinhaDigitavel}
              >
                {copied ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar linha digitável
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
