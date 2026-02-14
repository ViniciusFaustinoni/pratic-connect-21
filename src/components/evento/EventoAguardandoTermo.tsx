import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicSupabase } from '@/integrations/supabase/publicClient';

interface Props {
  token: string;
  associado: { nome: string };
  autentiqueDocumentoId?: string | null;
  onAssinado: () => void;
}

export default function EventoAguardandoTermo({ token, associado, autentiqueDocumentoId, onAssinado }: Props) {
  const [checking, setChecking] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Poll every 10s
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

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <FileText className="h-8 w-8 text-green-600" />
        </div>

        <h2 className="text-xl font-bold text-green-700">Pagamento Confirmado!</h2>

        <p className="text-muted-foreground text-sm">
          Olá {associado.nome}, enviamos o <strong>Termo de Entrada de Evento</strong> para
          assinatura digital via <strong>Autentique</strong>.
        </p>

        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium">📧 Verifique seu e-mail e WhatsApp</p>
          <p className="text-muted-foreground text-xs">
            Você receberá um link da Autentique para assinar o termo digitalmente.
            Após a assinatura, esta página será atualizada automaticamente.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Aguardando assinatura do termo...
        </div>
      </CardContent>
    </Card>
  );
}
