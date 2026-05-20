import { useState, useMemo } from 'react';
import {
  Car, Wifi, WifiOff, Shield, Camera, FileText, AlertTriangle,
  ExternalLink, Loader2, Video, History, ShieldAlert, LifeBuoy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useVeiculoCompleto,
  useFotosVistoriaPorVeiculo,
  useDocumentosAssociadoCompleto,
  useEventosVeiculo,
  useVideos360PorVeiculo,
  agruparFotosVeiculo,
  formatarTipoFotoVeiculo,
  type FotoVistoriaVeiculo,
  type Video360Item,
} from '@/hooks/useVeiculoDetalhes';
import { useRastreadorTempoReal } from '@/hooks/useRastreadorPosicao';
import { EnriquecerVeiculoButton } from '@/components/cadastro/EnriquecerVeiculoButton';
import { MediaViewerModal, type MediaItem } from '@/components/cadastro/MediaViewerModal';
import { formatPlacaExibicao } from '@/lib/placa-utils';

const formatCurrency = (v: number | null | undefined) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'R$ 0,00';

const formatDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR') : '—';

function Field({ label, value, mono, highlight }: { label: string; value: any; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : 'font-medium'} ${highlight ? 'text-primary font-semibold' : ''}`}>
        {value || value === 0 ? value : '—'}
      </p>
    </div>
  );
}

interface Props {
  veiculoId: string | null | undefined;
}

const CATEGORIA_LABELS: Record<string, string> = {
  identificacao: 'Identificação',
  exterior: 'Exterior',
  interior: 'Interior',
  outros: 'Outros',
};

/**
 * Bloco rico de detalhes do veículo. Usado tanto na fila do Cadastro
 * quanto na de Monitoramento. Mostra:
 * - dados completos + rastreador + contrato vigente
 * - fotos da vistoria agrupadas por categoria (mesma divisão da tela do instalador)
 * - vídeo 360° (canônico em vistorias.video_360_url + fallback foto legada)
 * - preview embutido de documentos (PDF/imagem)
 * - histórico completo do veículo (sinistros + assistências)
 */
export function VeiculoCompletoCard({ veiculoId }: Props) {
  const { data: completo, isLoading } = useVeiculoCompleto(veiculoId || undefined);
  const { data: fotos } = useFotosVistoriaPorVeiculo(veiculoId || undefined);
  const { data: videos } = useVideos360PorVeiculo(veiculoId || undefined);
  const { data: documentosData } = useDocumentosAssociadoCompleto(completo?.associado?.id);
  const { data: eventos } = useEventosVeiculo(veiculoId || undefined);

  const [mediaState, setMediaState] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const [docPreview, setDocPreview] = useState<{ url: string; tipo: string } | null>(null);

  const fotosArr = useMemo(() => fotos || [], [fotos]);
  const videosArr = useMemo(() => videos || [], [videos]);
  const grupos = useMemo(() => agruparFotosVeiculo(fotosArr), [fotosArr]);

  // Galeria completa para o lightbox: fotos agrupadas + vídeos 360° no final
  const galleryItems: MediaItem[] = useMemo(() => {
    const fotoItems: MediaItem[] = (['identificacao', 'exterior', 'interior', 'outros'] as const)
      .flatMap((cat) => grupos[cat].map((f) => ({
        url: f.arquivo_url,
        tipo: `${CATEGORIA_LABELS[cat]} — ${formatarTipoFotoVeiculo(f.tipo)}`,
        mediaType: 'image' as const,
      })));
    const videoItems: MediaItem[] = videosArr.map((v) => ({
      url: v.url,
      tipo: `Vídeo 360° — ${formatDateTime(v.created_at)}`,
      mediaType: 'video' as const,
    }));
    return [...fotoItems, ...videoItems];
  }, [grupos, videosArr]);

  const indexOfFoto = (foto: FotoVistoriaVeiculo) =>
    galleryItems.findIndex((m) => m.url === foto.arquivo_url);
  const indexOfVideo = (v: Video360Item) =>
    galleryItems.findIndex((m) => m.url === v.url);

  const openMedia = (idx: number) => {
    if (idx < 0) return;
    setMediaState({ items: galleryItems, index: idx });
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!completo?.veiculo) return <p className="text-sm text-muted-foreground">Veículo não encontrado.</p>;

  const { veiculo, rastreador, contrato } = completo;
  const todosDocumentos = [
    ...(documentosData?.documentos || []),
    ...(documentosData?.documentosCotacao || []),
  ];
  const totalEventos = (eventos?.sinistros?.length || 0) + (eventos?.assistencias?.length || 0);

  return (
    <div className="space-y-4">
      {/* VEÍCULO */}
      <div className="rounded border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold flex items-center gap-2">
            <Car className="h-4 w-4" /> Veículo
            <Badge variant="outline" className="font-mono text-xs">{formatPlacaExibicao(veiculo.placa)}</Badge>
          </h4>
          <EnriquecerVeiculoButton veiculo={veiculo as any} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Marca" value={veiculo.marca} />
          <Field label="Modelo" value={veiculo.modelo} />
          <Field label="Ano" value={`${veiculo.ano_fabricacao || '?'}/${veiculo.ano_modelo || '?'}`} />
          <Field label="Cor" value={veiculo.cor} />
          <Field label="Chassi" value={veiculo.chassi} mono />
          <Field label="Renavam" value={veiculo.renavam} />
          <Field label="Combustível" value={veiculo.combustivel} />
          <Field label="Valor FIPE" value={formatCurrency(veiculo.valor_fipe)} highlight />
          <Field label="Status" value={veiculo.status} />
          <Field label="Uso App" value={veiculo.uso_aplicativo ? `Sim - ${veiculo.plataforma_app || ''}` : 'Não'} />
        </div>
      </div>

      {/* RASTREADOR */}
      <RastreadorBlock rastreador={rastreador} />

      {/* CONTRATO ATIVO */}
      {contrato && (
        <div className="rounded border p-3 space-y-2">
          <h4 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4" /> Contrato vigente</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Número" value={contrato.numero} mono />
            <Field label="Plano" value={contrato.plano_nome} />
            <Field label="Valor mensal" value={formatCurrency(contrato.valor_mensal)} highlight />
            <Field label="Status" value={contrato.status} />
          </div>
        </div>
      )}

      {/* FOTOS DA VISTORIA — agrupadas por categoria (mesma divisão do instalador) */}
      <div className="rounded border p-3 space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <Camera className="h-4 w-4" /> Fotos da vistoria
          {fotosArr.length > 0 && <Badge variant="secondary" className="text-xs">{fotosArr.length}</Badge>}
        </h4>
        {fotosArr.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem fotos de vistoria registradas.</p>
        ) : (
          (['identificacao', 'exterior', 'interior', 'outros'] as const).map((cat) => {
            const lista = grupos[cat];
            if (!lista.length) return null;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORIA_LABELS[cat]}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{lista.length}</Badge>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {lista.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => openMedia(indexOfFoto(f))}
                      className="group relative aspect-square rounded overflow-hidden border hover:ring-2 hover:ring-primary transition"
                      title={formatarTipoFotoVeiculo(f.tipo)}
                    >
                      <img
                        src={f.arquivo_url}
                        alt={f.tipo}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition">
                        {formatarTipoFotoVeiculo(f.tipo)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* VÍDEO 360° */}
      <div className="rounded border p-3 space-y-2">
        <h4 className="font-semibold flex items-center gap-2">
          <Video className="h-4 w-4" /> Vídeo 360°
          {videosArr.length > 0 && <Badge variant="secondary" className="text-xs">{videosArr.length}</Badge>}
        </h4>
        {videosArr.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem vídeo 360° registrado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {videosArr.map((v) => (
              <div key={v.id} className="space-y-1">
                <video
                  src={v.url}
                  controls
                  preload="metadata"
                  className="w-full rounded border bg-black aspect-video"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDateTime(v.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => openMedia(indexOfVideo(v))}
                    className="text-primary hover:underline"
                  >
                    Tela cheia
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DOCUMENTOS DO ASSOCIADO — preview embutido */}
      <div className="rounded border p-3 space-y-2">
        <h4 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> Documentos do associado
          {todosDocumentos.length > 0 && <Badge variant="secondary" className="text-xs">{todosDocumentos.length}</Badge>}
        </h4>
        {todosDocumentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem documentos anexados.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {todosDocumentos.map((d: any) => {
              const url = d.arquivo_url || d.url;
              const mime = (d.mime_type || d.tipo_mime || '').toString().toLowerCase();
              const tipo = d.tipo_documento || d.tipo || 'documento';
              const cleanUrl = typeof url === 'string' ? url.toLowerCase().split('?')[0] : '';
              const isPdf =
                mime === 'application/pdf' ||
                cleanUrl.endsWith('.pdf') ||
                /\/laudos?\//.test(cleanUrl) ||
                /contrato|laudo/.test(String(tipo).toLowerCase());
              const isImage = !isPdf && /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(cleanUrl);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => url && setDocPreview({ url, tipo })}
                  disabled={!url}
                  className="group rounded border p-2 text-left hover:border-primary hover:ring-1 hover:ring-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title={url ? 'Visualizar documento' : 'Sem arquivo'}
                >
                  <div className="aspect-[4/3] rounded bg-muted overflow-hidden flex items-center justify-center mb-1">
                    {!url ? (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    ) : isPdf ? (
                      <div className="flex flex-col items-center text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <span className="text-[10px] mt-1">PDF</span>
                      </div>
                    ) : isImage ? (
                      <img src={url} alt={tipo} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <span className="text-[10px] mt-1">Arquivo</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium truncate">{tipo}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* HISTÓRICO COMPLETO DO VEÍCULO */}
      <div className="rounded border p-3 space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico do veículo
          {totalEventos > 0 && <Badge variant="secondary" className="text-xs">{totalEventos}</Badge>}
        </h4>
        {totalEventos === 0 ? (
          <p className="text-sm text-muted-foreground">Sem ocorrências registradas para este veículo.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Sinistros */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" />
                Sinistros
                <Badge variant="outline" className="text-[10px]">{eventos?.sinistros?.length || 0}</Badge>
              </div>
              {(eventos?.sinistros?.length || 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum.</p>
              ) : (
                <ul className="space-y-1">
                  {eventos!.sinistros.map((s: any) => (
                    <li key={s.id} className="text-xs border rounded px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono">{s.protocolo || s.id.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-[10px]">{s.status || '—'}</Badge>
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {s.tipo || 'sinistro'} • {formatDateTime(s.data_ocorrencia || s.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Assistências */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <LifeBuoy className="h-3.5 w-3.5" />
                Assistências
                <Badge variant="outline" className="text-[10px]">{eventos?.assistencias?.length || 0}</Badge>
              </div>
              {(eventos?.assistencias?.length || 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma.</p>
              ) : (
                <ul className="space-y-1">
                  {eventos!.assistencias.map((a: any) => (
                    <li key={a.id} className="text-xs border rounded px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono">{a.protocolo || a.id.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-[10px]">{a.status || '—'}</Badge>
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {a.tipo_servico || 'assistência'} • {formatDateTime(a.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LIGHTBOX galeria (fotos + vídeos 360°) */}
      {mediaState && (
        <MediaViewerModal
          open={!!mediaState}
          onOpenChange={(o) => { if (!o) setMediaState(null); }}
          items={mediaState.items}
          initialIndex={mediaState.index}
        />
      )}

      {/* PREVIEW DE DOCUMENTO (PDF/imagem) */}
      <Dialog open={!!docPreview} onOpenChange={(o) => { if (!o) setDocPreview(null); }}>
        <DialogContent className="max-w-5xl max-h-[92vh] p-0 flex flex-col">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="truncate">{docPreview?.tipo || 'Documento'}</span>
              {docPreview?.url && (
                <a
                  href={docPreview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline text-xs flex items-center gap-1 shrink-0"
                >
                  Abrir em nova aba <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {docPreview && (() => {
            const cleanUrl = docPreview.url.toLowerCase().split('?')[0];
            const isPdf = cleanUrl.endsWith('.pdf') || /\/laudos?\//.test(cleanUrl) || /contrato|laudo/.test(String(docPreview.tipo).toLowerCase());
            const isImage = !isPdf && /\.(jpe?g|png|gif|webp)$/i.test(cleanUrl);
            return isPdf ? (
              <iframe
                src={`${docPreview.url}#toolbar=1&navpanes=0&view=FitH`}
                className="w-full flex-1 min-h-[70vh] border-0 bg-background"
                title={docPreview.tipo}
              />
            ) : isImage ? (
              <div className="flex items-center justify-center bg-black/95 flex-1 min-h-[60vh] overflow-auto">
                <img src={docPreview.url} alt={docPreview.tipo} className="max-h-[80vh] max-w-full object-contain" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3 flex-1">
                <FileText className="h-16 w-16 opacity-50" />
                <p className="text-sm">Não é possível visualizar este tipo de arquivo no navegador.</p>
                <Button asChild variant="outline" size="sm">
                  <a href={docPreview.url} target="_blank" rel="noreferrer">
                    Abrir em nova aba <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Separator className="opacity-0" />
    </div>
  );
}

function RastreadorBlock({ rastreador }: { rastreador: any }) {
  const enabled = !!rastreador?.id;
  const { posicao, isLoading, error, serviceError, mensagem, refetch, isRefetching } = useRastreadorTempoReal(
    enabled ? rastreador.id : undefined,
    true,
  );

  const ultimaComunicacao = posicao?.data_posicao || rastreador?.ultima_comunicacao || null;
  const hardError = !posicao && (!!error || serviceError);
  const softWarning = !!posicao && serviceError;

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          {rastreador ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
          Rastreador
          {enabled && (isLoading || isRefetching) && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </h4>
        {enabled && (
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs text-primary hover:underline disabled:opacity-50"
            disabled={isLoading || isRefetching}
          >
            Atualizar
          </button>
        )}
      </div>
      {rastreador ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Código" value={rastreador.codigo} mono />
            <Field label="IMEI" value={rastreador.imei} mono />
            <Field label="Plataforma" value={rastreador.plataforma} />
            <Field label="Status" value={rastreador.status} />
            <Field
              label="Última comunicação"
              value={ultimaComunicacao ? formatDateTime(ultimaComunicacao) : (isLoading ? 'Consultando...' : '—')}
            />
          </div>
          {posicao && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
              <Field label="Velocidade" value={`${Math.round((posicao as any).velocidade ?? 0)} km/h`} />
              <Field label="Latitude" value={(posicao as any).latitude?.toFixed?.(6)} mono />
              <Field label="Longitude" value={(posicao as any).longitude?.toFixed?.(6)} mono />
              <Field label="Endereço" value={(posicao as any).endereco || '—'} />
            </div>
          )}
          {softWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {mensagem || 'Tempo real indisponível — exibindo última posição conhecida.'}
            </p>
          )}
          {hardError && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Erro de comunicação com o rastreador</p>
                <p className="opacity-80">{(error as Error)?.message || mensagem || 'Falha ao consultar a plataforma.'}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Sem rastreador instalado.</p>
      )}
    </div>
  );
}
