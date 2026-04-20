import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Car, MapPin, User, X, Sunrise, Sun, Moon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRemoveInstalacaoFromRota } from '@/hooks/useRotas';
import { toast } from 'sonner';
import type { Tables, Database } from '@/integrations/supabase/types';
import { STATUS_INSTALACAO_LABELS, STATUS_INSTALACAO_COLORS, type StatusInstalacao } from '@/types/database';

type PeriodoInstalacao = Database['public']['Enums']['periodo_instalacao'];

const PERIODO_ICONS: Record<PeriodoInstalacao, React.ElementType> = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

const PERIODO_LABELS: Record<PeriodoInstalacao, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

interface InstalacaoMiniCardProps {
  instalacao: Tables<'instalacoes'> & {
    associados?: Tables<'associados'> | null;
    veiculos?: Tables<'veiculos'> | null;
  };
  rotaId?: string;
  showRemove?: boolean;
  onSelect?: () => void;
}

export function InstalacaoMiniCard({ instalacao, rotaId, showRemove, onSelect }: InstalacaoMiniCardProps) {
  const removeFromRota = useRemoveInstalacaoFromRota();
  
  const PeriodoIcon = PERIODO_ICONS[instalacao.periodo as PeriodoInstalacao];

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rotaId) return;
    
    try {
      await removeFromRota.mutateAsync({ 
        instalacaoId: instalacao.id, 
        rotaId 
      });
      toast.success('Instalação removida da rota');
    } catch {
      toast.error('Erro ao remover instalação');
    }
  };

  return (
    <Card 
      className="cursor-pointer p-3 transition-colors hover:bg-muted/50"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <PeriodoIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {PERIODO_LABELS[instalacao.periodo as PeriodoInstalacao]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_INSTALACAO_COLORS[instalacao.status as StatusInstalacao]}>
            {STATUS_INSTALACAO_LABELS[instalacao.status as StatusInstalacao]}
          </Badge>
          {showRemove && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={handleRemove}
              disabled={removeFromRota.isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {instalacao.associados && (
        <div className="mt-2 flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{instalacao.associados.nome}</span>
        </div>
      )}

      {instalacao.veiculos && (
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Car className="h-4 w-4" />
          <span>
            {instalacao.veiculos.placa} • {instalacao.veiculos.marca} {instalacao.veiculos.modelo}
          </span>
        </div>
      )}

      {(instalacao.logradouro || instalacao.cidade) && (
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="truncate">
            {[instalacao.logradouro, instalacao.numero, instalacao.bairro, instalacao.cidade]
              .filter(Boolean)
              .join(', ')}
          </span>
        </div>
      )}
    </Card>
  );
}
