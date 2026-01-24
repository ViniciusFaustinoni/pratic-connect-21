import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  UserPlus, 
  Wrench, 
  CheckCircle2, 
  XCircle, 
  ArrowRightLeft,
  Loader2,
  History
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Movimentacao {
  id: string;
  tipo: string;
  quantidade: number;
  status_anterior: string | null;
  status_novo: string | null;
  observacoes: string | null;
  created_at: string;
  usuario: { id: string; nome: string } | null;
  veiculo: { placa: string } | null;
}

interface HistoricoMovimentacoesRastreadorProps {
  rastreadorId: string;
}

const TIPO_ICONS: Record<string, React.ElementType> = {
  entrada: Package,
  atribuicao_portador: UserPlus,
  remocao_portador: UserPlus,
  instalacao: CheckCircle2,
  manutencao: Wrench,
  baixa: XCircle,
  transferencia: ArrowRightLeft,
};

const TIPO_LABELS: Record<string, string> = {
  entrada: 'Entrada no Estoque',
  atribuicao_portador: 'Atribuído a Portador',
  remocao_portador: 'Removido do Portador',
  instalacao: 'Instalação',
  manutencao: 'Manutenção',
  baixa: 'Baixa',
  transferencia: 'Transferência',
};

const TIPO_COLORS: Record<string, string> = {
  entrada: 'bg-green-500/10 text-green-600 border-green-500/30',
  atribuicao_portador: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  remocao_portador: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  instalacao: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  manutencao: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  baixa: 'bg-red-500/10 text-red-600 border-red-500/30',
  transferencia: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
};

export function HistoricoMovimentacoesRastreador({ rastreadorId }: HistoricoMovimentacoesRastreadorProps) {
  const { data: movimentacoes, isLoading } = useQuery({
    queryKey: ['rastreador-movimentacoes', rastreadorId],
    enabled: !!rastreadorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          id,
          tipo,
          quantidade,
          status_anterior,
          status_novo,
          observacoes,
          created_at,
          usuario:profiles!estoque_movimentacoes_usuario_id_fkey(id, nome),
          veiculo:veiculos(placa)
        `)
        .eq('rastreador_id', rastreadorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Movimentacao[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!movimentacoes || movimentacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Nenhuma movimentação registrada</p>
        <p className="text-xs text-muted-foreground mt-1">
          O histórico aparecerá aqui quando houver alterações
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[350px] pr-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-4">
          {movimentacoes.map((mov, index) => {
            const Icon = TIPO_ICONS[mov.tipo] || ArrowRightLeft;
            const label = TIPO_LABELS[mov.tipo] || mov.tipo;
            const color = TIPO_COLORS[mov.tipo] || 'bg-muted text-muted-foreground border-border';

            return (
              <div key={mov.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className={`absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center ${color}`}>
                  <Icon className="h-3 w-3" />
                </div>

                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <Badge variant="outline" className={color}>
                        {label}
                      </Badge>
                      {mov.status_anterior && mov.status_novo && (
                        <p className="text-xs text-muted-foreground">
                          {mov.status_anterior} → {mov.status_novo}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(mov.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  {mov.observacoes && (
                    <p className="text-sm text-muted-foreground">
                      {mov.observacoes}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {mov.usuario?.nome && (
                      <span>Por: <span className="font-medium">{mov.usuario.nome}</span></span>
                    )}
                    {mov.veiculo?.placa && (
                      <span>Veículo: <span className="font-medium">{mov.veiculo.placa}</span></span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
