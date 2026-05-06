import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Eye,
  Wrench,
  MapPin,
  Car,
  User,
  Radio,
  PackageMinus,
  PackageCheck,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type RastreadorWithRelations } from '@/hooks/useRastreadores';
import { STATUS_RASTREADOR_LABELS, STATUS_RASTREADOR_COLORS } from '@/types/database';
import { motion } from 'framer-motion';

interface RastreadorCardProps {
  rastreador: RastreadorWithRelations;
  plataformaLabel: string;
  isSelected?: boolean;
  onSelect?: (checked: boolean) => void;
  onViewDetails: () => void;
  onMaintenance?: () => void;
  onWithdraw?: () => void;
  onViewMap?: () => void;
  onChangeStatus?: (rastreadorId: string, novoStatus: 'estoque' | 'em_garantia') => void;
}

export function RastreadorCard({
  rastreador,
  plataformaLabel,
  isSelected,
  onSelect,
  onViewDetails,
  onMaintenance,
  onWithdraw,
  onViewMap,
  onChangeStatus,
}: RastreadorCardProps) {
  const isInstalled = rastreador.status === 'instalado';
  const isEstoque = rastreador.status === 'estoque';
  const isRetornoBase = rastreador.status === 'retorno_base';
  const isEmGarantia = rastreador.status === 'em_garantia';
  const isTriagem = rastreador.status === 'triagem';
  const showPortador = (isEstoque || isRetornoBase || isEmGarantia || isTriagem) && rastreador.portador;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <Card 
        className={cn(
          "group overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer",
          isSelected && "ring-2 ring-primary"
        )}
        onClick={onViewDetails}
      >
        {/* Barra de status */}
        <div className="h-1.5 bg-gradient-to-r from-muted to-muted/50" />

        <CardContent className="p-4 space-y-4">
          {/* Header: Código + Badges + Checkbox */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10">
                <Radio className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-base truncate">{rastreador.codigo}</p>
                <p className="text-xs text-muted-foreground truncate font-mono">
                  {rastreador.imei || 'Sem IMEI'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isEstoque && onSelect && (
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={onSelect}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Badges de status */}
          <div className="flex flex-wrap gap-2">
            <Badge className={cn("text-xs", STATUS_RASTREADOR_COLORS[rastreador.status])}>
              {STATUS_RASTREADOR_LABELS[rastreador.status]}
            </Badge>
            
            <Badge variant="outline" className="text-xs">
              {plataformaLabel}
            </Badge>

            {(rastreador as any).softruck_integration_status === 'DIVERGENCIA_DESVINCULO' && (
              <Badge className="text-xs bg-amber-500 hover:bg-amber-500 text-white">
                Divergência Softruck
              </Badge>
            )}
          </div>

          {/* Informações do Veículo/Associado */}
          {rastreador.veiculos && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{rastreador.veiculos.placa}</span>
                {rastreador.veiculos.modelo && (
                  <span className="text-muted-foreground truncate">
                    {rastreador.veiculos.marca} {rastreador.veiculos.modelo}
                  </span>
                )}
              </div>
              
              {rastreador.veiculos.associados && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate text-muted-foreground">
                    {rastreador.veiculos.associados.nome}
                  </span>
                </div>
              )}

              {/* Local de instalação */}
              {isInstalled && rastreador.local_instalacao && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                        <span className="truncate text-muted-foreground">
                          {rastreador.local_instalacao.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          {rastreador.descricao_instalacao && ` - ${rastreador.descricao_instalacao}`}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-medium">{rastreador.local_instalacao.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                      {rastreador.descricao_instalacao && <p className="text-xs mt-1">{rastreador.descricao_instalacao}</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}

          {/* Portador (para estoque, retorno_base, em_garantia, triagem) */}
          {showPortador && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Portador:</span>
                <span className="font-medium truncate">{rastreador.portador!.nome}</span>
              </div>
            </div>
          )}

          {/* Ações rápidas */}
          <div className="flex gap-2 pt-3 border-t flex-wrap" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onViewDetails}
            >
              <Eye className="h-4 w-4" />
              Detalhes
            </Button>

            {isInstalled && onMaintenance && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={onMaintenance}
                    >
                      <Wrench className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Enviar para Manutenção</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {isInstalled && onWithdraw && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={onWithdraw}
                    >
                      <PackageMinus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Retirar Rastreador</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {onViewMap && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={onViewMap}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver no Mapa</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Ações para rastreadores em retorno_base */}
            {isRetornoBase && onChangeStatus && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => onChangeStatus(rastreador.id, 'estoque')}
                      >
                        <PackageCheck className="h-4 w-4" />
                        Disponível
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Devolver ao estoque</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        onClick={() => onChangeStatus(rastreador.id, 'em_garantia')}
                      >
                        <Truck className="h-4 w-4" />
                        Fornecedor
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enviar para fornecedor/garantia</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}

            {/* Ações para rastreadores em garantia */}
            {isEmGarantia && onChangeStatus && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => onChangeStatus(rastreador.id, 'estoque')}
                    >
                      <PackageCheck className="h-4 w-4" />
                      Disponível
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Devolver ao estoque</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
