import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Car, MapPin, User, X, Sunrise, Sun, Moon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRemoveInstalacaoFromRota } from '@/hooks/useRotas';
import { toast } from 'sonner';
import type { Tables, Database } from '@/integrations/supabase/types';

type StatusInstalacao = Database['public']['Enums']['status_instalacao'];
type PeriodoInstalacao = Database['public']['Enums']['periodo_instalacao'];

const STATUS_INSTALACAO_LABELS: Record<StatusInstalacao, string> = {
  agendada: 'Agendada',
  em_rota: 'Em Rota',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
  em_analise: 'Em Análise',
};

const STATUS_INSTALACAO_COLORS: Record<StatusInstalacao, string> = {
  agendada: 'bg-muted text-muted-foreground',
  em_rota: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  em_andamento: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  reagendada: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  cancelada: 'bg-destructive/10 text-destructive',
  em_analise: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
};

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
