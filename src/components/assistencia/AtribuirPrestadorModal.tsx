import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Search, Phone, Star, MapPin, CheckCircle, Truck, Loader2,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface Chamado {
  id: string;
  protocolo: string;
  tipo_servico: string;
  status: string;
  origem_endereco: string | null;
  origem_cidade: string | null;
  origem_uf: string | null;
}

interface Prestador {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cidade: string;
  estado: string;
  tipos_servico: string[] | null;
  nota_media: number | null;
  total_atendimentos: number | null;
  disponivel: boolean | null;
}

interface AtribuirPrestadorModalProps {
  open: boolean;
  onClose: () => void;
  chamado: Chamado | null;
}

const TIPOS_SERVICO_LABELS: Record<string, string> = {
  reboque: 'Reboque/Guincho',
  guincho: 'Reboque/Guincho',
  chaveiro: 'Chaveiro',
  troca_pneu: 'Troca de Pneu',
  pane_seca: 'Pane Seca',
  bateria: 'Bateria',
  outro: 'Outros',
};

const TIPOS_EQUIVALENTES: Record<string, string[]> = {
  guincho: ['guincho', 'reboque'],
  reboque: ['reboque', 'guincho'],
};

const expandirTipoServico = (tipo: string): string[] => {
  return TIPOS_EQUIVALENTES[tipo] || [tipo];
};

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
};

export function AtribuirPrestadorModal({ open, onClose, chamado }: AtribuirPrestadorModalProps) {
  const queryClient = useQueryClient();
  const [prestadorSelecionado, setPrestadorSelecionado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [apenasNaCidade, setApenasNaCidade] = useState(false);

  // Query: Buscar prestadores disponíveis
  const { data: prestadores, isLoading: carregandoPrestadores } = useQuery({
    queryKey: ['prestadores-disponiveis', chamado?.tipo_servico],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestadores_assistencia')
        .select('id, razao_social, nome_fantasia, telefone, whatsapp, cidade, estado, tipos_servico, nota_media, total_atendimentos, disponivel')
        .eq('status', 'ativo')
        .eq('disponivel', true)
        .overlaps('tipos_servico', expandirTipoServico(chamado!.tipo_servico))
        .order('nota_media', { ascending: false });

      if (error) throw error;
      return data as Prestador[];
    },
    enabled: !!chamado?.tipo_servico && open,
  });

  // Mutation: Atribuir prestador
  const atribuirMutation = useMutation({
    mutationFn: async (prestadorId: string) => {
      const user = await supabase.auth.getUser();
      const prestador = prestadores?.find(p => p.id === prestadorId);

      if (!prestador) throw new Error('Prestador não encontrado');

      // 1. Atualizar chamado com dados do prestador
      const { error: errorChamado } = await supabase
        .from('chamados_assistencia')
        .update({
          prestador_nome: prestador.nome_fantasia || prestador.razao_social,
          prestador_telefone: prestador.telefone,
          status: 'aguardando_prestador' as const,
          updated_at: new Date().toISOString()
        })
        .eq('id', chamado!.id);

      if (errorChamado) throw errorChamado;

      // 2. Criar registro de atendimento
      const { error: errorAtendimento } = await supabase
        .from('chamados_assistencia_atendimentos')
        .insert({
          chamado_id: chamado!.id,
          prestador_id: prestadorId,
          status: 'acionado',
          hora_acionamento: new Date().toISOString()
        });

      if (errorAtendimento) throw errorAtendimento;

      // 3. Registrar no histórico
      await supabase.from('chamados_assistencia_historico').insert({
        chamado_id: chamado!.id,
        status_anterior: chamado!.status,
        status_novo: 'aguardando_prestador',
        usuario_id: user.data.user?.id,
        observacao: `Prestador ${prestador.nome_fantasia || prestador.razao_social} acionado`
      });

      // 4. Notificar associado via WhatsApp
      try {
        await supabase.functions.invoke('notificar-status-assistencia', {
          body: {
            chamado_id: chamado!.id,
            status_novo: 'aguardando_prestador',
          },
        });
      } catch (notifError) {
        console.error('Erro ao enviar notificação:', notifError);
        // Não bloqueia o fluxo
      }

      return prestador;
    },
    onSuccess: (prestador) => {
      toast.success(`Prestador ${prestador.nome_fantasia || prestador.razao_social} acionado!`);
      queryClient.invalidateQueries({ queryKey: ['chamado', chamado?.id] });
      queryClient.invalidateQueries({ queryKey: ['chamado-atendimentos', chamado?.id] });
      queryClient.invalidateQueries({ queryKey: ['chamado-historico', chamado?.id] });
      queryClient.invalidateQueries({ queryKey: ['chamados-assistencia'] });
      queryClient.invalidateQueries({ queryKey: ['chamados-contadores'] });
      handleClose();
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao acionar prestador');
    }
  });

  // Filtrar prestadores
  const prestadoresFiltrados = useMemo(() => {
    if (!prestadores) return [];

    return prestadores.filter((p) => {
      // Filtro por nome
      if (filtro) {
        const termoLower = filtro.toLowerCase();
        const nomeMatch = (p.nome_fantasia?.toLowerCase().includes(termoLower) ||
                           p.razao_social.toLowerCase().includes(termoLower));
        if (!nomeMatch) return false;
      }

      // Filtro por cidade do chamado
      if (apenasNaCidade && chamado?.origem_cidade) {
        if (p.cidade?.toLowerCase() !== chamado.origem_cidade.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [prestadores, filtro, apenasNaCidade, chamado?.origem_cidade]);

  const handleClose = () => {
    setPrestadorSelecionado(null);
    setFiltro('');
    setApenasNaCidade(false);
    onClose();
  };

  if (!chamado) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Atribuir Prestador</DialogTitle>
          <DialogDescription>
            Chamado #{chamado.protocolo} - {TIPOS_SERVICO_LABELS[chamado.tipo_servico] || chamado.tipo_servico}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do chamado */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Localização do chamado</p>
                  <p className="font-medium">
                    {chamado.origem_endereco || 'Endereço não informado'}
                    {chamado.origem_cidade && ` - ${chamado.origem_cidade}`}
                    {chamado.origem_uf && `/${chamado.origem_uf}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                className="pl-9"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mesma-cidade"
                checked={apenasNaCidade}
                onCheckedChange={(checked) => setApenasNaCidade(checked === true)}
              />
              <label htmlFor="mesma-cidade" className="text-sm font-medium cursor-pointer">
                Apenas da mesma cidade
              </label>
            </div>
          </div>

          {/* Lista de prestadores */}
          <div className="space-y-2">
            <Label>Prestadores disponíveis ({prestadoresFiltrados.length})</Label>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {carregandoPrestadores ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))
                ) : prestadoresFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum prestador encontrado</p>
                    <p className="text-sm">Tente remover os filtros</p>
                  </div>
                ) : (
                  prestadoresFiltrados.map((prestador) => (
                    <Card
                      key={prestador.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary",
                        prestadorSelecionado === prestador.id && "border-primary ring-2 ring-primary/20"
                      )}
                      onClick={() => setPrestadorSelecionado(prestador.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className={cn(
                                "h-4 w-4",
                                prestador.disponivel ? "text-green-500" : "text-muted-foreground"
                              )} />
                              <span className="font-medium truncate">
                                {prestador.nome_fantasia || prestador.razao_social}
                              </span>
                            </div>

                            {prestador.telefone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {formatPhone(prestador.telefone)}
                              </div>
                            )}

                            {/* Tipos de serviço */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {prestador.tipos_servico?.slice(0, 3).map((tipo) => (
                                <Badge key={tipo} variant="outline" className="text-xs">
                                  {TIPOS_SERVICO_LABELS[tipo] || tipo}
                                </Badge>
                              ))}
                              {(prestador.tipos_servico?.length || 0) > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{(prestador.tipos_servico?.length || 0) - 3}
                                </Badge>
                              )}
                            </div>

                            {/* Rating e cidade */}
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              {prestador.nota_media != null && prestador.nota_media > 0 && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  <span>{prestador.nota_media.toFixed(1)}</span>
                                </div>
                              )}
                              {prestador.total_atendimentos != null && prestador.total_atendimentos > 0 && (
                                <span>{prestador.total_atendimentos} atendimentos</span>
                              )}
                              {prestador.cidade && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{prestador.cidade}/{prestador.estado}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            variant={prestadorSelecionado === prestador.id ? "default" : "outline"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrestadorSelecionado(prestador.id);
                            }}
                          >
                            {prestadorSelecionado === prestador.id ? 'Selecionado' : 'Selecionar'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => prestadorSelecionado && atribuirMutation.mutate(prestadorSelecionado)}
            disabled={!prestadorSelecionado || atribuirMutation.isPending}
          >
            {atribuirMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Acionando...
              </>
            ) : (
              'Confirmar Acionamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
