import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ResolverRecusaDialog } from '@/components/cadastro/ResolverRecusaDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowLeft,
  User,
  Car,
  Wifi,
  Calendar,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Zap,
  MapPin,
  Camera,
  Video,
  ClipboardCheck,
  Gauge,
  PenTool,
  XCircle,
  MessageSquare,
  Play,
  Image,
  Wrench,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useVistoriaCompletaAnalise, FotoVistoriaItem } from '@/hooks/useVistoriaCompletaAnalise';
import { StatusCoberturaCard } from '@/components/cadastro/StatusCoberturaCard';
import { formatarTipoFoto } from '@/hooks/useFotosAutovistoria';

// ============================================
// FUNÇÕES AUXILIARES
// ============================================
function maskCPF(cpf: string | null): string {
  if (!cpf) return '---';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `***.${clean.slice(3, 6)}.***-${clean.slice(9)}`;
}

// ============================================
// COMPONENTE: Resumo Compacto
// ============================================
function ResumoCompacto({
  label,
  icon: Icon,
  items,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { label: string; value: string | null | undefined }[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{item.label}:</span>
            <span className="text-sm text-foreground font-medium break-all">{item.value || '---'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE: Grid de Fotos
// ============================================
function FotosGrid({
  fotos,
  onFotoClick,
}: {
  fotos: FotoVistoriaItem[];
  onFotoClick: (url: string) => void;
}) {
  if (fotos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Image className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma foto encontrada</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
      {fotos.map((foto) => {
        const isVideo = foto.tipo?.startsWith('video_360');
        return (
          <div
            key={foto.id}
            className="relative aspect-square rounded-lg overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all group"
            onClick={() => {
              if (isVideo) {
                window.open(foto.arquivo_url, '_blank');
              } else {
                onFotoClick(foto.arquivo_url);
              }
            }}
          >
            {isVideo ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-muted gap-1">
                <Play className="h-6 w-6 text-primary" />
                <span className="text-[10px] text-muted-foreground">Vídeo</span>
              </div>
            ) : (
              <img
                src={foto.arquivo_url}
                alt={foto.tipo}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
              <p className="text-[10px] text-white truncate font-medium">
                {formatarTipoFoto(foto.tipo || '')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// COMPONENTE: Video Player
// ============================================
function VideoPlayer({ url, label }: { url: string; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
          <Play className="h-3 w-3 mr-1" />
          360°
        </Badge>
      </div>
      <div className="rounded-lg overflow-hidden bg-muted/50 border border-border">
        <video
          src={url}
          controls
          className="w-full aspect-video object-contain bg-black"
          preload="metadata"
          playsInline
        />
      </div>
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function VistoriaCompletaAnalise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showConfirmAtivacao, setShowConfirmAtivacao] = useState(false);
  const [showRecusaDialog, setShowRecusaDialog] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const {
    instalacao,
    isLoading,
    error,
    podeAtivar,
    ativarRastreador,
    isAtivando,
    vistoria,
    fotosVistoria,
    servico,
    rastreadorLocal,
    vistoriadorNome,
    autovistoria,
  } = useVistoriaCompletaAnalise(id);

  // Query para buscar dados de recusa do serviço vinculado à instalação
  const { data: servicoRecusa } = useQuery({
    queryKey: ['servico-recusa-instalacao', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase
        .from('servicos')
        .select('id, decisao_instalador, ressalvas_instalador, fotos_ressalva, veiculo_id, associado_id')
        .eq('tipo', 'instalacao')
        .eq('decisao_instalador', 'negado')
        .limit(1);
      if (!data || data.length === 0) return null;
      return data[0];
    },
    enabled: !!id && !!instalacao,
  });

  // Query para buscar dados de carência do contrato vinculado ao associado
  const associadoId = instalacao?.associados?.id;
  const { data: contratoCarencia } = useQuery({
    queryKey: ['contrato-carencia-vistoria', associadoId],
    queryFn: async () => {
      if (!associadoId) return null;
      const { data } = await supabase
        .from('contratos')
        .select('carencia_isenta, carencia_motivo_isencao')
        .eq('associado_id', associadoId)
        .in('status', ['ativo'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!associadoId,
  });

  const temRecusaPendente = servicoRecusa?.decisao_instalador === 'negado';

  const handleAtivarRastreador = () => {
    setShowConfirmAtivacao(true);
  };

  const handleConfirmarAtivacao = async () => {
    setShowConfirmAtivacao(false);
    await ativarRastreador();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 bg-muted" />
        <Skeleton className="h-24 w-full bg-muted" />
        <Skeleton className="h-64 w-full bg-muted" />
      </div>
    );
  }

  if (error || !instalacao) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-warning" />
        <h2 className="text-xl font-semibold text-foreground">Instalação não encontrada</h2>
        <p className="text-muted-foreground mt-2">
          A instalação solicitada não existe ou foi removida.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const { associados, veiculos, rastreadores, instalador } = instalacao;

  return (
    <div className="space-y-5">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Ativação de Rastreador
            </h1>
            <p className="text-sm text-muted-foreground">
              Instalação #{id?.slice(0, 8)} • {veiculos?.placa}
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            'text-sm px-3 py-1 w-fit',
            instalacao.status === 'concluida'
              ? 'bg-success/20 text-success border-success'
              : 'bg-warning/20 text-warning border-warning'
          )}
        >
          {instalacao.status === 'concluida' ? 'Instalação Concluída' : instalacao.status}
        </Badge>
      </div>

      {/* ============================================ */}
      {/* BANNER DE RECUSA */}
      {/* ============================================ */}
      {temRecusaPendente && servicoRecusa && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive text-lg">
                  Veículo NEGADO pelo Instalador — Pendente de Revisão
                </h3>
                {servicoRecusa.ressalvas_instalador && (
                  <p className="text-sm text-foreground mt-1">
                    <strong>Motivo:</strong> {servicoRecusa.ressalvas_instalador}
                  </p>
                )}
                {servicoRecusa.fotos_ressalva && (servicoRecusa.fotos_ressalva as string[]).length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {(servicoRecusa.fotos_ressalva as string[]).map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Evidência ${i + 1}`} className="h-16 w-16 rounded-md object-cover border" />
                      </a>
                    ))}
                  </div>
                )}
                <Button
                  className="mt-3"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowRecusaDialog(true)}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Tomar Decisão
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* RESUMO + STATUS + AÇÕES */}
      {/* ============================================ */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Resumo compacto */}
        <Card className="lg:col-span-3 border-border bg-card">
          <CardContent className="p-4">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ResumoCompacto
                label="Cliente"
                icon={User}
                items={[
                  { label: 'Nome', value: associados?.nome },
                  { label: 'CPF', value: maskCPF(associados?.cpf || null) },
                  { label: 'Telefone', value: associados?.telefone },
                  { label: 'Email', value: associados?.email },
                ]}
              />
              <ResumoCompacto
                label="Veículo"
                icon={Car}
                items={[
                  { label: 'Modelo', value: `${veiculos?.marca || ''} ${veiculos?.modelo || ''}`.trim() || null },
                  { label: 'Placa', value: veiculos?.placa },
                  { label: 'Ano', value: veiculos?.ano_modelo?.toString() },
                  { label: 'Cor', value: veiculos?.cor },
                ]}
              />
              <ResumoCompacto
                label="Rastreador"
                icon={Wifi}
                items={[
                  { label: 'IMEI', value: rastreadores?.imei },
                  { label: 'Código', value: rastreadores?.codigo },
                  { label: 'Plataforma', value: rastreadores?.plataforma?.toUpperCase() },
                  { label: 'Instalador', value: instalador?.nome },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Status + Ações */}
        <div className="space-y-4">
          <StatusCoberturaCard
            coberturaRouboFurto={veiculos?.cobertura_roubo_furto || false}
            coberturaTotal={veiculos?.cobertura_total || false}
            rastreadorVinculado={!!rastreadores}
            rastreadorImei={rastreadores?.imei}
            rastreadorCodigo={rastreadores?.codigo}
            instalacaoStatus={instalacao.status}
            carenciaIsenta={contratoCarencia?.carencia_isenta || false}
            carenciaMotivoIsencao={contratoCarencia?.carencia_motivo_isencao}
          />

          {temRecusaPendente ? (
            <Card className="border-destructive/50 bg-card">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-1" />
                <p className="font-medium text-destructive text-sm">Ativação Bloqueada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Resolva a pendência antes de ativar.
                </p>
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => setShowRecusaDialog(true)}>
                  Tomar Decisão
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-2">
                {podeAtivar ? (
                  <Button
                    className="w-full bg-success hover:bg-success/90 text-white"
                    onClick={handleAtivarRastreador}
                    disabled={isAtivando}
                  >
                    {isAtivando ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ativando...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Ativar Rastreador
                      </>
                    )}
                  </Button>
                ) : veiculos?.cobertura_total ? (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-center">
                    <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-1" />
                    <p className="font-medium text-success text-sm">Rastreador Ativado</p>
                    <p className="text-xs text-muted-foreground">Proteção 360º liberada</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <AlertTriangle className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="font-medium text-muted-foreground text-sm">Indisponível</p>
                    <p className="text-xs text-muted-foreground">
                      {!rastreadores ? 'Sem rastreador vinculado' :
                       !veiculos?.cobertura_roubo_furto ? 'Cobertura roubo/furto não aprovada' :
                       'Instalação não concluída'}
                    </p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(-1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* TABS: Instalação | Autovistoria | Checklist */}
      {/* ============================================ */}
      <Tabs defaultValue="instalacao" className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 border border-border h-11">
          <TabsTrigger value="instalacao" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Fotos do</span> Instalador
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {fotosVistoria.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="autovistoria" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Camera className="h-4 w-4" />
            Autovistoria
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {autovistoria.fotos.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Checklist &</span> Detalhes
          </TabsTrigger>
        </TabsList>

        {/* ======== TAB: INSTALAÇÃO ======== */}
        <TabsContent value="instalacao" className="space-y-4 mt-4">
          {/* Badge de identificação */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary/10 text-primary border-primary/30">
              <Wrench className="h-3 w-3 mr-1" />
              Instalador: {vistoriadorNome || instalador?.nome || 'Não identificado'}
            </Badge>
            {instalacao.concluida_em && (
              <span className="text-xs text-muted-foreground">
                Concluída em {format(new Date(instalacao.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>

          {/* Vídeo 360° do instalador */}
          {vistoria?.video_360_url && (
            <VideoPlayer url={vistoria.video_360_url} label="Vídeo 360° — Instalador" />
          )}

          {/* Grid de fotos */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              Fotos da Vistoria ({fotosVistoria.length} fotos)
            </h3>
            <FotosGrid fotos={fotosVistoria} onFotoClick={setFotoAmpliada} />
          </div>

          {/* Dados adicionais da instalação em grid compacto */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Quilometragem */}
            {(servico?.quilometragem || servico?.km_atual || vistoria?.km_atual) && (
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Quilometragem</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {(servico?.quilometragem || servico?.km_atual || vistoria?.km_atual)?.toLocaleString('pt-BR')} km
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Assinatura do cliente */}
            {servico?.assinatura_cliente_url && (
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <PenTool className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Assinatura do Cliente</span>
                  </div>
                  <div className="border border-border rounded-lg p-2 bg-white">
                    <img
                      src={servico.assinatura_cliente_url}
                      alt="Assinatura do cliente"
                      className="w-full max-h-24 object-contain"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Local de instalação */}
          {rastreadorLocal && (rastreadorLocal.local_instalacao || rastreadorLocal.descricao_instalacao) && (
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Local de Instalação do Rastreador</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    {rastreadorLocal.local_instalacao && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground">Local selecionado</p>
                        <p className="text-sm font-medium text-foreground">{rastreadorLocal.local_instalacao}</p>
                      </div>
                    )}
                    {rastreadorLocal.descricao_instalacao && (
                      <div>
                        <p className="text-xs text-muted-foreground">Descrição do ponto</p>
                        <p className="text-sm text-foreground">{rastreadorLocal.descricao_instalacao}</p>
                      </div>
                    )}
                  </div>
                  {rastreadorLocal.foto_local_instalacao_url && (
                    <img
                      src={rastreadorLocal.foto_local_instalacao_url}
                      alt="Local de instalação"
                      className="w-full max-w-xs rounded-lg border border-border cursor-pointer hover:opacity-80"
                      onClick={() => setFotoAmpliada(rastreadorLocal.foto_local_instalacao_url!)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observações do instalador */}
          {(servico?.ressalvas_instalador || servico?.observacoes || vistoria?.observacoes) && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-foreground">Observações do Instalador</span>
                </div>
                {servico?.ressalvas_instalador && (
                  <div className="p-2 rounded-lg bg-muted/50 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Ressalvas</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{servico.ressalvas_instalador}</p>
                  </div>
                )}
                {(servico?.observacoes || vistoria?.observacoes) && (
                  <div className="p-2 rounded-lg bg-muted/50 border border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Observações</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{servico?.observacoes || vistoria?.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ======== TAB: AUTOVISTORIA ======== */}
        <TabsContent value="autovistoria" className="space-y-4 mt-4">
          {/* Badge de identificação */}
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              <User className="h-3 w-3 mr-1" />
              Associado: {autovistoria.associadoNome || associados?.nome || 'Não identificado'}
            </Badge>
          </div>

          {autovistoria.fotos.length === 0 && !autovistoria.video360Url ? (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <Image className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground font-medium">Nenhuma autovistoria encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  O associado ainda não realizou a autovistoria, ou as fotos estão vinculadas de outra forma.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Vídeo 360° do associado */}
              {autovistoria.video360Url && (
                <VideoPlayer url={autovistoria.video360Url} label="Vídeo 360° — Associado" />
              )}

              {/* Grid de fotos */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-emerald-500" />
                  Fotos da Autovistoria ({autovistoria.fotos.length} fotos)
                </h3>
                <FotosGrid fotos={autovistoria.fotos} onFotoClick={setFotoAmpliada} />
              </div>
            </>
          )}
        </TabsContent>

        {/* ======== TAB: CHECKLIST & DETALHES ======== */}
        <TabsContent value="checklist" className="space-y-4 mt-4">
          {/* Checklist do Instalador */}
          {servico?.checklist_data && typeof servico.checklist_data === 'object' ? (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Checklist do Instalador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {Object.entries(servico.checklist_data as Record<string, any>).map(([key, val]: [string, any]) => (
                    <div key={key} className={cn(
                      'flex items-start gap-2 p-2.5 rounded-lg border',
                      val?.status === 'ok' ? 'bg-success/5 border-success/20' :
                      val?.status === 'nok' ? 'bg-destructive/5 border-destructive/20' :
                      'bg-muted/50 border-border'
                    )}>
                      {val?.status === 'ok' ? (
                        <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      ) : val?.status === 'nok' ? (
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </p>
                        {val?.observacao && (
                          <p className="text-xs text-muted-foreground mt-0.5">{val.observacao}</p>
                        )}
                        {val?.fotos && (val.fotos as string[]).length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {(val.fotos as string[]).map((url: string, i: number) => (
                              <img
                                key={i}
                                src={url}
                                alt={`Evidência ${i + 1}`}
                                className="h-10 w-10 rounded object-cover cursor-pointer border border-border hover:opacity-80"
                                onClick={() => setFotoAmpliada(url)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="p-8 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground font-medium">Nenhum checklist registrado</p>
              </CardContent>
            </Card>
          )}

          {/* Dados da Instalação */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Calendar className="h-5 w-5 text-primary" />
                Dados da Instalação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Data de Conclusão</p>
                  <p className="text-sm font-medium text-foreground">
                    {instalacao.concluida_em
                      ? format(new Date(instalacao.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '---'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Instalador Responsável</p>
                  <p className="text-sm font-medium text-foreground">{instalador?.nome || '---'}</p>
                </div>
                {instalacao.observacoes && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Observações da Instalação</p>
                    <p className="text-sm text-foreground">{instalacao.observacoes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dados do Rastreador */}
          {rastreadores && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <Wifi className="h-5 w-5 text-primary" />
                  Dados do Rastreador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">IMEI</p>
                    <p className="text-sm font-medium text-foreground">{rastreadores.imei}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Código</p>
                    <p className="text-sm font-medium text-foreground">{rastreadores.codigo || '---'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Número de Série</p>
                    <p className="text-sm font-medium text-foreground">{rastreadores.numero_serie || '---'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Plataforma</p>
                    <p className="text-sm font-medium text-foreground">{rastreadores.plataforma?.toUpperCase() || '---'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium text-foreground">{rastreadores.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Device ID</p>
                    <p className="text-sm font-medium text-foreground">{rastreadores.plataforma_device_id || 'Não sincronizado'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ============================================ */}
      {/* MODAL FOTO AMPLIADA */}
      {/* ============================================ */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setFotoAmpliada(null)}
        >
          <img
            src={fotoAmpliada}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
        </div>
      )}

      {/* ============================================ */}
      {/* DIALOGS */}
      {/* ============================================ */}
      <AlertDialog open={showConfirmAtivacao} onOpenChange={setShowConfirmAtivacao}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Confirmar Ativação do Rastreador
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Esta ação irá:
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Ativar o rastreador na plataforma {rastreadores?.plataforma?.toUpperCase()}</li>
                <li>Liberar a Proteção 360º para o veículo {veiculos?.placa}</li>
                <li>Ativar o associado {associados?.nome}</li>
              </ul>
              <p className="mt-3 font-medium">Deseja continuar?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-success hover:bg-success/90 text-white"
              onClick={handleConfirmarAtivacao}
            >
              <Zap className="mr-2 h-4 w-4" />
              Confirmar Ativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {servicoRecusa && (
        <ResolverRecusaDialog
          open={showRecusaDialog}
          onOpenChange={setShowRecusaDialog}
          servicoId={servicoRecusa.id}
          veiculoId={servicoRecusa.veiculo_id}
          associadoId={servicoRecusa.associado_id}
          placa={veiculos?.placa || ''}
          motivo={servicoRecusa.ressalvas_instalador}
          fotosRessalva={servicoRecusa.fotos_ressalva as string[] | null}
        />
      )}
    </div>
  );
}
