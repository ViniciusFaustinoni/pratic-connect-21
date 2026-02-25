import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  token: string;
  terceiro: {
    acordo_valor?: number;
    acordo_justificativa?: string;
    acordo_status?: string;
  };
  onRefresh: () => void;
}

export function TerceiroAcordo({ token, terceiro, onRefresh }: Props) {
  const [salvando, setSalvando] = useState(false);

  if (terceiro.acordo_status === 'aceito') {
    return (
      <Card className="border-green-300">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle className="h-10 w-10 mx-auto text-green-600" />
          <h3 className="font-semibold">Acordo Aceito</h3>
          <p className="text-sm text-muted-foreground">
            Valor: R$ {terceiro.acordo_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (terceiro.acordo_status === 'recusado') {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6 text-center space-y-3">
          <XCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">Acordo Recusado</h3>
          <p className="text-sm text-muted-foreground">O reparo seguirá normalmente.</p>
        </CardContent>
      </Card>
    );
  }

  const handleResponder = async (aceitar: boolean) => {
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke('salvar-etapa-terceiro', {
        body: { token, acao: 'responder_acordo', dados: { aceitar } },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success(aceitar ? 'Acordo aceito!' : 'Acordo recusado. Seguiremos com o reparo.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao responder');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className="border-amber-300">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Proposta de Acordo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          A Pratic enviou uma proposta de acordo. Em vez do reparo, você receberia um valor em dinheiro para resolver por conta própria.
        </p>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-primary">
            R$ {terceiro.acordo_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {terceiro.acordo_justificativa && (
          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
            {terceiro.acordo_justificativa}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Se aceitar, você receberá o valor e a Pratic não fará o reparo.
          Se recusar, o reparo seguirá normalmente na oficina.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            disabled={salvando}
            onClick={() => handleResponder(false)}
          >
            {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
            Quero o reparo
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={salvando}
            onClick={() => handleResponder(true)}
          >
            {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            Aceitar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
