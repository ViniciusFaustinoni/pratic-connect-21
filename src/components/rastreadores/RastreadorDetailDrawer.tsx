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
  Lock,
  Unlock,
  RefreshCw,
  Camera,
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
import { MapaHistorico } from './MapaHistorico';
import { BotaoRedefinirSenha } from './BotaoRedefinirSenha';
import { HistoricoCompletoRastreador } from './HistoricoCompletoRastreador';
import { ComandoRastreadorDialog } from './ComandoRastreadorDialog';
import { HistoricoComandos } from './HistoricoComandos';
import { SubstituirEquipamentoDialog } from './SubstituirEquipamentoDialog';
import { useEnviarComando } from '@/hooks/useComandosRastreador';
import { VisualizadorFoto } from '@/components/analise/VisualizadorFoto';
import { AlertTriangle } from 'lucide-react';

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
  const enviarComando = useEnviarComando();

  const [comandoDialog, setComandoDialog] = useState<{
    open: boolean;
    tipo: 'bloquear' | 'desbloquear';
  }>({ open: false, tipo: 'bloquear' });

  const [substituirDialogOpen, setSubstituirDialogOpen] = useState(false);
  const [fotoViewerOpen, setFotoViewerOpen] = useState(false);

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

  const handleComandoConfirm = async (motivo: string) => {
    if (!rastreadorId) return;
    await enviarComando.mutateAsync({
      rastreador_id: rastreadorId,
      tipo_comando: comandoDialog.tipo,
      motivo,
      origem: 'monitoramento',
    });
    setComandoDialog({ open: false, tipo: 'bloquear' });
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
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="mapa" disabled={!isInstalled}>
                  Rastreamento
                </TabsTrigger>
                <TabsTrigger value="historico" disabled={!isInstalled}>
                  Trajeto
                </TabsTrigger>
                <TabsTrigger value="movimentacoes">
                  Histórico
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

                {/* Local de Instalação - sempre visível */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Local de Instalação
                  </h3>
                  {(rastreador.local_instalacao || rastreador.descricao_instalacao || rastreador.foto_local_instalacao_url) ? (
                    <div className="flex gap-4 items-start">
                      {/* Foto à esquerda */}
                      {rastreador.foto_local_instalacao_url ? (
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => setFotoViewerOpen(true)}
                            className="block"
                          >
                            <img
                              src={rastreador.foto_local_instalacao_url}
                              alt="Local de instalação"
                              className="w-28 h-28 rounded-lg border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          </button>
                          <VisualizadorFoto
                            fotos={[{ url: rastreador.foto_local_instalacao_url, label: 'Local de Instalação' }]}
                            indexInicial={0}
                            open={fotoViewerOpen}
                            onClose={() => setFotoViewerOpen(false)}
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-28 h-28 rounded-lg border border-dashed border-yellow-300 bg-yellow-50 flex items-center justify-center">
                          <div className="text-center">
                            <Camera className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                            <span className="text-[10px] text-yellow-600 font-medium">Foto pendente</span>
                          </div>
                        </div>
                      )}

                      {/* Texto à direita */}
                      <div className="flex-1 space-y-2 min-w-0">
                        {rastreador.local_instalacao ? (
                          <Badge variant="secondary" className="text-xs">
                            {rastreador.local_instalacao.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300 bg-yellow-50">
                            Local não informado
                          </Badge>
                        )}

                        {rastreador.descricao_instalacao ? (
                          <p className="text-sm text-muted-foreground">
                            {rastreador.descricao_instalacao}
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-600 italic">
                            Descrição pendente de preenchimento
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Local de instalação não registrado</p>
                        <p className="text-xs text-yellow-600">Informação pendente de preenchimento</p>
                      </div>
                    </div>
                  )}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSubstituirDialogOpen(true)}
                          disabled={updateStatus.isPending}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Substituir
                        </Button>
                        {rastreador.veiculos?.associados && (
                          <BotaoRedefinirSenha
                            rastreadorId={rastreadorId!}
                            nomeAssociado={rastreador.veiculos.associados.nome}
                          />
                        )}
                        {/* Botões de Bloqueio/Desbloqueio */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setComandoDialog({ open: true, tipo: 'bloquear' })}
                          disabled={enviarComando.isPending}
                        >
                          <Lock className="mr-2 h-4 w-4" />
                          Bloquear
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setComandoDialog({ open: true, tipo: 'desbloquear' })}
                          disabled={enviarComando.isPending}
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          Desbloquear
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

              <TabsContent value="historico" className="mt-4">
                {isInstalled && rastreadorId && (
                  <MapaHistorico 
                    rastreadorId={rastreadorId} 
                    altura="300px"
                  />
                )}
              </TabsContent>

              <TabsContent value="movimentacoes" className="mt-4">
                {rastreadorId && (
                  <HistoricoCompletoRastreador rastreadorId={rastreadorId} />
                )}
              </TabsContent>

              {/* Aba de Comandos (opcional - para histórico) */}
            </Tabs>

            {/* Dialog de Comando */}
            {rastreador && (
              <ComandoRastreadorDialog
                open={comandoDialog.open}
                onOpenChange={(open) => setComandoDialog(prev => ({ ...prev, open }))}
                tipoComando={comandoDialog.tipo}
                rastreador={{
                  id: rastreador.id,
                  codigo: rastreador.codigo,
                  plataforma: rastreador.plataforma,
                }}
                veiculo={rastreador.veiculos ? {
                  placa: rastreador.veiculos.placa,
                  marca: rastreador.veiculos.marca,
                  modelo: rastreador.veiculos.modelo,
                } : null}
                associado={rastreador.veiculos?.associados ? {
                  nome: rastreador.veiculos.associados.nome,
                } : null}
                onConfirm={handleComandoConfirm}
                isLoading={enviarComando.isPending}
                origem="monitoramento"
              />
            )}

            {/* Dialog de Substituição */}
            <SubstituirEquipamentoDialog
              open={substituirDialogOpen}
              onOpenChange={setSubstituirDialogOpen}
              rastreadorAtual={rastreador}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
