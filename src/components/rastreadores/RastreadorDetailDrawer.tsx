import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Pencil,
  Trash2,
  MapPin,
  MessageCircle,
  Radio,
  Car,
  User,
  Wifi,
  WifiOff,
  Wrench,
  Package,
  XCircle,
  Navigation,
} from 'lucide-react';
import {
  useRastreador,
  useUpdateRastreadorStatus,
  useDeleteRastreador,
  isRastreadorOnline,
  type StatusRastreador,
} from '@/hooks/useRastreadores';
import { STATUS_RASTREADOR_LABELS, STATUS_RASTREADOR_COLORS, PLATAFORMA_RASTREADOR_LABELS } from '@/types/database';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MapaRastreador } from './MapaRastreador';

interface RastreadorDetailDrawerProps {
  rastreadorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export function RastreadorDetailDrawer({
  rastreadorId,
  open,
  onOpenChange,
  onEdit,
}: RastreadorDetailDrawerProps) {
  const { data: rastreador, isLoading } = useRastreador(rastreadorId || undefined);
  const updateStatus = useUpdateRastreadorStatus();
  const deleteRastreador = useDeleteRastreador();

  const handleStatusChange = async (status: StatusRastreador) => {
    if (!rastreadorId) return;
    await updateStatus.mutateAsync({ id: rastreadorId, status });
  };

  const handleDelete = async () => {
    if (!rastreadorId) return;
    await deleteRastreador.mutateAsync(rastreadorId);
    onOpenChange(false);
  };

  const handleWhatsApp = () => {
    const telefone = rastreador?.veiculos?.associados?.telefone;
    if (!telefone) return;
    const numero = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${numero}`, '_blank');
  };

  const handleMaps = () => {
    if (!rastreador?.ultima_posicao_lat || !rastreador?.ultima_posicao_lng) return;
    window.open(
      `https://www.google.com/maps?q=${rastreador.ultima_posicao_lat},${rastreador.ultima_posicao_lng}`,
      '_blank'
    );
  };

  const isOnline = rastreador ? isRastreadorOnline(rastreador.ultima_comunicacao) : false;
  const isInstalled = rastreador?.status === 'instalado';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !rastreador ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Rastreador não encontrado</p>
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <SheetTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    {rastreador.codigo}
                  </SheetTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_RASTREADOR_COLORS[rastreador.status]}>
                      {STATUS_RASTREADOR_LABELS[rastreador.status]}
                    </Badge>
                    {isInstalled && (
                      <Badge
                        variant="outline"
                        className={
                          isOnline
                            ? 'border-green-500 text-green-600'
                            : 'border-destructive text-destructive'
                        }
                      >
                        {isOnline ? (
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
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={onEdit}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir rastreador?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O rastreador será removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="info" className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="mapa" disabled={!isInstalled}>
                  <Navigation className="h-4 w-4 mr-1" />
                  Rastreamento
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-6">
                {/* Informações Básicas */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Informações do Equipamento
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {rastreador.numero_serie && (
                      <div>
                        <span className="text-muted-foreground">Nº Série:</span>
                        <p className="font-medium">{rastreador.numero_serie}</p>
                      </div>
                    )}
                    {rastreador.imei && (
                      <div>
                        <span className="text-muted-foreground">IMEI:</span>
                        <p className="font-medium">{rastreador.imei}</p>
                      </div>
                    )}
                    {rastreador.chip_iccid && (
                      <div>
                        <span className="text-muted-foreground">ICCID:</span>
                        <p className="font-medium">{rastreador.chip_iccid}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Plataforma:</span>
                      <p className="font-medium">
                        {PLATAFORMA_RASTREADOR_LABELS[rastreador.plataforma] || rastreador.plataforma}
                      </p>
                    </div>
                    {rastreador.id_plataforma && (
                      <div>
                        <span className="text-muted-foreground">ID Plataforma:</span>
                        <p className="font-medium">{rastreador.id_plataforma}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Veículo Associado */}
                {rastreador.veiculos && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        Veículo Associado
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Placa:</span>
                          <span className="font-semibold">{rastreador.veiculos.placa}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Veículo:</span>
                          <span>
                            {rastreador.veiculos.marca} {rastreador.veiculos.modelo} {rastreador.veiculos.ano_modelo}
                          </span>
                        </div>
                        {rastreador.veiculos.cor && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Cor:</span>
                            <span>{rastreador.veiculos.cor}</span>
                          </div>
                        )}
                      </div>

                      {rastreador.veiculos.associados && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {rastreador.veiculos.associados.nome}
                            </span>
                          </div>
                          {rastreador.veiculos.associados.telefone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={handleWhatsApp}
                            >
                              <MessageCircle className="mr-2 h-4 w-4" />
                              WhatsApp
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <Separator />
                  </>
                )}

                {/* Última Comunicação */}
                {isInstalled && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        Última Comunicação
                      </h3>
                      {rastreador.ultima_comunicacao ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Data/Hora:</span>
                            <span>
                              {format(new Date(rastreador.ultima_comunicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Tempo:</span>
                            <span>
                              {formatDistanceToNow(new Date(rastreador.ultima_comunicacao), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          {rastreador.ultima_posicao_lat && rastreador.ultima_posicao_lng && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={handleMaps}
                            >
                              <MapPin className="mr-2 h-4 w-4" />
                              Ver no Google Maps
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma comunicação registrada
                        </p>
                      )}
                    </div>
                    <Separator />
                  </>
                )}

                {/* Ações Rápidas */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Ações Rápidas
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {rastreador.status === 'estoque' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange('manutencao')}
                        disabled={updateStatus.isPending}
                      >
                        <Wrench className="mr-2 h-4 w-4" />
                        Manutenção
                      </Button>
                    )}
                    {rastreador.status === 'manutencao' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange('estoque')}
                        disabled={updateStatus.isPending}
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Voltar Estoque
                      </Button>
                    )}
                    {rastreador.status === 'instalado' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange('manutencao')}
                          disabled={updateStatus.isPending}
                        >
                          <Wrench className="mr-2 h-4 w-4" />
                          Manutenção
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange('estoque')}
                          disabled={updateStatus.isPending}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          Desinstalar
                        </Button>
                      </>
                    )}
                    {rastreador.status !== 'baixado' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleStatusChange('baixado')}
                        disabled={updateStatus.isPending}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Baixar
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mapa" className="mt-4">
                {isInstalled && rastreadorId && (
                  <MapaRastreador 
                    rastreadorId={rastreadorId} 
                    altura="350px"
                    mostrarControles={true}
                  />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
