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
// COMPONENTE: Status Item (checklist ativação)
// ============================================
function StatusItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-2 p-2.5 rounded-lg border text-sm',
      ok ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'
    )}>
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
      )}
      <span className="text-foreground">{label}</span>
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
        .select('id, decisao_instalador, ressalvas_instalador, fotos_ressalva, veiculo_id, associado_id, instalacao_origem_id, status')
        .eq('tipo', 'instalacao')
        .eq('decisao_instalador', 'negado')
        .eq('instalacao_origem_id', id)
        .eq('status', 'em_analise')
        .maybeSingle();
      return data;
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

  // Dados complementares condensados
  const hasKm = !!(servico?.quilometragem || servico?.km_atual || vistoria?.km_atual);
  const kmValue = servico?.quilometragem || servico?.km_atual || vistoria?.km_atual;
  const hasAssinatura = !!servico?.assinatura_cliente_url;
  const hasLocal = !!(rastreadorLocal && (rastreadorLocal.local_instalacao || rastreadorLocal.descricao_instalacao));
  const hasObservacoes = !!(servico?.ressalvas_instalador || servico?.observacoes || vistoria?.observacoes);
  const hasChecklist = !!(servico?.checklist_data && typeof servico.checklist_data === 'object');

  return (
    <div className="space-y-4">
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
              {veiculos?.placa} • {associados?.nome}
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
      {/* 1. RESUMO DA INSTALAÇÃO */}
      {/* ============================================ */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Resumo da Instalação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ResumoCompacto
              label="Cliente"
              icon={User}
              items={[
                { label: 'Nome', value: associados?.nome },
                { label: 'CPF', value: maskCPF(associados?.cpf || null) },
                { label: 'Telefone', value: associados?.telefone },
              ]}
            />
            <ResumoCompacto
              label="Veículo"
              icon={Car}
              items={[
                { label: 'Modelo', value: `${veiculos?.marca || ''} ${veiculos?.modelo || ''}`.trim() || null },
                { label: 'Placa', value: veiculos?.placa },
                { label: 'Ano', value: veiculos?.ano_modelo?.toString() },
              ]}
            />
            <ResumoCompacto
              label="Rastreador"
              icon={Wifi}
              items={[
                { label: 'IMEI', value: rastreadores?.imei },
                { label: 'Código', value: rastreadores?.codigo },
                { label: 'Plataforma', value: rastreadores?.plataforma?.toUpperCase() },
              ]}
            />
            <ResumoCompacto
              label="Instalação"
              icon={Calendar}
              items={[
                { label: 'Instalador', value: instalador?.nome },
                { label: 'Conclusão', value: instalacao.concluida_em ? format(new Date(instalacao.concluida_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '---' },
                ...(hasKm ? [{ label: 'KM', value: `${kmValue?.toLocaleString('pt-BR')} km` }] : []),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* 2. CHECKLIST PARA ATIVAÇÃO */}
      {/* ============================================ */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Checklist para Ativação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <StatusItem label="Rastreador vinculado" ok={!!rastreadores} />
            <StatusItem label="Instalação concluída" ok={instalacao.status === 'concluida'} />
            <StatusItem label="Cobertura roubo/furto" ok={veiculos?.cobertura_roubo_furto || false} />
            <StatusItem label="Cobertura total (360°)" ok={veiculos?.cobertura_total || false} />
            {contratoCarencia?.carencia_isenta && (
              <StatusItem label={`Carência isenta: ${contratoCarencia.carencia_motivo_isencao || ''}`} ok={true} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* 3. FOTOS & VÍDEOS — TABS POR ORIGEM */}
      {/* ============================================ */}
      <Card className="border-border bg-card">
        <Tabs defaultValue="instalacao" className="w-full">
          <CardHeader className="pb-0">
            <TabsList className="w-full justify-start bg-muted/50 border border-border h-10">
              <TabsTrigger value="instalacao" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Wrench className="h-3.5 w-3.5" />
                Instalador
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {fotosVistoria.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="autovistoria" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Camera className="h-3.5 w-3.5" />
                Autovistoria
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {autovistoria.fotos.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          {/* Tab Instalador */}
          <TabsContent value="instalacao">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">
                  <Wrench className="h-3 w-3 mr-1" />
                  {vistoriadorNome || instalador?.nome || 'Não identificado'}
                </Badge>
                {instalacao.concluida_em && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(instalacao.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>

              {vistoria?.video_360_url && (
                <VideoPlayer url={vistoria.video_360_url} label="Vídeo 360° — Instalador" />
              )}

              <FotosGrid fotos={fotosVistoria} onFotoClick={setFotoAmpliada} />
            </CardContent>
          </TabsContent>

          {/* Tab Autovistoria */}
          <TabsContent value="autovistoria">
            <CardContent className="pt-4 space-y-4">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                <User className="h-3 w-3 mr-1" />
                {autovistoria.associadoNome || associados?.nome || 'Não identificado'}
              </Badge>

              {autovistoria.fotos.length === 0 && !autovistoria.video360Url ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Image className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma autovistoria encontrada</p>
                </div>
              ) : (
                <>
                  {autovistoria.video360Url && (
                    <VideoPlayer url={autovistoria.video360Url} label="Vídeo 360° — Associado" />
                  )}
                  <FotosGrid fotos={autovistoria.fotos} onFotoClick={setFotoAmpliada} />
                </>
              )}
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* ============================================ */}
      {/* 4. DADOS COMPLEMENTARES (só se houver algo) */}
      {/* ============================================ */}
      {(hasAssinatura || hasLocal || hasObservacoes || hasChecklist) && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Dados Complementares
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Checklist inline */}
            {hasChecklist && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  Checklist do Instalador
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(servico!.checklist_data as Record<string, any>).map(([key, val]: [string, any]) => (
                    <div key={key} className={cn(
                      'flex items-start gap-2 p-2 rounded-lg border text-sm',
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
                        <p className="font-medium text-foreground">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </p>
                        {val?.observacao && (
                          <p className="text-xs text-muted-foreground">{val.observacao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assinatura + Local lado a lado */}
            {(hasAssinatura || hasLocal) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {hasAssinatura && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <PenTool className="h-4 w-4 text-primary" />
                      Assinatura do Cliente
                    </p>
                    <div className="border border-border rounded-lg p-2 bg-white">
                      <img
                        src={servico!.assinatura_cliente_url!}
                        alt="Assinatura do cliente"
                        className="w-full max-h-24 object-contain"
                      />
                    </div>
                  </div>
                )}
                {hasLocal && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Local de Instalação
                    </p>
                    <div className="space-y-1">
                      {rastreadorLocal!.local_instalacao && (
                        <p className="text-sm text-foreground">{rastreadorLocal!.local_instalacao}</p>
                      )}
                      {rastreadorLocal!.descricao_instalacao && (
                        <p className="text-xs text-muted-foreground">{rastreadorLocal!.descricao_instalacao}</p>
                      )}
                      {rastreadorLocal!.foto_local_instalacao_url && (
                        <img
                          src={rastreadorLocal!.foto_local_instalacao_url}
                          alt="Local de instalação"
                          className="w-full max-w-[200px] rounded-lg border border-border cursor-pointer hover:opacity-80 mt-1"
                          onClick={() => setFotoAmpliada(rastreadorLocal!.foto_local_instalacao_url!)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Observações */}
            {hasObservacoes && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-warning" />
                  Observações do Instalador
                </p>
                <div className="space-y-2">
                  {servico?.ressalvas_instalador && (
                    <div className="p-2.5 rounded-lg bg-warning/5 border border-warning/20">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Ressalvas</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{servico.ressalvas_instalador}</p>
                    </div>
                  )}
                  {(servico?.observacoes || vistoria?.observacoes) && (
                    <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Observações</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{servico?.observacoes || vistoria?.observacoes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* 5. AÇÃO FINAL */}
      {/* ============================================ */}
      <Card className={cn(
        'border-2',
        temRecusaPendente ? 'border-destructive/50' :
        podeAtivar ? 'border-success/50' :
        veiculos?.cobertura_total ? 'border-success/30' : 'border-border'
      )}>
        <CardContent className="p-5">
          {temRecusaPendente ? (
            <div className="text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <p className="font-semibold text-destructive">Ativação Bloqueada</p>
              <p className="text-sm text-muted-foreground">Resolva a pendência de recusa antes de ativar.</p>
              <Button variant="destructive" size="sm" onClick={() => setShowRecusaDialog(true)}>
                Tomar Decisão
              </Button>
            </div>
          ) : podeAtivar ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 text-center sm:text-left">
                <p className="font-semibold text-foreground">Tudo pronto para ativação</p>
                <p className="text-sm text-muted-foreground">
                  Rastreador {rastreadores?.imei} será ativado na plataforma {rastreadores?.plataforma?.toUpperCase()} para o veículo {veiculos?.placa}.
                </p>
              </div>
              <Button
                className="bg-success hover:bg-success/90 text-white px-8"
                size="lg"
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
            </div>
          ) : veiculos?.cobertura_total ? (
            <div className="text-center space-y-1">
              <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
              <p className="font-semibold text-success">Rastreador Ativado</p>
              <p className="text-sm text-muted-foreground">Proteção 360° liberada para {veiculos?.placa}</p>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-semibold text-muted-foreground">Ativação Indisponível</p>
              <p className="text-sm text-muted-foreground">
                {!rastreadores ? 'Sem rastreador vinculado' :
                 !veiculos?.cobertura_roubo_furto ? 'Cobertura roubo/furto não aprovada' :
                 'Instalação não concluída'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
