import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User, RefreshCw } from 'lucide-react';

interface CotacaoVendedorProps {
  vendedor?: {
    id?: string;
    nome?: string;
    email?: string;
  } | null;
  onTrocarVendedor?: () => void;
}

export function CotacaoVendedor({ vendedor, onTrocarVendedor }: CotacaoVendedorProps) {
  if (!vendedor) return null;

  const initials = vendedor.nome
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'V';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Responsável
          </CardTitle>
          {onTrocarVendedor && (
            <Button variant="ghost" size="sm" onClick={onTrocarVendedor}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Trocar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="overflow-hidden">
            <p className="font-medium truncate">{vendedor.nome}</p>
            <p className="text-sm text-muted-foreground truncate">
              {vendedor.email}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
