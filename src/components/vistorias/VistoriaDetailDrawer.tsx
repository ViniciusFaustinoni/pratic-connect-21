import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Car,
  Calendar,
  Gauge,
  MessageSquare,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  MapPin,
  Clock,
} from 'lucide-react';
import { useVistoria, useFinalizarVistoriaComDecisao, VistoriaStatus } from '@/hooks/useVistorias';
import { VistoriaFotosView } from './VistoriaFotosView';
import { cn } from '@/lib/utils';

interface VistoriaDetailDrawerProps {
  vistoriaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<VistoriaStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  agendada: { label: 'Agendada', variant: 'outline' },
  em_analise: { label: 'Em Análise', variant: 'default' },
  aprovada: { label: 'Aprovada', variant: 'default' },
  reprovada: { label: 'Reprovada', variant: 'destructive' },
};

// Helper para formatar telefone
const formatarTelefone = (telefone: string | null) => {
  if (!telefone) return '';
  const nums = telefone.replace(/\D/g, '');
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
};

export function VistoriaDetailDrawer({
  vistoriaId,
  open,
  onOpenChange,
}: VistoriaDetailDrawerProps) {
  const { data: vistoria, isLoading } = useVistoria(vistoriaId);
  const finalizarVistoria = useFinalizarVistoriaComDecisao();

  const openWhatsApp = (phone?: string | null, nome?: string) => {
    if (!phone) return;
    const phoneClean = phone.replace(/\D/g, '');
    const message = nome 
      ? `Olá ${nome}! Entramos em contato sobre a vistoria agendada.`
      : `Olá! Entramos em contato sobre a vistoria do veículo.`;
    window.open(`https://wa.me/55${phoneClean}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleAprovar = () => {
    if (!vistoriaId) return;
    finalizarVistoria.mutate({
      id: vistoriaId,
      aceito: true,
      km_atual: vistoria?.km_atual || undefined,
      observacoes: vistoria?.observacoes || undefined,
    });
  };

  const handleReprovar = () => {
    if (!vistoriaId) return;
    finalizarVistoria.mutate({
      id: vistoriaId,
      aceito: false,
      km_atual: vistoria?.km_atual || undefined,
      observacoes: vistoria?.observacoes || undefined,
    });
  };

  const statusConfig = vistoria ? STATUS_CONFIG[vistoria.status] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <SheetTitle>Detalhes da Vistoria</SheetTitle>
            {statusConfig && (
              <Badge
                variant={statusConfig.variant}
                className={cn(
                  vistoria?.status === 'aprovada' && 'bg-emerald-600 hover:bg-emerald-700'
                )}
              >
                {statusConfig.label}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !vistoria ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Vistoria não encontrada
            </div>
          ) : (
            <div className="space-y-6">
              {/* Associado */}
              {vistoria.veiculo?.associado && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Cliente
                  </h3>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <p className="font-medium">{vistoria.veiculo.associado.nome}</p>
                    {vistoria.veiculo.associado.telefone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{vistoria.veiculo.associado.telefone}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-emerald-600"
                          onClick={() => openWhatsApp(vistoria.veiculo?.associado?.telefone, vistoria.veiculo?.associado?.nome)}
                        >
                          WhatsApp
                        </Button>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Veículo */}
              {vistoria.veiculo && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Veículo
                  </h3>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <p className="font-medium text-lg">{vistoria.veiculo.placa}</p>
                    <p className="text-sm text-muted-foreground">
                      {[vistoria.veiculo.marca, vistoria.veiculo.modelo]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                  </div>
                </section>
              )}


              {/* Informações */}
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Informações
                </h3>
                <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Criada em{' '}
                      {format(new Date(vistoria.created_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  {vistoria.km_atual && (
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Quilometragem: {vistoria.km_atual.toLocaleString('pt-BR')} km
                      </span>
                    </div>
                  )}

                  {vistoria.observacoes && (
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm">{vistoria.observacoes}</span>
                    </div>
                  )}
                </div>
              </section>

              <Separator />

              {/* Fotos */}
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Fotos ({vistoria.fotos?.length || 0})
                </h3>
                <VistoriaFotosView fotos={vistoria.fotos || []} />
              </section>
            </div>
          )}
        </ScrollArea>

        {/* Ações - só mostra para vistorias em análise */}
        {vistoria && vistoria.status === 'em_analise' && (
          <div className="p-4 border-t space-y-2">
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleAprovar}
                disabled={finalizarVistoria.isPending}
              >
                {finalizarVistoria.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Aprovar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleReprovar}
                disabled={finalizarVistoria.isPending}
              >
                {finalizarVistoria.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reprovar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
