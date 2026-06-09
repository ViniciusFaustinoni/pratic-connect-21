import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Gauge,
  Info,
  X,
  RefreshCw,
  AlertTriangle,
  ScanLine,
  Video,
  CloudOff,
  CloudUpload,
} from 'lucide-react';
import {
  getFotosAutovistoria,
  getInstrucoesVideo360,
  getLabelVideo360,
  type TipoVeiculo,
  type FotoAutovistoria,
} from '@/data/autovistoriaConfig';
import { useFotosCotacaoVistoria, useFinalizarVistoriaCotacao, type PlacaOcrResultado } from '@/hooks/useCotacaoVistoria';
import { useAutovistoriaOfflineUpload } from '@/hooks/useAutovistoriaOfflineUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '@/lib/imageCompressor';
import { InAppBrowserBanner } from '@/components/shared/InAppBrowserBanner';
import { useDeviceCapability } from '@/hooks/useDeviceCapability';
import { OcrFallbackBanner } from '@/components/ocr/OcrFallbackBanner';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { VideoCapture } from '@/components/instalador/VideoCapture';


interface AutovistoriaCotacaoProps {
  cotacaoId: string;
  tipoVeiculo: TipoVeiculo;
  onComplete: () => void;
  /** Override do conjunto de fotos (ex.: vistoria completa 31/15 sub-FIPE). */
  fotosOverride?: FotoAutovistoria[];
  /** Título customizado (default: "Autovistoria"). */
  titulo?: string;
}

// EXCEÇÃO TEMPORÁRIA — apenas para testes pontuais autorizados.
// Não replicar este padrão; em produção a validação de placa é obrigatória.
const COTACOES_TESTE_BYPASS_OCR_PLACA = new Set<string>([
  '1b0b711f-2fec-42c6-973b-93afb4836d0f', // COT-20260514-182523494-563
]);

export function AutovistoriaCotacao({ cotacaoId, tipoVeiculo, onComplete, fotosOverride, titulo }: AutovistoriaCotacaoProps) {
  const fotos = useMemo(
    () => (fotosOverride && fotosOverride.length > 0 ? fotosOverride : getFotosAutovistoria(tipoVeiculo)),
    [fotosOverride, tipoVeiculo],
  );
  const totalFotos = fotos.length;
  const instrucoesVideo = getInstrucoesVideo360(tipoVeiculo);
  const labelVideo = getLabelVideo360(tipoVeiculo);

  const [fotoAtualIndex, setFotoAtualIndex] = useState(0);
  const [kmIdentificado, setKmIdentificado] = useState<number | null>(null);
  const [kmOcrFalhou, setKmOcrFalhou] = useState(false);
  const [kmManualInput, setKmManualInput] = useState('');
  const [salvandoKm, setSalvandoKm] = useState(false);
  const [placaOcrPorFoto, setPlacaOcrPorFoto] = useState<Record<string, PlacaOcrResultado>>({});
  const [placaMismatch, setPlacaMismatch] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<'fotos' | 'video'>('fotos');
  /** Quando true, o useEffect de auto-posicionamento para no índice atual e
   *  permite o usuário navegar livre via thumbnails. */
  const [navegacaoManual, setNavegacaoManual] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const finalizandoRef = useRef(false);
  const restauradoToastRef = useRef(false);

  const capability = useDeviceCapability();
  const { data: fotosExistentes, isLoading: carregandoFotos } = useFotosCotacaoVistoria(cotacaoId);
  const finalizarMutation = useFinalizarVistoriaCotacao();

  const offline = useAutovistoriaOfflineUpload(cotacaoId);

  /**
   * Reconciliação canônica (toda renderização):
   *  - URL remota: fotos já confirmadas em `cotacoes_vistoria_fotos`.
   *  - URL local: blobs ainda na fila Dexie aguardando upload.
   *
   * Uma mídia conta como "presente" se EITHER lado tem registro. Isso elimina
   * a flag `hidratado` (que mascarava o estado real após refresh/discard) e
   * garante que o cliente NUNCA volte ao começo se já capturou algo.
   */
  const { fotosRemotas, videoUrl } = useMemo(() => {
    const remotas: Record<string, string> = {};
    let video: string | null = null;
    for (const foto of fotosExistentes || []) {
      if (!foto.tipo || !foto.arquivo_url) continue;
      if (foto.tipo === 'video_360') {
        video = foto.arquivo_url;
      } else {
        remotas[foto.tipo] = foto.arquivo_url;
      }
    }
    return { fotosRemotas: remotas, videoUrl: video };
  }, [fotosExistentes]);

  /** Slot → URL exibível (local preferida; remota como fallback). */
  const urlsExibiveis = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = { ...fotosRemotas };
    for (const [slot, url] of Object.entries(offline.urlsLocais)) {
      out[slot] = url;
    }
    return out;
  }, [fotosRemotas, offline.urlsLocais]);

  const slotsCompletos = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const k of Object.keys(fotosRemotas)) s.add(k);
    for (const k of Object.keys(offline.urlsLocais)) s.add(k);
    return s;
  }, [fotosRemotas, offline.urlsLocais]);

  const fotosCompletadas = fotos.reduce((acc, f) => acc + (slotsCompletos.has(f.id) ? 1 : 0), 0);
  const videoPresente = !!videoUrl || !!offline.urlsLocais['video_360'];
  const totalItens = totalFotos + 1; // fotos + vídeo 360°
  const itensCompletados = fotosCompletadas + (videoPresente ? 1 : 0);
  const progresso = (itensCompletados / totalItens) * 100;
  const todasFotosEnviadas = fotosCompletadas >= totalFotos;
  const todasEnviadas = todasFotosEnviadas && videoPresente;

  const fotoAtual = fotos[fotoAtualIndex];

  /**
   * Auto-posiciona no primeiro slot pendente (somente enquanto o usuário
   * não navegou manualmente). Roda continuamente para corrigir a posição
   * após refresh, restauração de aba ou novas capturas em background.
   */
  useEffect(() => {
    if (navegacaoManual) return;
    if (carregandoFotos) return;
    const indexPendente = fotos.findIndex((f) => !slotsCompletos.has(f.id));
    if (indexPendente >= 0) {
      if (indexPendente !== fotoAtualIndex || etapa !== 'fotos') {
        setEtapa('fotos');
        setFotoAtualIndex(indexPendente);
      }
    } else if (!videoPresente && etapa !== 'video') {
      // Todas as fotos prontas. Se ainda falta vídeo, vai pra etapa de vídeo.
      setEtapa('video');
    }
  }, [carregandoFotos, fotos, slotsCompletos, videoPresente, navegacaoManual, fotoAtualIndex, etapa]);

  /** Aviso único após restauração de aba pelo Chrome (descarte por OOM). */
  useEffect(() => {
    console.log(
      `[Autovistoria] Capacidade: deviceMemory=${capability.deviceMemory ?? '?'}GB cores=${capability.hardwareConcurrency ?? '?'} lowEnd=${capability.lowEnd} heap=${capability.usedHeapMB ?? '?'}MB wasDiscarded=${capability.wasDiscarded}`,
    );
    if (capability.wasDiscarded && !restauradoToastRef.current && (slotsCompletos.size > 0 || videoPresente)) {
      restauradoToastRef.current = true;
      toast.info('Continuamos de onde você parou. Sua captura anterior foi mantida.', {
        duration: 6000,
      });
    }
  }, [capability, slotsCompletos, videoPresente]);

  /** Reage a resultados de OCR (placa + odômetro) propagados pelo worker. */
  useEffect(() => {
    const slot = fotoAtual?.id;
    if (!slot) return;
    const r = offline.ocrPorSlot[slot];
    if (!r) return;

    if (slot === 'odometro' || slot === 'painel_ligado') {
      if (r.kmExtraido && r.kmExtraido !== kmIdentificado) {
        setKmIdentificado(r.kmExtraido);
        setKmOcrFalhou(false);
        void (publicSupabase as any)
          .from('cotacoes')
          .update({ km_atual: r.kmExtraido })
          .eq('id', cotacaoId)
          .then(() => {})
          .catch(() => {});
      } else if (r.ocrFalhou && !kmIdentificado && !kmOcrFalhou) {
        setKmOcrFalhou(true);
        toast.warning('Não conseguimos ler a quilometragem. Informe abaixo.', { duration: 6000 });
      }
    }

    if (r.placaOcr) {
      setPlacaOcrPorFoto((prev) => (prev[slot] === r.placaOcr ? prev : { ...prev, [slot]: r.placaOcr! }));
      const bypass = COTACOES_TESTE_BYPASS_OCR_PLACA.has(cotacaoId);
      if (!bypass && !r.placaOcr.skipped) {
        if (!r.placaOcr.legivel) {
          toast.warning('Placa ilegível na foto enviada. Refaça se for o caso.', { duration: 5000 });
        } else if (!r.placaOcr.match) {
          const lida = r.placaOcr.placa || 'desconhecida';
          setPlacaMismatch(`Placa lida (${lida}) diferente da cadastrada. Refaça se necessário.`);
        } else {
          setPlacaMismatch(null);
        }
      }
    }
  }, [offline.ocrPorSlot, fotoAtual, cotacaoId, kmIdentificado, kmOcrFalhou]);

  const handleCapturarFoto = () => {
    inputRef.current?.click();
  };

  /**
   * Captura → comprime → enfileira Dexie → avança UI.
   * O upload acontece em background no worker. Falha de upload NUNCA
   * descarta o blob (sobrevive a refresh/discard).
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 15MB.');
      e.target.value = '';
      return;
    }

    try {
      let arquivoFinal: File | Blob = file;
      if (file.size > 250 * 1024) {
        toast.loading('Otimizando imagem...', { id: 'compress' });
        try {
          arquivoFinal = await compressImage(file);
        } catch (compressError) {
          console.warn('[AutovistoriaCotacao] compressão falhou, usando original:', compressError);
        } finally {
          toast.dismiss('compress');
        }
      }

      const slot = fotoAtual.id;
      await offline.enfileirarFoto(slot, arquivoFinal);
      toast.success('Foto salva.', { duration: 1800 });

      if (slot === 'odometro' || slot === 'painel_ligado') {
        setKmOcrFalhou(false);
      }

      // Deixa o auto-posicionamento reagir à mudança em `slotsCompletos`.
      setNavegacaoManual(false);
    } catch (error: unknown) {
      console.error('[AutovistoriaCotacao] erro ao enfileirar foto:', error);
      toast.error('Não foi possível salvar a foto. Tente novamente.', {
        action: { label: 'Tentar novamente', onClick: () => inputRef.current?.click() },
      });
    }
    e.target.value = '';
  };

  const handleUploadVideo = useCallback(
    async (file: File) => {
      try {
        await offline.enfileirarVideo(file);
        toast.success('Vídeo salvo.', { duration: 1800 });
      } catch (e) {
        console.error('[AutovistoriaCotacao] erro ao enfileirar vídeo:', e);
        toast.error('Não foi possível salvar o vídeo. Tente novamente.');
      }
    },
    [offline],
  );

  const handleFinalizar = async () => {
    if (finalizandoRef.current || finalizarMutation.isPending) return;
    if (!todasFotosEnviadas) {
      toast.error('Capture todas as fotos antes de finalizar.');
      return;
    }
    if (!videoPresente) {
      toast.error('Grave o vídeo 360° terminando no painel ligado.');
      return;
    }
    if (offline.pendentes > 0) {
      toast.warning('Aguarde o envio das últimas mídias antes de concluir.', { duration: 4000 });
      void offline.forcarSync();
      return;
    }
    finalizandoRef.current = true;
    try {
      await finalizarMutation.mutateAsync({ cotacaoId, tipoVistoria: 'autovistoria' });
      onComplete();
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      finalizandoRef.current = false;
    }
  };

  const fotoJaEnviada = !!fotoAtual && slotsCompletos.has(fotoAtual.id);
  const fotoEmRemoto = !!fotoAtual && !!fotosRemotas[fotoAtual.id];
  const fotoEmFila = !!fotoAtual && !!offline.urlsLocais[fotoAtual.id];
  const isUploading = fotoEmFila && !fotoEmRemoto; // local presente, ainda subindo

  if (carregandoFotos) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Carregando vistoria...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-xl overflow-hidden">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{titulo ?? 'Autovistoria'}</CardTitle>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {itensCompletados}/{totalItens} itens
          </Badge>
        </div>
        <Progress value={progresso} className="h-2" />
      </CardHeader>

      <CardContent className="space-y-4">
        <InAppBrowserBanner persistent />

        {capability.lowEnd && (
          <div className="rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Detectamos memória limitada neste aparelho</p>
              <p className="text-xs leading-relaxed">
                Para evitar travamentos, feche outros aplicativos antes de tirar as fotos.
              </p>
            </div>
          </div>
        )}

        {placaMismatch && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Placa não confere</p>
              <p className="text-xs leading-relaxed">{placaMismatch}</p>
            </div>
          </div>
        )}

        {/* Indicadores de fotos (miniaturas) + vídeo */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {fotos.map((foto, index) => {
            const enviada = slotsCompletos.has(foto.id);
            const atual = etapa === 'fotos' && index === fotoAtualIndex;

            return (
              <button
                type="button"
                key={foto.id}
                onClick={() => { setEtapa('fotos'); setFotoAtualIndex(index); }}
                title={`Ir para: ${foto.label}`}
                className={cn(
                  "shrink-0 w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center cursor-pointer hover:opacity-80",
                  atual && "border-primary ring-2 ring-primary/20",
                  !atual && enviada && "border-success bg-success/10",
                  !atual && !enviada && "border-border/50 bg-muted/30"
                )}
              >
                {enviada ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
                )}
              </button>
            );
          })}
          {/* Miniatura do vídeo 360° */}
          <button
            type="button"
            onClick={() => { if (todasFotosEnviadas) setEtapa('video'); }}
            disabled={!todasFotosEnviadas}
            title={todasFotosEnviadas ? 'Vídeo 360°' : 'Conclua as fotos primeiro'}
            className={cn(
              "shrink-0 w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center",
              etapa === 'video' && "border-primary ring-2 ring-primary/20",
              etapa !== 'video' && videoUrl && "border-success bg-success/10",
              etapa !== 'video' && !videoUrl && "border-border/50 bg-muted/30",
              !todasFotosEnviadas && "opacity-50 cursor-not-allowed"
            )}
          >
            {videoUrl ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Video className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Foto atual */}
        {etapa === 'fotos' && (
        <AnimatePresence mode="wait">
          <motion.div
            key={fotoAtual.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Título e descrição */}
            <div className="text-center">
              <h3 className="font-semibold text-lg text-foreground">
                {fotoAtualIndex + 1}. {fotoAtual.label}
              </h3>
              {fotoAtual.descricao && (
                <p className="text-sm text-muted-foreground mt-1">
                  {fotoAtual.descricao}
                </p>
              )}
            </div>
            
            {/* Área de preview / captura */}
            <div className="relative aspect-[4/3] bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
              {(previewLocal || fotosEnviadas[fotoAtual.id]) ? (
                <div className="relative w-full h-full">
                  <img
                    src={previewLocal || fotosEnviadas[fotoAtual.id]}
                    alt={fotoAtual.label}
                    className="w-full h-full object-cover"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <p className="text-sm">Enviando...</p>
                      </div>
                    </div>
                  )}
                  {fotoJaEnviada && !isUploading && (
                    <>
                      <div className="absolute top-3 right-3">
                        <div className="bg-success text-white rounded-full p-1.5">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      </div>
                      {/* Botão "Refazer" sobreposto, sempre visível (parity com vídeo) */}
                      <div className="absolute bottom-3 right-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleCapturarFoto}
                          className="h-8 text-xs shadow-lg backdrop-blur-sm bg-background/90 hover:bg-background"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refazer
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleCapturarFoto}
                  disabled={isUploading}
                  className="w-full h-full flex flex-col items-center justify-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="h-8 w-8 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    Toque para fotografar
                  </span>
                </button>
              )}
            </div>

            {/* Resultado do OCR de placa */}
            {placaOcrPorFoto[fotoAtual.id] && !placaOcrPorFoto[fotoAtual.id].skipped && !COTACOES_TESTE_BYPASS_OCR_PLACA.has(cotacaoId) && (
              <div className={cn(
                "rounded-lg p-2.5 flex items-center gap-2 border text-xs",
                placaOcrPorFoto[fotoAtual.id].match && placaOcrPorFoto[fotoAtual.id].legivel
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              )}>
                <ScanLine className="h-4 w-4 shrink-0" />
                {placaOcrPorFoto[fotoAtual.id].match && placaOcrPorFoto[fotoAtual.id].legivel ? (
                  <span>Placa confere: <strong>{placaOcrPorFoto[fotoAtual.id].placa}</strong></span>
                ) : !placaOcrPorFoto[fotoAtual.id].legivel ? (
                  <span>Placa ilegível — refaça a foto.</span>
                ) : (
                  <span>Placa lida: <strong>{placaOcrPorFoto[fotoAtual.id].placa}</strong> — diferente da cadastrada.</span>
                )}
              </div>
            )}

            {/* Confirmação pós-envio */}
            {fotoJaEnviada && !isUploading && fotoAtual.id !== 'odometro' && fotoAtual.id !== 'painel_ligado' && (
              <div className="bg-success/5 border border-success/20 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/80 leading-relaxed">
                  <strong>Foto enviada.</strong> Caso queira refazer, use o botão "Refazer" ou
                  toque no número da etapa acima.
                </p>
              </div>
            )}
            {/* KM identificado (odômetro/painel) */}
            {(fotoAtual.id === 'odometro' || fotoAtual.id === 'painel_ligado') && kmIdentificado && (
              <div className="bg-primary/5 p-3 rounded-lg flex items-center gap-3 border border-primary/20">
                <Gauge className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">KM Identificado</p>
                  <p className="font-bold text-primary">
                    {kmIdentificado.toLocaleString('pt-BR')} km
                  </p>
                </div>
              </div>
            )}

            {/* Fallback manual: OCR do odômetro/painel falhou */}
            {(fotoAtual.id === 'odometro' || fotoAtual.id === 'painel_ligado') && kmOcrFalhou && !kmIdentificado && (
              <div className="space-y-2">
                <OcrFallbackBanner
                  documento="a quilometragem do odômetro"
                  detalhe="Informe abaixo o número exato exibido no painel para podermos prosseguir."
                />
                <div className="space-y-1">
                  <Label htmlFor="km-manual-cot" className="text-xs">
                    Quilometragem atual (km) <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="km-manual-cot"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Ex.: 45230"
                      value={kmManualInput}
                      onChange={(e) => setKmManualInput(e.target.value.replace(/\D/g, ''))}
                      disabled={salvandoKm}
                    />
                    <Button
                      type="button"
                      onClick={async () => {
                        const n = Number(kmManualInput);
                        if (!Number.isFinite(n) || n <= 0) {
                          toast.error('Informe um valor válido de KM.');
                          return;
                        }
                        setSalvandoKm(true);
                        try {
                          const { error } = await (publicSupabase as any)
                            .from('cotacoes')
                            .update({ km_atual: n })
                            .eq('id', cotacaoId);
                          if (error) throw error;
                          setKmIdentificado(n);
                          setKmOcrFalhou(false);
                          toast.success(`Quilometragem registrada: ${n.toLocaleString('pt-BR')} km`);
                          setTimeout(() => {
                            setFotoAtualIndex((prev) => Math.min(prev + 1, totalFotos - 1));
                          }, 400);
                        } catch (e: any) {
                          console.error('[AutovistoriaCotacao] erro ao salvar KM manual:', e);
                          toast.error('Não foi possível salvar a quilometragem. Tente novamente.');
                        } finally {
                          setSalvandoKm(false);
                        }
                      }}
                      disabled={salvandoKm || !kmManualInput}
                    >
                      {salvandoKm ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            
            {/* Instruções */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="h-4 w-4 text-primary" />
                Instruções
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                {fotoAtual.instrucoes.map((instrucao, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                    {instrucao}
                  </li>
                ))}
              </ul>
              
              {fotoAtual.evitar && fotoAtual.evitar.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive mt-3">
                    <AlertCircle className="h-4 w-4" />
                    Evitar
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    {fotoAtual.evitar.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <X className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              
              {fotoAtual.dicaExtra && (
                <p className="text-xs text-primary mt-2 bg-primary/5 p-2 rounded">
                  💡 {fotoAtual.dicaExtra}
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        )}

        {/* Botão de captura */}
        {etapa === 'fotos' && (
        <div className="flex justify-center pt-2">
          {!fotoJaEnviada ? (
            <Button
              onClick={handleCapturarFoto}
              disabled={isUploading}
              className="bg-primary hover:bg-primary/90 w-full max-w-xs"
              size="lg"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              {isUploading ? 'Enviando...' : 'Fotografar'}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleCapturarFoto}
              disabled={isUploading}
              className="w-full max-w-xs"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Refazer Foto
            </Button>
          )}
        </div>
        )}

        {/* Bloco do vídeo 360° — etapa dedicada após as fotos */}
        {etapa === 'video' && todasFotosEnviadas && (
          <div className="space-y-3 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base text-foreground">{labelVideo}</h3>
              <Badge variant={videoUrl ? 'default' : 'secondary'} className={cn(videoUrl && 'bg-success text-white')}>
                {videoUrl ? 'Enviado' : 'Obrigatório'}
              </Badge>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="h-4 w-4 text-primary" />
                Como gravar
              </div>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-5">
                {instrucoesVideo.map((p) => (
                  <li key={p.passo}>
                    {p.texto}
                    {p.destaque && (
                      <span className="block text-primary font-medium mt-1">⚠ {p.destaque}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <VideoCapture
              onCapture={handleUploadVideo}
              onReset={() => setVideoUrl(null)}
              videoUrl={videoUrl || undefined}
              uploading={uploadingVideo}
              uploadProgress={uploadingVideo ? videoProgress : undefined}
              maxDuration={120}
              label="Grave o vídeo 360° terminando no painel ligado"
            />
          </div>
        )}

        {/* Botão finalizar — sticky e destacado para não ficar travado em mobile */}
        {todasEnviadas && (
          <motion.div
            ref={(el) => {
              if (el && !finalizandoRef.current) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky bottom-2 z-20 pt-4"
          >
            <div className="bg-success/10 border border-success/30 rounded-xl p-3 mb-2 text-center">
              <p className="text-sm font-medium text-success-foreground/90">
                ✅ Tudo pronto! Confirme para concluir a vistoria.
              </p>
            </div>
            <Button
              onClick={handleFinalizar}
              disabled={finalizarMutation.isPending}
              className="w-full bg-success hover:bg-success/90 text-white shadow-lg"
              size="lg"
            >
              {finalizarMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5 mr-2" />
              )}
              Confirmar e Concluir Vistoria
            </Button>
          </motion.div>
        )}
        
        {/* Input file oculto */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}
