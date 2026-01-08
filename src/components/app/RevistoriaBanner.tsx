import { AlertTriangle, Camera, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface RevistoriaBannerProps {
  diasAtraso: number;
  status: 'pendente' | 'em_analise' | 'aprovada' | 'reprovada' | null;
}

export function RevistoriaBanner({ diasAtraso, status }: RevistoriaBannerProps) {
  // Status em análise
  if (status === 'em_analise') {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  📸 Revistoria em análise
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Aguardando aprovação
                </p>
              </div>
            </div>
            <Link to="/app/revistoria">
              <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-100">
                Ver status
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Atraso de 6+ dias - Revistoria obrigatória
  if (diasAtraso >= 6 && (status === 'pendente' || status === 'reprovada')) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  🚨 Revistoria obrigatória!
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Sua proteção está suspensa há {diasAtraso} dias
                </p>
              </div>
            </div>
            <Link to="/app/revistoria">
              <Button size="sm" className="bg-red-600 hover:bg-red-700">
                Fazer Revistoria
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Atraso de 1-5 dias - Suspensa, sem revistoria
  if (diasAtraso >= 1 && diasAtraso <= 5) {
    return (
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  ⚠️ Proteção suspensa
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Regularize o pagamento
                </p>
              </div>
            </div>
            <Link to="/app/boletos">
              <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                Ver boleto
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
