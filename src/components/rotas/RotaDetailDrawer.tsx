import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Phone, User, Calendar, Route, Play, CheckCircle, Plus, X, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useRota, 
  useUpdateRotaStatus, 
  STATUS_ROTA_LABELS, 
  STATUS_ROTA_COLORS,
  type StatusRota 
} from '@/hooks/useRotas';
import { InstalacaoMiniCard } from './InstalacaoMiniCard';
import { toast } from 'sonner';

interface RotaDetailDrawerProps {
  rotaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddInstalacoes?: () => void;
  onEdit?: () => void;
}

export function RotaDetailDrawer({ 
  rotaId, 
  open, 
  onOpenChange,
  onAddInstalacoes,
  onEdit,
}: RotaDetailDrawerProps) {
  const { data: rota, isLoading } = useRota(rotaId || undefined);
  const updateStatus = useUpdateRotaStatus();

  const handleUpdateStatus = async (novoStatus: StatusRota) => {
    if (!rotaId) return;
    try {
      await updateStatus.mutateAsync({ id: rotaId, status: novoStatus });
      toast.success(`Rota ${STATUS_ROTA_LABELS[novoStatus].toLowerCase()}`);
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const progresso = rota 
    ? rota.total_servicos > 0 
      ? Math.round((rota.total_concluidos / rota.total_servicos) * 100)
      : 0
    : 0;

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
                  {format(new Date(rota.data_rota), "EEEE, dd 'de' MMMM", { locale: ptBR })}
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
                {/* Instalador */}
                {rota.instalador && (
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
                      <span>{rota.total_concluidos} de {rota.total_servicos} instalações</span>
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
                      <Button variant="outline" onClick={onAddInstalacoes}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Instalações
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
                </div>

                <Separator />

                {/* Instalações */}
                <div>
                  <h4 className="mb-4 text-sm font-medium text-muted-foreground">
                    Instalações ({rota.instalacoes?.length || 0})
                  </h4>
                  
                  {rota.instalacoes?.length ? (
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
    </Sheet>
  );
}
