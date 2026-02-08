import { Radio, Loader2, Plus, Wifi, WifiOff, MoreHorizontal, Eye, Pencil, Wrench, PackageMinus, Trash2, UserPlus, Package, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isRastreadorOnline, type RastreadorWithRelations } from '@/hooks/useRastreadores';
import { STATUS_RASTREADOR_LABELS, STATUS_RASTREADOR_COLORS } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RastreadorTableViewProps {
  rastreadores: RastreadorWithRelations[] | undefined;
  isLoading: boolean;
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onOpenDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onMaintenance: (rastreador: RastreadorWithRelations) => void;
  onWithdraw: (rastreador: RastreadorWithRelations) => void;
  onAssignPortador: (rastreador: RastreadorWithRelations) => void;
  onDelete: (rastreador: RastreadorWithRelations) => void;
  onNewRastreador: () => void;
  getPlataformaLabel: (codigo: string) => string;
  isDiretor: boolean;
  onViewMap?: (rastreadorId: string) => void;
}

export function RastreadorTableView({
  rastreadores,
  isLoading,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onOpenDetails,
  onEdit,
  onMaintenance,
  onWithdraw,
  onAssignPortador,
  onDelete,
  onNewRastreador,
  getPlataformaLabel,
  isDiretor,
  onViewMap,
}: RastreadorTableViewProps) {
  const rastreadoresEstoque = rastreadores?.filter(r => r.status === 'estoque') || [];

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rastreadores || rastreadores.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <Radio className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum rastreador</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre rastreadores para monitorar
          </p>
          <Button className="mt-4" onClick={onNewRastreador}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Rastreador
          </Button>
        </div>
      </div>
    );
  }

  const getLastCommText = (ultimaComunicacao: string | null) => {
    if (!ultimaComunicacao) return '-';
    try {
      return formatDistanceToNow(new Date(ultimaComunicacao), { locale: ptBR, addSuffix: true });
    } catch {
      return '-';
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={rastreadoresEstoque.length > 0 && selectedIds.size === rastreadoresEstoque.length}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
                aria-label="Selecionar todos"
                disabled={rastreadoresEstoque.length === 0}
              />
            </TableHead>
            <TableHead className="min-w-[180px]">IMEI / Código</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="min-w-[200px]">Veículo / Associado</TableHead>
            <TableHead>Comunicação</TableHead>
            <TableHead className="w-[70px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rastreadores.map((rastreador) => {
            const isInstalled = rastreador.status === 'instalado';
            const online = isRastreadorOnline(rastreador.ultima_comunicacao);
            const isEstoque = rastreador.status === 'estoque';
            const offline = isInstalled && !online;

            return (
              <TableRow 
                key={rastreador.id} 
                className={cn(
                  selectedIds.has(rastreador.id) && 'bg-muted/50',
                  offline && 'bg-red-500/5'
                )}
              >
                <TableCell>
                  {isEstoque ? (
                    <Checkbox
                      checked={selectedIds.has(rastreador.id)}
                      onCheckedChange={(checked) => onSelectOne(rastreador.id, !!checked)}
                      aria-label={`Selecionar ${rastreador.codigo}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="w-4" />
                  )}
                </TableCell>
                
                {/* IMEI / Código combinado */}
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-pointer" onClick={() => onOpenDetails(rastreador.id)}>
                          <span className="font-mono text-sm font-medium block">
                            {rastreador.imei || rastreador.codigo}
                          </span>
                          {rastreador.imei && rastreador.codigo !== rastreador.imei && (
                            <span className="text-xs text-muted-foreground">
                              Cód: {rastreador.codigo}
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Código: {rastreador.codigo}</p>
                        <p>IMEI: {rastreador.imei || '-'}</p>
                        <p>Série: {rastreador.numero_serie || '-'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>

                <TableCell className="text-sm">
                  {getPlataformaLabel(rastreador.plataforma)}
                </TableCell>

                <TableCell>
                  <Badge className={cn("text-xs", STATUS_RASTREADOR_COLORS[rastreador.status])}>
                    {STATUS_RASTREADOR_LABELS[rastreador.status]}
                  </Badge>
                </TableCell>

                {/* Veículo / Associado combinado */}
                <TableCell>
                  {rastreador.veiculos ? (
                    <div>
                      <span className="font-medium">{rastreador.veiculos.placa}</span>
                      {rastreador.veiculos.modelo && (
                        <span className="text-muted-foreground ml-2 text-sm">
                          {rastreador.veiculos.modelo}
                        </span>
                      )}
                      {rastreador.veiculos.associados && (
                        <span className="block text-xs text-muted-foreground truncate max-w-[200px]">
                          {rastreador.veiculos.associados.nome}
                        </span>
                      )}
                    </div>
                  ) : isEstoque ? (
                    <div className="flex items-center gap-1">
                      {rastreador.portador?.nome ? (
                        <>
                          <span className="text-sm">{rastreador.portador.nome}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignPortador(rastreador);
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssignPortador(rastreador);
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          Atribuir
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>

                {/* Comunicação com destaque visual */}
                <TableCell>
                  {isInstalled ? (
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs w-fit",
                          online
                            ? "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                            : "border-red-500 text-red-600 bg-red-500/10"
                        )}
                      >
                        {online ? (
                          <>
                            <Wifi className="mr-1 h-3 w-3" /> Online
                          </>
                        ) : (
                          <>
                            <WifiOff className="mr-1 h-3 w-3" /> Offline
                          </>
                        )}
                      </Badge>
                      <span className={cn(
                        "text-xs",
                        offline ? "text-red-500" : "text-muted-foreground"
                      )}>
                        {getLastCommText(rastreador.ultima_comunicacao)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>

                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenDetails(rastreador.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(rastreador.id)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      {isEstoque && (
                        <DropdownMenuItem onClick={() => onOpenDetails(rastreador.id)}>
                          <Package className="mr-2 h-4 w-4" />
                          Ver Estoque
                        </DropdownMenuItem>
                      )}
                      {isInstalled && (
                        <>
                          <DropdownMenuSeparator />
                          {onViewMap && (
                            <DropdownMenuItem onClick={() => onViewMap(rastreador.id)}>
                              <MapPin className="mr-2 h-4 w-4" />
                              Ver no Mapa
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-amber-600"
                            onClick={() => onMaintenance(rastreador)}
                          >
                            <Wrench className="mr-2 h-4 w-4" />
                            Enviar para Manutenção
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onWithdraw(rastreador)}
                          >
                            <PackageMinus className="mr-2 h-4 w-4" />
                            Retirar Rastreador
                          </DropdownMenuItem>
                        </>
                      )}
                      {isDiretor && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(rastreador)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
