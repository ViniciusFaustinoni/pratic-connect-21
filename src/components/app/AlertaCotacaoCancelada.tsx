import { AlertTriangle, XCircle, Phone, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AlertaCotacaoCanceladaProps {
  motivo?: string;
  data?: string;
  /** Variante: 'banner' para AppHome, 'card' para AppBoletos */
  variante?: 'banner' | 'card';
}

const formatarData = (data?: string) => {
  if (!data) return '';
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function AlertaCotacaoCancelada({ 
  motivo, 
  data, 
  variante = 'banner' 
}: AlertaCotacaoCanceladaProps) {
  
  const handleWhatsApp = () => {
    const mensagem = encodeURIComponent(
      'Olá! Gostaria de informações sobre minha cotação que foi cancelada por falta de pagamento.'
    );
    window.open(`https://wa.me/5511999999999?text=${mensagem}`, '_blank');
  };

  if (variante === 'card') {
    return (
      <Card className="border-0 shadow-sm bg-red-50 border-l-4 border-l-red-500">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-red-800">
                  Contratação Cancelada
                </p>
                <Badge variant="destructive" className="text-xs">
                  Pagamento não realizado
                </Badge>
              </div>
              <p className="text-sm text-red-700 mt-1">
                {motivo || 'Sua contratação foi cancelada por falta de pagamento da taxa de adesão.'}
              </p>
              {data && (
                <p className="text-xs text-red-600 mt-1">
                  Cancelada em {formatarData(data)}
                </p>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                onClick={handleWhatsApp}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Falar com consultor
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Variante banner (padrão)
  return (
    <Alert className="bg-red-50 border-red-200 border-l-4 border-l-red-500">
      <AlertTriangle className="h-5 w-5 text-red-600" />
      <AlertTitle className="text-red-800 font-semibold">
        Contratação Cancelada
      </AlertTitle>
      <AlertDescription className="text-red-700">
        <p>
          {motivo || 'Sua contratação foi cancelada por falta de pagamento da taxa de adesão.'}
        </p>
        {data && (
          <p className="text-xs text-red-600 mt-1">
            Cancelada em {formatarData(data)}
          </p>
        )}
        <p className="mt-2 font-medium">
          Entre em contato com seu consultor para solicitar uma nova cotação.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
          onClick={handleWhatsApp}
        >
          <Phone className="h-4 w-4 mr-2" />
          Falar com consultor
        </Button>
      </AlertDescription>
    </Alert>
  );
}
