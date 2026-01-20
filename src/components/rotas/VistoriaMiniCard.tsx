import { Car, MapPin, User, X, Sunrise, Sun, Moon, ClipboardCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDesvincularServicoRota } from '@/hooks/useServicosRota';
import { toast } from 'sonner';
import { TIPO_VISTORIA_LABELS, TIPO_VISTORIA_COLORS, type TipoVistoria } from '@/types/servicos-rota';

const STATUS_VISTORIA_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  agendada: 'Agendada',
  em_rota: 'Em Rota',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  em_analise: 'Em Análise',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  cancelada: 'Cancelada',
};

const STATUS_VISTORIA_COLORS: Record<string, string> = {
  pendente: 'bg-muted text-muted-foreground',
  agendada: 'bg-muted text-muted-foreground',
  em_rota: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  em_andamento: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  em_analise: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  aprovada: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  reprovada: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  cancelada: 'bg-destructive/10 text-destructive',
};

const PERIODO_ICONS: Record<string, React.ElementType> = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

const PERIODO_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

interface VistoriaMiniCardProps {
  vistoria: {
    id: string;
    tipo?: string | null;
    origem?: string | null;
    status?: string | null;
    periodo?: string | null;
    endereco_logradouro?: string | null;
    endereco_numero?: string | null;
    endereco_bairro?: string | null;
    endereco_cidade?: string | null;
    associados?: { id: string; nome: string; telefone?: string | null } | null;
    veiculos?: { id: string; placa: string; marca?: string | null; modelo?: string | null } | null;
  };
  rotaId?: string;
  showRemove?: boolean;
  onSelect?: () => void;
}

export function VistoriaMiniCard({ vistoria, rotaId, showRemove, onSelect }: VistoriaMiniCardProps) {
  const desvincular = useDesvincularServicoRota();
  
  const periodo = vistoria.periodo || 'manha';
  const PeriodoIcon = PERIODO_ICONS[periodo] || Sunrise;
  const tipoVistoria = vistoria.tipo as TipoVistoria;

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rotaId) return;
    
    try {
      await desvincular.mutateAsync({ 
        id: vistoria.id, 
        tipo_servico: 'vistoria'
      });
      toast.success('Vistoria removida da rota');
    } catch {
      toast.error('Erro ao remover vistoria');
    }
  };

  return (
    <Card 
      className="cursor-pointer p-3 transition-colors hover:bg-muted/50 border-l-4 border-l-amber-500 dark:border-l-amber-400"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          {tipoVistoria && (
            <Badge className={TIPO_VISTORIA_COLORS[tipoVistoria]}>
              {TIPO_VISTORIA_LABELS[tipoVistoria] || tipoVistoria}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <PeriodoIcon className="h-3 w-3" />
            {PERIODO_LABELS[periodo]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_VISTORIA_COLORS[vistoria.status || 'pendente']}>
            {STATUS_VISTORIA_LABELS[vistoria.status || 'pendente']}
          </Badge>
          {showRemove && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={handleRemove}
              disabled={desvincular.isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {vistoria.associados && (
        <div className="mt-2 flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{vistoria.associados.nome}</span>
        </div>
      )}

      {vistoria.veiculos && (
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Car className="h-4 w-4" />
          <span>
            {vistoria.veiculos.placa} • {vistoria.veiculos.marca} {vistoria.veiculos.modelo}
          </span>
        </div>
      )}

      {(vistoria.endereco_logradouro || vistoria.endereco_cidade) && (
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="truncate">
            {[vistoria.endereco_logradouro, vistoria.endereco_numero, vistoria.endereco_bairro, vistoria.endereco_cidade]
              .filter(Boolean)
              .join(', ')}
          </span>
        </div>
      )}
    </Card>
  );
}
