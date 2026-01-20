import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Phone, User, Calendar, Route, Play, CheckCircle, Plus, X, Loader2, Trash2, Users, ArrowRight, Wrench, ClipboardCheck } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useRota, 
  useUpdateRotaStatus,
  useDeleteRota,
  STATUS_ROTA_LABELS, 
  STATUS_ROTA_COLORS,
  type StatusRota,
  type RotaInstalador,
} from '@/hooks/useRotas';
import { useRotaRealtime } from '@/hooks/useRotasRealtime';
import { InstalacaoMiniCard } from './InstalacaoMiniCard';
import { VistoriaMiniCard } from './VistoriaMiniCard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface RotaDetailDrawerProps {
  rotaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddServicos?: () => void;
  onEdit?: () => void;
}

export function RotaDetailDrawer({ 
  rotaId, 
  open, 
  onOpenChange,
  onAddServicos,
  onEdit,
}: RotaDetailDrawerProps) {
  const queryClient = useQueryClient();
  const { data: rota, isLoading } = useRota(rotaId || undefined);
  const updateStatus = useUpdateRotaStatus();
  const deleteRota = useDeleteRota();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [updatingInstalacao, setUpdatingInstalacao] = useState<string | null>(null);

  // Ativar atualizações em tempo real para esta rota específica
  useRotaRealtime(open ? rotaId : null);

  const handleUpdateStatus = async (novoStatus: StatusRota) => {
    if (!rotaId) return;
    try {
      await updateStatus.mutateAsync({ id: rotaId, status: novoStatus });
      toast.success(`Rota ${STATUS_ROTA_LABELS[novoStatus].toLowerCase()}`);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDeleteRota = async () => {
    if (!rotaId) return;
    try {
      await deleteRota.mutateAsync(rotaId);
      toast.success('Rota excluída com sucesso');
      setShowDeleteDialog(false);
      onOpenChange(false);
    } catch {
      toast.error('Erro ao excluir rota');
    }
  };

  const handleChangeInstaladorResponsavel = async (instalacaoId: string, novoInstaladorId: string) => {
    setUpdatingInstalacao(instalacaoId);
    try {
      const { error } = await supabase
        .from('instalacoes')
        .update({ instalador_responsavel_id: novoInstaladorId })
        .eq('id', instalacaoId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['rota', rotaId] });
      toast.success('Instalador responsável atualizado!');
    } catch {
      toast.error('Erro ao atualizar instalador');
    } finally {
      setUpdatingInstalacao(null);
    }
  };

  const progresso = rota 
    ? rota.total_servicos > 0 
      ? Math.round((rota.total_concluidos / rota.total_servicos) * 100)
      : 0
    : 0;

  // Get all instaladores from the rota (N:N relationship)
  const instaladoresDaRota = rota?.rota_instaladores || [];
  const hasMultipleInstaladores = instaladoresDaRota.length > 1;

  // Contagem de serviços
  const totalInstalacoes = rota?.instalacoes?.length || 0;
  const totalVistorias = (rota as any)?.vistorias?.length || 0;
  const totalServicos = totalInstalacoes + totalVistorias;

  // Group instalacoes by instalador_responsavel
  const instalacoesPorInstalador = rota?.instalacoes?.reduce((acc, inst) => {
    const responsavelId = inst.instalador_responsavel_id || 'sem_responsavel';
    if (!acc[responsavelId]) {
      acc[responsavelId] = [];
    }
    acc[responsavelId].push(inst);
    return acc;
  }, {} as Record<string, typeof rota.instalacoes>);

  // Group vistorias by vistoriador
  const vistoriasPorInstalador = ((rota as any)?.vistorias || []).reduce((acc: Record<string, any[]>, vist: any) => {
    const responsavelId = vist.vistoriador_id || 'sem_responsavel';
    if (!acc[responsavelId]) {
      acc[responsavelId] = [];
    }
    acc[responsavelId].push(vist);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rota ? (
          <>
            <SheetHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  {rota.codigo}
                </SheetTitle>
                <Badge className={STATUS_ROTA_COLORS[rota.status as StatusRota]}>
                  {STATUS_ROTA_LABELS[rota.status as StatusRota]}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(rota.data_rota), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </div>
                {rota.cidade && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {rota.cidade}
                  </div>
                )}
              </div>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-200px)] pr-4">
              <div className="mt-6 space-y-6">
                {/* Instaladores */}
                {instaladoresDaRota.length > 0 ? (
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-3 text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {hasMultipleInstaladores ? 'Instaladores' : 'Instalador'}
                      {hasMultipleInstaladores && (
                        <Badge variant="secondary" className="ml-auto">
                          {instaladoresDaRota.length}
                        </Badge>
                      )}
                    </h4>
                    <div className="space-y-3">
                      {instaladoresDaRota.map((ri) => (
                        <div key={ri.id} className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{ri.instalador?.nome || 'Instalador'}</p>
                            {ri.instalador?.telefone && (
                              <p className="text-sm text-muted-foreground">{ri.instalador.telefone}</p>
                            )}
                          </div>
                          {ri.instalador?.telefone && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const phone = ri.instalador?.telefone?.replace(/\D/g, '');
                                window.open(`https://wa.me/55${phone}`, '_blank');
                              }}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : rota.instalador && (
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-3 text-sm font-medium text-muted-foreground">Instalador</h4>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{rota.instalador.nome}</p>
                        {rota.instalador.telefone && (
                          <p className="text-sm text-muted-foreground">{rota.instalador.telefone}</p>
                        )}
                      </div>
                      {rota.instalador.telefone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const phone = rota.instalador?.telefone?.replace(/\D/g, '');
                            window.open(`https://wa.me/55${phone}`, '_blank');
                          }}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Progresso */}
                <div className="rounded-lg border p-4">
                  <h4 className="mb-3 text-sm font-medium text-muted-foreground">Progresso</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{rota.total_concluidos} de {rota.total_servicos} serviços</span>
                      <span className="font-medium">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-2" />
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        {totalInstalacoes} instalação(ões)
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardCheck className="h-3 w-3" />
                        {totalVistorias} vistoria(s)
                      </span>
                    </div>
                  </div>
                </div>
                      <span className="font-medium">{progresso}%</span>
                    </div>
                    <Progress value={progresso} className="h-2" />
                  </div>
                </div>

                {/* Ações rápidas */}
                <div className="flex flex-wrap gap-2">
                  {rota.status === 'pendente' && (
                    <Button 
                      onClick={() => handleUpdateStatus('em_andamento')}
                      disabled={updateStatus.isPending}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Iniciar Rota
                    </Button>
                  )}
                  {rota.status === 'em_andamento' && (
                    <Button 
                      onClick={() => handleUpdateStatus('concluida')}
                      disabled={updateStatus.isPending}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Concluir Rota
                    </Button>
                  )}
                  {rota.status !== 'concluida' && rota.status !== 'cancelada' && (
                    <>
                      <Button variant="outline" onClick={onAddServicos}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Serviços
                      </Button>
                      <Button variant="outline" onClick={onEdit}>
                        Editar
                      </Button>
                    </>
                  )}
                  {rota.status === 'pendente' && (
                    <Button 
                      variant="destructive" 
                      onClick={() => handleUpdateStatus('cancelada')}
                      disabled={updateStatus.isPending}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  )}
                  {(rota.status === 'pendente' || rota.status === 'cancelada') && (
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Instalações - agrupadas por instalador se houver múltiplos */}
                <div>
                  <h4 className="mb-4 text-sm font-medium text-muted-foreground">
                    Instalações ({rota.instalacoes?.length || 0})
                  </h4>
                  
                  {rota.instalacoes?.length ? (
                    hasMultipleInstaladores ? (
                      // Mostrar agrupado por instalador
                      <div className="space-y-6">
                        {instaladoresDaRota.map((ri) => {
                          const instalacoesDoInstalador = instalacoesPorInstalador?.[ri.instalador_id] || [];
                          return (
                            <div key={ri.id} className="space-y-3">
                              <div className="flex items-center gap-2 text-sm">
                                <User className="h-4 w-4 text-primary" />
                                <span className="font-medium">{ri.instalador?.nome}</span>
                                <Badge variant="outline" className="ml-auto">
                                  {instalacoesDoInstalador.length}
                                </Badge>
                              </div>
                              {instalacoesDoInstalador.length > 0 ? (
                                <div className="space-y-2 ml-6">
                                  {instalacoesDoInstalador.map((instalacao) => (
                                    <div key={instalacao.id} className="relative">
                                      <InstalacaoMiniCard 
                                        instalacao={instalacao}
                                        rotaId={rota.id}
                                        showRemove={rota.status === 'pendente'}
                                      />
                                      {rota.status === 'pendente' && (
                                        <div className="mt-1 flex items-center gap-2 text-xs">
                                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                          <Select
                                            value={instalacao.instalador_responsavel_id || ''}
                                            onValueChange={(value) => handleChangeInstaladorResponsavel(instalacao.id, value)}
                                            disabled={updatingInstalacao === instalacao.id}
                                          >
                                            <SelectTrigger className="h-7 text-xs w-[180px]">
                                              <SelectValue placeholder="Mover para..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {instaladoresDaRota.map((inst) => (
                                                <SelectItem key={inst.instalador_id} value={inst.instalador_id}>
                                                  {inst.instalador?.nome}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground ml-6">
                                  Nenhuma instalação atribuída
                                </p>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Instalações sem responsável */}
                        {instalacoesPorInstalador?.['sem_responsavel']?.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-4 w-4" />
                              <span>Sem instalador atribuído</span>
                              <Badge variant="outline" className="ml-auto">
                                {instalacoesPorInstalador['sem_responsavel'].length}
                              </Badge>
                            </div>
                            <div className="space-y-2 ml-6">
                              {instalacoesPorInstalador['sem_responsavel'].map((instalacao) => (
                                <div key={instalacao.id} className="relative">
                                  <InstalacaoMiniCard 
                                    instalacao={instalacao}
                                    rotaId={rota.id}
                                    showRemove={rota.status === 'pendente'}
                                  />
                                  {rota.status === 'pendente' && (
                                    <div className="mt-1 flex items-center gap-2 text-xs">
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                      <Select
                                        value=""
                                        onValueChange={(value) => handleChangeInstaladorResponsavel(instalacao.id, value)}
                                        disabled={updatingInstalacao === instalacao.id}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-[180px]">
                                          <SelectValue placeholder="Atribuir a..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {instaladoresDaRota.map((inst) => (
                                            <SelectItem key={inst.instalador_id} value={inst.instalador_id}>
                                              {inst.instalador?.nome}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Mostrar lista simples
                      <div className="space-y-3">
                        {rota.instalacoes.map((instalacao) => (
                          <InstalacaoMiniCard 
                            key={instalacao.id} 
                            instalacao={instalacao}
                            rotaId={rota.id}
                            showRemove={rota.status === 'pendente'}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <Route className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nenhuma instalação vinculada
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={onAddInstalacoes}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Rota não encontrada</p>
          </div>
        )}
      </SheetContent>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Rota</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Tem certeza que deseja excluir a rota <strong>{rota?.codigo}</strong>?
                <br /><br />
                <strong>As seguintes ações serão realizadas:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>{rota?.instalacoes?.length || 0} instalação(ões) serão desvinculadas</li>
                  <li>A rota será removida permanentemente do sistema</li>
                </ul>
                <br />
                Esta ação não pode ser desfeita.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteRota}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRota.isPending}
            >
              {deleteRota.isPending ? 'Excluindo...' : 'Excluir Rota'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
