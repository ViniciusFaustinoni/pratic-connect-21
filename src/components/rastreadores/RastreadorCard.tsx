import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  Wifi,
  WifiOff,
  Eye,
  Wrench,
  MapPin,
  Car,
  User,
  Radio,
  Gauge,
  Zap,
  PackageMinus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isRastreadorOnline, type RastreadorWithRelations } from '@/hooks/useRastreadores';
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
}: RastreadorCardProps) {
  const isInstalled = rastreador.status === 'instalado';
  const isEstoque = rastreador.status === 'estoque';
  const online = isInstalled && isRastreadorOnline(rastreador.ultima_comunicacao);
  const offline = isInstalled && !online;

  // Calcular tempo desde última comunicação
  const getLastCommText = () => {
    if (!rastreador.ultima_comunicacao) return 'Sem comunicação';
    try {
      return `há ${formatDistanceToNow(new Date(rastreador.ultima_comunicacao), { locale: ptBR })}`;
    } catch {
      return 'Data inválida';
    }
  };

  // Determinar cor da barra de status
  const getStatusBarColor = () => {
    if (!isInstalled) return 'bg-gradient-to-r from-muted to-muted/50';
    if (online) return 'bg-gradient-to-r from-emerald-500 to-emerald-400';
    return 'bg-gradient-to-r from-red-500 to-red-400';
  };

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
          isSelected && "ring-2 ring-primary",
          offline && "border-red-500/30"
        )}
        onClick={onViewDetails}
      >
        {/* Barra de status de comunicação */}
        <div className={cn("h-1.5", getStatusBarColor())} />

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
            
            {isInstalled && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
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
            )}

            <Badge variant="outline" className="text-xs">
              {plataformaLabel}
            </Badge>
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
            </div>
          )}

          {/* Portador (para estoque) */}
          {isEstoque && rastreador.portador && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Portador:</span>
                <span className="font-medium truncate">{rastreador.portador.nome}</span>
              </div>
            </div>
          )}

          {/* Dados de comunicação (apenas se instalado) */}
          {isInstalled && (
            <div className="space-y-2 pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" />
                      <span>{rastreador.ultima_velocidade ?? 0} km/h</span>
                    </TooltipTrigger>
                    <TooltipContent>Última velocidade</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <Zap className={cn(
                        "h-3.5 w-3.5",
                        rastreador.ultima_ignicao ? "text-emerald-500" : "text-muted-foreground"
                      )} />
                      <span>{rastreador.ultima_ignicao ? 'Ligado' : 'Desligado'}</span>
                    </TooltipTrigger>
                    <TooltipContent>Ignição</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <p className="text-xs">
                Última comunicação: <span className={offline ? "text-red-500 font-medium" : ""}>{getLastCommText()}</span>
              </p>
            </div>
          )}

          {/* Ações rápidas */}
          <div className="flex gap-2 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
