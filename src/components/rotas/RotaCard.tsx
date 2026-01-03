import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, MapPin, User, Phone, Route } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  STATUS_ROTA_LABELS, 
  STATUS_ROTA_COLORS,
  type RotaWithRelations,
  type StatusRota 
} from '@/hooks/useRotas';

interface RotaCardProps {
  rota: RotaWithRelations;
  onClick?: () => void;
}

export function RotaCard({ rota, onClick }: RotaCardProps) {
  const progresso = rota.total_servicos > 0 
    ? Math.round((rota.total_concluidos / rota.total_servicos) * 100)
    : 0;

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rota.instalador?.telefone) {
      const phone = rota.instalador.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  return (
    <Card 
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{rota.codigo}</span>
          </div>
          <Badge className={STATUS_ROTA_COLORS[rota.status as StatusRota]}>
            {STATUS_ROTA_LABELS[rota.status as StatusRota]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(new Date(rota.data_rota), "dd/MM/yyyy", { locale: ptBR })}
          </div>
          {rota.cidade && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {rota.cidade}
            </div>
          )}
        </div>

        {rota.instalador && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{rota.instalador.nome}</span>
            </div>
            {rota.instalador.telefone && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={handleWhatsApp}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {rota.total_concluidos} / {rota.total_servicos} instalações
            </span>
            <span className="font-medium">{progresso}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
