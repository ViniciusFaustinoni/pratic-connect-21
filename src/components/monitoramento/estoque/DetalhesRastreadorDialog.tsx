import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  Car,
  Wrench,
  XCircle,
  User,
  Cpu,
  Calendar,
  ArrowRight,
  History,
  Server,
} from 'lucide-react';
import { usePlataformasLabels } from '@/hooks/usePlataformasCRUD';

interface DetalhesRastreadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreadorId: string | null;
}

type StatusRastreador = 'estoque' | 'instalado' | 'manutencao' | 'baixado' | 'retorno_base' | 'triagem' | 'em_analise_plataforma' | 'em_garantia';

const statusConfig: Record<StatusRastreador, { label: string; icon: React.ElementType; color: string }> = {
  estoque: { label: 'Em Estoque', icon: Package, color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  instalado: { label: 'Instalado', icon: Car, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  manutencao: { label: 'Em Manutenção', icon: Wrench, color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  baixado: { label: 'Baixado', icon: XCircle, color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  retorno_base: { label: 'Retorno Base', icon: Package, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  triagem: { label: 'Em Triagem', icon: Package, color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  em_analise_plataforma: { label: 'Análise Plataforma', icon: Server, color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30' },
  em_garantia: { label: 'Em Garantia', icon: Package, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' },
};

const tipoMovimentacaoLabels: Record<string, string> = {
  entrada_estoque: 'Entrada no Estoque',
  saida_instalacao: 'Saída para Instalação',
  retorno_estoque: 'Retorno ao Estoque',
  envio_manutencao: 'Envio para Manutenção',
  baixa: 'Baixa',
  transferencia: 'Transferência',
  alteracao_status: 'Alteração de Status',
  atribuicao_portador: 'Atribuição de Portador',
  remocao_portador: 'Remoção de Portador',
  troca_portador: 'Troca de Portador',
};

export function DetalhesRastreadorDialog({ open, onOpenChange, rastreadorId }: DetalhesRastreadorDialogProps) {
  const { data: plataformasLabels } = usePlataformasLabels();

  // Query para buscar dados completos do rastreador
  const { data: rastreador, isLoading } = useQuery({
    queryKey: ['rastreador-detalhes', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          imei,
          numero_serie,
          plataforma,
          id_plataforma,
          status,
          ultima_comunicacao,
          created_at,
          updated_at,
          portador_id,
          portador:profiles!rastreadores_portador_id_fkey(id, nome),
          veiculo:veiculos!rastreadores_veiculo_id_fkey(
            id,
            placa,
            modelo,
            marca,
            associado:associados(id, nome, cpf)
          )
        `)
        .eq('id', rastreadorId!)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
  });

  // Query para buscar histórico de movimentações
  const { data: historico, isLoading: isLoadingHistorico } = useQuery({
    queryKey: ['rastreador-historico', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          id,
          tipo,
          quantidade,
          status_anterior,
          status_novo,
          nota_fiscal,
          observacoes,
          created_at,
          usuario:profiles!estoque_movimentacoes_usuario_id_fkey(nome)
        `)
        .eq('rastreador_id', rastreadorId!)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
  });

  const status = (rastreador?.status as StatusRastreador) || 'estoque';
  const config = statusConfig[status] || statusConfig.estoque;
  const StatusIcon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Detalhes do Rastreador</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : rastreador ? (
          <ScrollArea className="max-h-[calc(90vh-100px)]">
            <div className="p-6 pt-0 space-y-6">
              {/* Header Card */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-lg">{rastreador.codigo}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={config.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      {rastreador.plataforma && (
                        <Badge variant="secondary">
                          <Server className="h-3 w-3 mr-1" />
                          {plataformasLabels?.[rastreador.plataforma] || rastreador.plataforma}
                        </Badge>
                      )}
                    </div>
                    {rastreador.portador && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                        <User className="h-4 w-4" />
                        <span>Portador: {rastreador.portador.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Informações Técnicas */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Informações Técnicas
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="IMEI" value={rastreador.imei || '-'} mono />
                  <InfoRow label="Número de Série" value={rastreador.numero_serie || '-'} />
                  <InfoRow label="Plataforma" value={plataformasLabels?.[rastreador.plataforma] || rastreador.plataforma || '-'} />
                  <InfoRow label="ID na Plataforma" value={rastreador.id_plataforma || '-'} mono />
                </div>
              </div>

              {/* Veículo Vinculado */}
              {rastreador.veiculo && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Veículo Vinculado
                  </h3>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-primary" />
                      <span className="font-medium">{rastreador.veiculo.placa}</span>
                      {rastreador.veiculo.modelo && (
                        <span className="text-muted-foreground">
                          {rastreador.veiculo.marca} {rastreador.veiculo.modelo}
                        </span>
                      )}
                    </div>
                    {rastreador.veiculo.associado && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>{rastreador.veiculo.associado.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Datas */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Datas
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow 
                    label="Entrada no Sistema" 
                    value={rastreador.created_at ? format(new Date(rastreador.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'} 
                  />
                  <InfoRow 
                    label="Última Comunicação" 
                    value={rastreador.ultima_comunicacao ? format(new Date(rastreador.ultima_comunicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Sem comunicação'} 
                  />
                </div>
              </div>

              <Separator />

              {/* Histórico de Movimentações */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Movimentações
                </h3>
                {isLoadingHistorico ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : historico && historico.length > 0 ? (
                  <div className="space-y-2">
                    {historico.map((mov) => (
                      <div key={mov.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {tipoMovimentacaoLabels[mov.tipo] || mov.tipo}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(mov.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {mov.status_anterior && mov.status_novo && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <span>{statusConfig[mov.status_anterior as StatusRastreador]?.label || mov.status_anterior}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span>{statusConfig[mov.status_novo as StatusRastreador]?.label || mov.status_novo}</span>
                          </div>
                        )}
                        {mov.nota_fiscal && (
                          <div className="text-xs text-muted-foreground mt-1">
                            NF: {mov.nota_fiscal}
                          </div>
                        )}
                        {mov.observacoes && (
                          <p className="text-xs text-muted-foreground mt-1">{mov.observacoes}</p>
                        )}
                        {mov.usuario && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {mov.usuario.nome}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma movimentação registrada
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            Rastreador não encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</div>
    </div>
  );
}
