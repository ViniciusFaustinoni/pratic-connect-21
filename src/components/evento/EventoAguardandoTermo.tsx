import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Loader2, CheckCircle2, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';

interface Props {
  token: string;
  associado: { nome: string };
  autentiqueDocumentoId?: string | null;
  autentiqueUrl?: string | null;
  onAssinado: () => void;
}

export default function EventoAguardandoTermo({ token, associado, autentiqueDocumentoId, autentiqueUrl, onAssinado }: Props) {
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollingRef.current = setInterval(async () => {
      try {
        setChecking(true);
        const res = await publicSupabase.functions.invoke('processar-termo-evento', {
          body: { acao: 'verificar_termo', token },
        });
        if (res.data?.assinado) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          onAssinado();
        }
      } catch {
        // silent
      } finally {
        setChecking(false);
      }
    }, 10000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [token, onAssinado]);

  const handleCopy = () => {
    if (!autentiqueUrl) return;
    navigator.clipboard.writeText(autentiqueUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <FileText className="h-8 w-8 text-green-600" />
        </div>

        <h2 className="text-xl font-bold text-green-700">Pagamento Confirmado!</h2>

        <p className="text-muted-foreground text-sm">
          Olá {associado.nome}, clique no botão abaixo para acessar e assinar o{' '}
          <strong>Termo de Entrada de Evento</strong> digitalmente.
        </p>

        {autentiqueUrl ? (
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => window.open(autentiqueUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Acessar e Assinar Termo
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCopy}
            >
              {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Link Copiado!' : 'Copiar Link'}
            </Button>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">⏳ Gerando documento...</p>
            <p className="text-muted-foreground text-xs">
              O termo está sendo preparado. O botão para assinatura aparecerá em instantes.
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Aguardando assinatura do termo...
        </div>
      </CardContent>
    </Card>
  );
}
