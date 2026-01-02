import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReceiptText, ChevronRight, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Boleto {
  id: string;
  valor: number;
  vencimento: Date;
  status: 'pago' | 'aberto' | 'vencido';
  referencia: string;
}

export default function AppBoletos() {
  // Mock data
  const boletos: Boleto[] = [
    {
      id: '1',
      valor: 189.90,
      vencimento: new Date(2026, 0, 15),
      status: 'aberto',
      referencia: 'Janeiro/2026',
    },
    {
      id: '2',
      valor: 189.90,
      vencimento: new Date(2025, 11, 15),
      status: 'pago',
      referencia: 'Dezembro/2025',
    },
    {
      id: '3',
      valor: 189.90,
      vencimento: new Date(2025, 10, 15),
      status: 'pago',
      referencia: 'Novembro/2025',
    },
  ];

  const getStatusBadge = (status: Boleto['status']) => {
    switch (status) {
      case 'pago':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <CheckCircle className="mr-1 h-3 w-3" />
            Pago
          </Badge>
        );
      case 'aberto':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            <Clock className="mr-1 h-3 w-3" />
            Aberto
          </Badge>
        );
      case 'vencido':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Vencido
          </Badge>
        );
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Boletos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus boletos e pagamentos
        </p>
      </div>

      {boletos.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ReceiptText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold text-foreground">Nenhum boleto</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Seus boletos aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {boletos.map((boleto) => (
            <Link key={boleto.id} to={`/app/boletos/${boleto.id}`}>
              <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <ReceiptText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground">
                        R$ {boleto.valor.toFixed(2).replace('.', ',')}
                      </p>
                      {getStatusBadge(boleto.status)}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{boleto.referencia}</span>
                      <span>•</span>
                      <span>Venc: {formatDate(boleto.vencimento)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
