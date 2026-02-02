import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  MoreHorizontal,
  Package,
  Car,
  Wrench,
  XCircle,
  Eye,
  ArrowRightLeft,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  User,
  UserPlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePlataformasOptions, usePlataformasLabels } from '@/hooks/usePlataformasCRUD';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { AtribuirPortadorDialog } from './AtribuirPortadorDialog';

interface RastreadorListItem {
  id: string;
  codigo: string;
  imei: string;
  numero_serie: string | null;
  plataforma: string;
  status: 'estoque' | 'instalado' | 'manutencao' | 'baixado';
  created_at: string;
  ultima_comunicacao: string | null;
  portador_id: string | null;
  portador: {
    id: string;
    nome: string;
  } | null;
  veiculos: {
    placa: string;
    modelo: string | null;
  } | null;
}

type StatusRastreador = 'estoque' | 'instalado' | 'manutencao' | 'baixado';

const statusConfig: Record<StatusRastreador, { label: string; icon: React.ElementType; color: string }> = {
  estoque: { label: 'Estoque', icon: Package, color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  instalado: { label: 'Instalado', icon: Car, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  manutencao: { label: 'Manutenção', icon: Wrench, color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  baixado: { label: 'Baixado', icon: XCircle, color: 'bg-red-500/10 text-red-600 border-red-500/30' },
};

const ITEMS_PER_PAGE = 15;

export function ListaRastreadores() {
  const queryClient = useQueryClient();
  const { data: plataformas } = usePlataformasOptions();
  const { data: plataformasLabels } = usePlataformasLabels();
  const { data: profissionais } = useProfissionaisEquipe();
  
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [plataformaFiltro, setPlataformaFiltro] = useState<string>('todas');
  const [portadorFiltro, setPortadorFiltro] = useState<string>('todos');
  const [pagina, setPagina] = useState(1);
  const [dialogDetalhes, setDialogDetalhes] = useState<string | null>(null);
  const [dialogMudarStatus, setDialogMudarStatus] = useState<{ id: string; novoStatus: StatusRastreador } | null>(null);
  const [dialogAtribuirPortador, setDialogAtribuirPortador] = useState<{
    id: string;
    codigo: string;
    portador_id: string | null;
    portador_nome: string | null;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['lista-rastreadores', busca, statusFiltro, plataformaFiltro, portadorFiltro, pagina],
    queryFn: async () => {
      let query = supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          imei,
          numero_serie,
          plataforma,
          status,
          created_at,
          ultima_comunicacao,
          portador_id,
          portador:profiles!rastreadores_portador_id_fkey(id, nome),
          veiculos:veiculos!rastreadores_veiculo_id_fkey(placa, modelo)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((pagina - 1) * ITEMS_PER_PAGE, pagina * ITEMS_PER_PAGE - 1);

      if (busca) {
        query = query.or(`codigo.ilike.%${busca}%,imei.ilike.%${busca}%,numero_serie.ilike.%${busca}%`);
      }

      if (statusFiltro && statusFiltro !== 'todos') {
        query = query.eq('status', statusFiltro as StatusRastreador);
      }

      if (plataformaFiltro && plataformaFiltro !== 'todas') {
        query = query.eq('plataforma', plataformaFiltro);
      }

      if (portadorFiltro && portadorFiltro !== 'todos') {
        if (portadorFiltro === 'sem_portador') {
          query = query.is('portador_id', null);
        } else {
          query = query.eq('portador_id', portadorFiltro);
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        items: data as RastreadorListItem[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
      };
    },
  });

  const mudarStatusMutation = useMutation({
    mutationFn: async ({ id, novoStatus }: { id: string; novoStatus: StatusRastreador }) => {
      // Get current status
      const { data: rastreador } = await supabase
        .from('rastreadores')
        .select('status')
        .eq('id', id)
        .single();

      const statusAnterior = rastreador?.status;

      // Update status
      const { error: updateError } = await supabase
        .from('rastreadores')
        .update({ 
          status: novoStatus,
          veiculo_id: novoStatus !== 'instalado' ? null : undefined,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Create movement record
      await supabase.from('estoque_movimentacoes').insert({
        tipo: 'alteracao_status',
        quantidade: 1,
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        rastreador_id: id,
        observacoes: `Status alterado de ${statusAnterior} para ${novoStatus}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      toast.success('Status alterado com sucesso!');
      setDialogMudarStatus(null);
    },
    onError: (error) => {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    },
  });

  const limparFiltros = () => {
    setBusca('');
    setStatusFiltro('todos');
    setPlataformaFiltro('todas');
    setPortadorFiltro('todos');
    setPagina(1);
  };

  const temFiltros = busca || statusFiltro !== 'todos' || plataformaFiltro !== 'todas' || portadorFiltro !== 'todos';

  const getAcoesDisponiveis = (status: StatusRastreador) => {
    switch (status) {
      case 'estoque':
        return [
          { label: 'Enviar para Manutenção', status: 'manutencao' as StatusRastreador },
          { label: 'Dar Baixa', status: 'baixado' as StatusRastreador },
        ];
      case 'instalado':
        return [
          { label: 'Retornar ao Estoque', status: 'estoque' as StatusRastreador },
          { label: 'Enviar para Manutenção', status: 'manutencao' as StatusRastreador },
        ];
      case 'manutencao':
        return [
          { label: 'Retornar ao Estoque', status: 'estoque' as StatusRastreador },
          { label: 'Dar Baixa', status: 'baixado' as StatusRastreador },
        ];
      case 'baixado':
        return [
          { label: 'Reativar para Estoque', status: 'estoque' as StatusRastreador },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, IMEI ou série..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={statusFiltro} onValueChange={(v) => { setStatusFiltro(v); setPagina(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  {Object.entries(statusConfig).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={plataformaFiltro} onValueChange={(v) => { setPlataformaFiltro(v); setPagina(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {plataformas?.map((p) => (
                    <SelectItem key={p.codigo} value={p.codigo}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={portadorFiltro} onValueChange={(v) => { setPortadorFiltro(v); setPagina(1); }}>
                <SelectTrigger className="w-[160px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Portador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Portadores</SelectItem>
                  <SelectItem value="sem_portador">Sem Portador</SelectItem>
                  {profissionais?.filter(p => p.ativo).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {temFiltros && (
                <Button variant="ghost" size="icon" onClick={limparFiltros}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum rastreador encontrado</p>
              <p className="text-sm">Ajuste os filtros ou adicione novos rastreadores</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Portador</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((item) => {
                  const config = statusConfig[item.status];
                  const StatusIcon = config.icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.codigo}</TableCell>
                      <TableCell className="font-mono text-sm">{item.imei}</TableCell>
                      <TableCell>
                        {plataformasLabels?.[item.plataforma] || item.plataforma}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.portador ? (
                          <span className="flex items-center gap-1.5 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[120px]">{item.portador.nome}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.veiculos ? (
                          <span className="flex items-center gap-1">
                            <Car className="h-3 w-3" />
                            {item.veiculos.placa}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDialogDetalhes(item.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {item.status === 'estoque' && (
                              <DropdownMenuItem 
                                onClick={() => setDialogAtribuirPortador({
                                  id: item.id,
                                  codigo: item.codigo,
                                  portador_id: item.portador_id,
                                  portador_nome: item.portador?.nome || null,
                                })}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                {item.portador_id ? 'Alterar Portador' : 'Atribuir Portador'}
                              </DropdownMenuItem>
                            )}
                            {getAcoesDisponiveis(item.status).map((acao) => (
                              <DropdownMenuItem
                                key={acao.status}
                                onClick={() => setDialogMudarStatus({ id: item.id, novoStatus: acao.status })}
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                {acao.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {((pagina - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(pagina * ITEMS_PER_PAGE, data.total)} de {data.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(p => p - 1)}
                  disabled={pagina === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm px-2">
                  {pagina} de {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagina(p => p + 1)}
                  disabled={pagina === data.totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Change Dialog */}
      <AlertDialog open={!!dialogMudarStatus} onOpenChange={() => setDialogMudarStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alteração de Status</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja alterar o status deste rastreador para{' '}
              <strong>{dialogMudarStatus && statusConfig[dialogMudarStatus.novoStatus].label}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dialogMudarStatus && mudarStatusMutation.mutate(dialogMudarStatus)}
              disabled={mudarStatusMutation.isPending}
            >
              {mudarStatusMutation.isPending ? 'Alterando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Atribuir Portador Dialog */}
      <AtribuirPortadorDialog
        open={!!dialogAtribuirPortador}
        onOpenChange={() => setDialogAtribuirPortador(null)}
        rastreador={dialogAtribuirPortador}
      />
    </div>
  );
}
