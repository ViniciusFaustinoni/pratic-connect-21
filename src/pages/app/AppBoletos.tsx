import { Card, CardContent } from '@/components/ui/card';
import { ReceiptText } from 'lucide-react';

export default function AppBoletos() {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Boletos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus boletos e pagamentos
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ReceiptText className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-semibold text-foreground">Nenhum boleto</h3>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Seus boletos aparecerão aqui quando disponíveis
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
