import { useState, useEffect } from 'react';
import { CreditCard, QrCode, Loader2, Check, Copy, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PagamentoAdesaoProps {
  contratoId: string;
  valorAdesao: number;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf: string;
  onPagamentoConfirmado: () => void;
}

interface CobrancaData {
  id: string;
  pixCopiaECola?: string;
  pixQrCode?: string;
  boletoUrl?: string;
  linhaDigitavel?: string;
  status: string;
}

export function PagamentoAdesao({ 
  contratoId, 
  valorAdesao, 
  clienteNome, 
  clienteEmail, 
  clienteCpf,
  onPagamentoConfirmado 
}: PagamentoAdesaoProps) {
  const [cobranca, setCobranca] = useState<CobrancaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);

  // Criar cobrança ao montar componente
  useEffect(() => {
    criarCobranca();
  }, []);

  // Polling para verificar pagamento
  useEffect(() => {
    if (!cobranca) return;

    const interval = setInterval(async () => {
      await verificarPagamento();
    }, 10000); // Verificar a cada 10 segundos

    return () => clearInterval(interval);
  }, [cobranca]);

  const criarCobranca = async () => {
    try {
      setLoading(true);
      
      // Chamar edge function para criar cobrança no Asaas
      const { data, error } = await supabase.functions.invoke('asaas-cobranca-adesao', {
        body: {
          contratoId,
          valor: valorAdesao,
          cliente: {
            nome: clienteNome,
            email: clienteEmail,
            cpfCnpj: clienteCpf?.replace(/\D/g, ''),
          },
        },
      });

      if (error) throw error;

      setCobranca({
        id: data.cobranca_id,
        pixCopiaECola: data.pix_copia_cola,
        pixQrCode: data.pix_qrcode,
        boletoUrl: data.boleto_url,
        linhaDigitavel: data.linha_digitavel,
        status: 'PENDING',
      });
    } catch (error: any) {
      console.error('Erro ao criar cobrança:', error);
      toast.error('Erro ao gerar cobrança. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const verificarPagamento = async () => {
    if (!cobranca) return;

    try {
      setVerificando(true);
      
      // Verificar status no banco de dados
      const { data, error } = await supabase
        .from('contratos')
        .select('adesao_paga')
        .eq('id', contratoId)
        .single();

      if (error) throw error;

      if (data.adesao_paga) {
        toast.success('Pagamento confirmado!');
        onPagamentoConfirmado();
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
    } finally {
      setVerificando(false);
    }
  };

  const handleCopiarPix = () => {
    if (cobranca?.pixCopiaECola) {
      navigator.clipboard.writeText(cobranca.pixCopiaECola);
      toast.success('Código PIX copiado!');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Gerando cobrança...</p>
        </CardContent>
      </Card>
    );
  }

  if (!cobranca) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-destructive mb-4">Erro ao gerar cobrança</p>
          <Button onClick={criarCobranca}>Tentar Novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pagamento da Adesão
        </CardTitle>
        <CardDescription>
          Valor: <span className="font-bold text-foreground text-lg">{formatCurrency(valorAdesao)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code PIX */}
        {cobranca.pixQrCode && (
          <div className="text-center space-y-4">
            <div className="bg-white p-4 rounded-lg inline-block">
              <img 
                src={`data:image/png;base64,${cobranca.pixQrCode}`} 
                alt="QR Code PIX" 
                className="w-48 h-48 mx-auto"
              />
            </div>
            
            <p className="text-sm text-muted-foreground">
              Escaneie o QR Code com o app do seu banco
            </p>
          </div>
        )}

        {/* PIX Copia e Cola */}
        {cobranca.pixCopiaECola && (
          <div className="space-y-2">
            <label className="text-sm font-medium">PIX Copia e Cola</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={cobranca.pixCopiaECola}
                className="flex-1 px-3 py-2 rounded-md border bg-muted text-xs font-mono truncate"
              />
              <Button variant="outline" size="icon" onClick={handleCopiarPix}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Boleto */}
        {cobranca.boletoUrl && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Ou pague via boleto bancário:
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href={cobranca.boletoUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="mr-2 h-4 w-4" />
                Baixar Boleto
              </a>
            </Button>
          </div>
        )}

        {/* Status */}
        <div className="bg-muted/50 p-4 rounded-lg text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {verificando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando pagamento...
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4" />
                Aguardando pagamento...
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            O status será atualizado automaticamente após o pagamento
          </p>
        </div>

        {/* Verificar Manualmente */}
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={verificarPagamento}
          disabled={verificando}
        >
          {verificando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Já paguei, verificar
        </Button>
      </CardContent>
    </Card>
  );
}
