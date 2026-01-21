import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowLeft, Clock, Phone, Truck, Wrench, CheckCircle,
  XCircle, MapPin, MessageSquare, Car, RefreshCw, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const origemIcon = new L.DivIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-lg">
    <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>
  </div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const destinoIcon = new L.DivIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full border-2 border-white shadow-lg">
    <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
  </div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface Chamado {
  id: string;
  protocolo: string;
  status: string;
  tipo_servico: string;
  descricao: string | null;
  origem_endereco: string | null;
  origem_logradouro: string | null;
  origem_cidade: string | null;
  origem_uf: string | null;
  origem_lat: number | null;
  origem_lng: number | null;
  destino_lat: number | null;
  destino_lng: number | null;
  destino_endereco: string | null;
  prestador_nome: string | null;
  prestador_telefone: string | null;
  data_abertura: string;
  data_conclusao: string | null;
  avaliacao_nota: number | null;
  veiculo: {
    placa: string;
    marca: string;
    modelo: string;
  } | null;
}

interface HistoricoEvento {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  observacao: string | null;
  created_at: string;
}

const statusConfig: Record<string, {
  icon: React.ElementType;
  label: string;
  descricao: string;
  cor: string;
  bgGradient: string;
  animacao: boolean;
}> = {
  aberto: {
    icon: Clock,
    label: 'Aguardando',
    descricao: 'Buscando prestador disponível',
    cor: 'yellow',
    bgGradient: 'from-amber-400 to-orange-500',
    animacao: true
  },
  aguardando_prestador: {
    icon: Phone,
    label: 'Acionando',
    descricao: 'Prestador sendo acionado',
    cor: 'orange',
    bgGradient: 'from-orange-400 to-amber-500',
    animacao: true
  },
  prestador_despachado: {
    icon: Truck,
    label: 'Despachado',
    descricao: 'Prestador confirmou o atendimento',
    cor: 'blue',
    bgGradient: 'from-blue-400 to-indigo-500',
    animacao: true
  },
  prestador_a_caminho: {
    icon: Truck,
    label: 'A caminho',
    descricao: 'Prestador está indo até você',
    cor: 'blue',
    bgGradient: 'from-blue-500 to-emerald-500',
    animacao: true
  },
  em_atendimento: {
    icon: Wrench,
    label: 'Em atendimento',
    descricao: 'Serviço sendo realizado',
    cor: 'purple',
    bgGradient: 'from-emerald-500 to-teal-600',
    animacao: true
  },
  concluido: {
    icon: CheckCircle,
    label: 'Concluído',
    descricao: 'Assistência finalizada com sucesso',
    cor: 'green',
    bgGradient: 'from-green-500 to-green-600',
    animacao: false
  },
  cancelado_associado: {
    icon: XCircle,
    label: 'Cancelado',
    descricao: 'Você cancelou este chamado',
    cor: 'red',
    bgGradient: 'from-gray-400 to-gray-500',
    animacao: false
  },
  cancelado_sistema: {
    icon: XCircle,
    label: 'Cancelado',
    descricao: 'Chamado cancelado pelo sistema',
    cor: 'red',
    bgGradient: 'from-gray-400 to-gray-500',
    animacao: false
  },
};

const getTipoServicoLabel = (tipo: string) => {
  const tipos: Record<string, string> = {
    reboque: 'Reboque/Guincho',
    chaveiro: 'Chaveiro',
    troca_pneu: 'Troca de Pneu',
    pane_seca: 'Falta de Combustível',
    bateria: 'Bateria',
    outro: 'Outros',
  };
  return tipos[tipo] || tipo;
};

const getStatusLabel = (status: string) => {
  return statusConfig[status]?.label || status;
};

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (['concluido'].includes(status)) return 'default';
  if (['cancelado_associado', 'cancelado_sistema'].includes(status)) return 'destructive';
  if (['prestador_a_caminho', 'em_atendimento'].includes(status)) return 'secondary';
  return 'outline';
};

const podeCancelar = (status: string) => {
  return ['aberto', 'aguardando_prestador'].includes(status);
};

// Etapas fixas da timeline
const etapasFixas = [
  { id: 'aberto', label: 'Chamado aberto', icon: Clock },
  { id: 'aguardando_prestador', label: 'Prestador designado', icon: Phone },
  { id: 'prestador_a_caminho', label: 'A caminho', icon: Truck },
  { id: 'em_atendimento', label: 'Em atendimento', icon: Wrench },
  { id: 'concluido', label: 'Concluído', icon: CheckCircle },
];

const statusOrdem = ['aberto', 'aguardando_prestador', 'prestador_despachado', 'prestador_a_caminho', 'em_atendimento', 'concluido'];

export default function AcompanharChamado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Query principal - dados do chamado
  const { data: chamado, isLoading } = useQuery({
    queryKey: ['meu-chamado', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select(`
          *,
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Chamado;
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  // Query - histórico de eventos
  const { data: historico } = useQuery({
    queryKey: ['meu-chamado-historico', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia_historico')
        .select('*')
        .eq('chamado_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as HistoricoEvento[];
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  // Mutation - cancelar chamado
  const cancelarChamado = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from('chamados_assistencia')
        .update({ status: 'cancelado_associado' })
        .eq('id', id!);
      if (updateError) throw updateError;

      const { error: histError } = await supabase
        .from('chamados_assistencia_historico')
        .insert({
          chamado_id: id!,
          status_anterior: chamado?.status,
          status_novo: 'cancelado_associado',
          observacao: 'Cancelado pelo associado via App'
        });
      if (histError) throw histError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meu-chamado', id] });
      queryClient.invalidateQueries({ queryKey: ['meu-chamado-historico', id] });
      toast.success('Chamado cancelado com sucesso');
      setCancelDialogOpen(false);
    },
    onError: () => {
      toast.error('Erro ao cancelar chamado');
    },
  });

  const handleWhatsApp = (telefone: string) => {
    const cleaned = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleaned}`, '_blank');
  };

  const handleLigar = (telefone: string) => {
    window.location.href = `tel:${telefone}`;
  };

  const currentStatus = chamado?.status ? statusConfig[chamado.status] : null;
  const StatusIcon = currentStatus?.icon || Clock;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header Skeleton */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-6 w-48" />
        </div>

        <div className="p-4 space-y-4 pb-24">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!chamado) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-6">
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Chamado não encontrado</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/app/assistencia')}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusAtualIndex = statusOrdem.indexOf(chamado.status);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/assistencia')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="font-semibold truncate">
            Chamado #{chamado.protocolo}
          </h1>
          <Badge variant={getStatusBadgeVariant(chamado.status)} className="flex-shrink-0">
            {getStatusLabel(chamado.status)}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Card Status Principal (Hero) */}
        <Card className={cn(
          "overflow-hidden",
          currentStatus?.animacao && "ring-2 ring-primary/20"
        )}>
          <div className={cn(
            "bg-gradient-to-br p-6 text-white",
            currentStatus?.bgGradient || "from-gray-400 to-gray-500"
          )}>
            <div className="flex flex-col items-center text-center">
              <div className={cn(
                "h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mb-4",
                currentStatus?.animacao && "animate-pulse"
              )}>
                <StatusIcon className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold mb-1">
                {currentStatus?.label || chamado.status}
              </h2>
              <p className="text-white/90 text-sm">
                {currentStatus?.descricao}
              </p>
              <p className="text-white/70 text-xs mt-2">
                {getTipoServicoLabel(chamado.tipo_servico)}
              </p>

              {/* Tempo estimado - apenas quando prestador a caminho */}
              {(chamado.status === 'prestador_a_caminho' || chamado.status === 'prestador_despachado') && (
                <div className="mt-4 px-4 py-2 bg-white/20 rounded-lg">
                  <p className="text-white/80 text-xs">Tempo estimado</p>
                  <p className="text-xl font-bold">~15-30 min</p>
                  <p className="text-white/60 text-xs">Baseado na região</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Timeline Visual Fixa */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progresso do Atendimento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {etapasFixas.map((etapa, index) => {
                const etapaIndex = statusOrdem.indexOf(etapa.id);
                const concluida = etapaIndex !== -1 && etapaIndex < statusAtualIndex;
                const atual = etapa.id === chamado.status || 
                              (etapa.id === 'aguardando_prestador' && chamado.status === 'prestador_despachado');
                const isCancelado = chamado.status.includes('cancelado');
                const EtapaIcon = etapa.icon;

                return (
                  <div key={etapa.id} className="flex items-center gap-3">
                    {/* Indicador circular */}
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                      isCancelado && index > 0 ? "bg-muted text-muted-foreground" :
                      concluida ? "bg-green-500 text-white" : 
                      atual ? "bg-primary text-primary-foreground animate-pulse" : 
                      "bg-muted text-muted-foreground"
                    )}>
                      {concluida && !isCancelado ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <EtapaIcon className="h-4 w-4" />
                      )}
                    </div>
                    
                    {/* Label */}
                    <span className={cn(
                      "text-sm",
                      concluida && !isCancelado && "text-green-600 font-medium",
                      atual && !isCancelado && "text-primary font-medium",
                      (!concluida && !atual) && "text-muted-foreground"
                    )}>
                      {etapa.label}
                    </span>

                    {/* Linha conectora vertical */}
                    {index < etapasFixas.length - 1 && (
                      <div className="absolute left-[15px] mt-8 w-0.5 h-4 bg-border" style={{ display: 'none' }} />
                    )}
                  </div>
                );
              })}

              {/* Mostrar se cancelado */}
              {chamado.status.includes('cancelado') && (
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground">
                    <XCircle className="h-4 w-4" />
                  </div>
                  <span className="text-sm text-destructive font-medium">
                    Chamado cancelado
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mapa com Origem e Destino */}
        {chamado.origem_lat && chamado.origem_lng && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Mapa do Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-48 rounded-lg overflow-hidden border">
                <MapContainer
                  center={[chamado.origem_lat, chamado.origem_lng]}
                  zoom={14}
                  className="h-full w-full"
                  zoomControl={false}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Marcador Origem (você) */}
                  <Marker 
                    position={[chamado.origem_lat, chamado.origem_lng]}
                    icon={origemIcon}
                  >
                    <Popup>
                      <div className="text-center">
                        <p className="font-medium">Sua localização</p>
                        <p className="text-xs text-muted-foreground">{chamado.origem_endereco || 'Origem'}</p>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {/* Marcador Destino (se guincho/reboque) */}
                  {chamado.destino_lat && chamado.destino_lng && (
                    <Marker 
                      position={[chamado.destino_lat, chamado.destino_lng]}
                      icon={destinoIcon}
                    >
                      <Popup>
                        <div className="text-center">
                          <p className="font-medium">Destino</p>
                          <p className="text-xs text-muted-foreground">{chamado.destino_endereco || 'Destino do reboque'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>

              {/* Legenda */}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Você está aqui
                </span>
                {chamado.destino_lat && chamado.destino_lng && (
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    Destino
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card Prestador */}
        {chamado.prestador_nome && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prestador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary">
                    {chamado.prestador_nome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{chamado.prestador_nome}</p>
                  {chamado.prestador_telefone && (
                    <p className="text-sm text-muted-foreground">
                      {chamado.prestador_telefone}
                    </p>
                  )}
                </div>
              </div>

              {chamado.prestador_telefone && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleLigar(chamado.prestador_telefone!)}
                  >
                    <Phone className="h-4 w-4" />
                    Ligar
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => handleWhatsApp(chamado.prestador_telefone!)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Card Veículo */}
        {chamado.veiculo && (
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Car className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">{chamado.veiculo.placa}</p>
                <p className="text-sm text-muted-foreground">
                  {chamado.veiculo.marca} {chamado.veiculo.modelo}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card Localização */}
        {(chamado.origem_endereco || chamado.origem_logradouro) && (
          <Card>
            <CardContent className="flex items-start gap-4 py-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Localização</p>
                <p className="text-sm text-muted-foreground">
                  {chamado.origem_endereco || chamado.origem_logradouro}
                </p>
                {chamado.origem_cidade && (
                  <p className="text-sm text-muted-foreground">
                    {chamado.origem_cidade}{chamado.origem_uf ? `/${chamado.origem_uf}` : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {historico && historico.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico do Chamado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {historico.map((evento, index) => {
                  const isLast = index === historico.length - 1;
                  const statusInfo = statusConfig[evento.status_novo];

                  return (
                    <div key={evento.id} className="flex gap-3 pb-4 last:pb-0">
                      {/* Linha conectora */}
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "h-3 w-3 rounded-full border-2 flex-shrink-0",
                          statusInfo?.cor === 'green' && "border-green-500 bg-green-500",
                          statusInfo?.cor === 'blue' && "border-blue-500 bg-blue-500",
                          statusInfo?.cor === 'yellow' && "border-amber-500 bg-amber-500",
                          statusInfo?.cor === 'orange' && "border-orange-500 bg-orange-500",
                          statusInfo?.cor === 'purple' && "border-purple-500 bg-purple-500",
                          statusInfo?.cor === 'red' && "border-red-500 bg-red-500",
                          !statusInfo?.cor && "border-gray-400 bg-gray-400"
                        )} />
                        {!isLast && (
                          <div className="w-0.5 flex-1 bg-border mt-1" />
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">
                            {getStatusLabel(evento.status_novo)}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(evento.created_at), "HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {evento.observacao && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {evento.observacao}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(evento.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botão Cancelar */}
        {podeCancelar(chamado.status) && (
          <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar chamado
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar chamado?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja cancelar este chamado de assistência?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => cancelarChamado.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={cancelarChamado.isPending}
                >
                  {cancelarChamado.isPending ? 'Cancelando...' : 'Sim, cancelar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Aviso de atualização */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          <span>Página atualiza automaticamente a cada 30 segundos</span>
        </div>
      </div>
    </div>
  );
}
