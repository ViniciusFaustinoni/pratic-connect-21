import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Video,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { getFotosAutovistoria, type TipoVeiculo, type FotoAutovistoria } from '@/data/autovistoriaConfig';
import { useFotosCotacaoVistoria, useUploadFotoCotacaoVistoria, useFinalizarVistoriaCotacao } from '@/hooks/useCotacaoVistoria';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage, createOptimizedPreview, revokePreview } from '@/lib/imageCompressor';
import { VideoCapture } from '@/components/instalador/VideoCapture';


interface AutovistoriaCotacaoProps {
  cotacaoId: string;
  tipoVeiculo: TipoVeiculo;
  onComplete: () => void;
}

export function AutovistoriaCotacao({ cotacaoId, tipoVeiculo, onComplete }: AutovistoriaCotacaoProps) {
  const fotos = getFotosAutovistoria(tipoVeiculo);
  const totalFotos = fotos.length;
  
  const [fotoAtualIndex, setFotoAtualIndex] = useState(0);
  const [fotosEnviadas, setFotosEnviadas] = useState<Record<string, string>>({});
  const [kmIdentificado, setKmIdentificado] = useState<number | null>(null);
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [hidratado, setHidratado] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const finalizandoRef = useRef(false);
  
  const { data: fotosExistentes, isLoading: carregandoFotos } = useFotosCotacaoVistoria(cotacaoId);
  const uploadMutation = useUploadFotoCotacaoVistoria();
  const finalizarMutation = useFinalizarVistoriaCotacao();
  
  const fotoAtual = fotos[fotoAtualIndex];
  const fotosCompletadas = Object.keys(fotosEnviadas).length;
  const progresso = ((fotosCompletadas + (videoUrl ? 1 : 0)) / (totalFotos + 1)) * 100;
  const todasFotosEnviadas = fotosCompletadas >= totalFotos;
  const todasEnviadas = todasFotosEnviadas && !!videoUrl;
  
  // Reidratar fotos existentes (refresh mantém progresso)
  useEffect(() => {
    if (fotosExistentes && fotosExistentes.length > 0 && !hidratado) {
      const fotosMap: Record<string, string> = {};
      let videoExistente: string | null = null;
      
      for (const foto of fotosExistentes) {
        if (foto.tipo && foto.arquivo_url) {
          if (foto.tipo === 'video_360') {
            videoExistente = foto.arquivo_url;
          } else {
            fotosMap[foto.tipo] = foto.arquivo_url;
          }
        }
      }
      
      if (Object.keys(fotosMap).length > 0) {
        setFotosEnviadas(fotosMap);
      }
      
      if (videoExistente) {
        setVideoUrl(videoExistente);
      }
      
      const totalCarregados = Object.keys(fotosMap).length + (videoExistente ? 1 : 0);
      if (totalCarregados > 0) {
        toast.success(`${totalCarregados} arquivo(s) carregado(s) de sessão anterior`);
      }
      
      // Ir para próxima foto pendente
      const indexPendente = fotos.findIndex(f => !fotosMap[f.id]);
      if (indexPendente >= 0) {
        setFotoAtualIndex(indexPendente);
      }
      
      setHidratado(true);
    }
  }, [fotosExistentes, fotos, hidratado]);
  
  // Limpar previews ao desmontar para liberar memória
  useEffect(() => {
    return () => {
      if (previewLocal) {
        revokePreview(previewLocal);
      }
    };
  }, []);

  const handleCapturarFoto = () => {
    inputRef.current?.click();
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tamanho (max 15MB antes de comprimir)
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 15MB.');
      e.target.value = '';
      return;
    }
    
    // Preview local imediato usando Object URL
    if (previewLocal) {
      revokePreview(previewLocal);
    }
    const localUrl = createOptimizedPreview(file);
    setPreviewLocal(localUrl);
    
    try {
      // Comprimir imagem para economizar memória e acelerar upload
      let arquivoFinal = file;
      if (file.size > 500 * 1024) {
        toast.loading('Otimizando imagem...', { id: 'compress' });
        try {
          arquivoFinal = await compressImage(file, { 
            maxWidth: 1920, 
            maxHeight: 1920, 
            quality: 0.75,
            maxSizeKB: 800 
          });
          toast.dismiss('compress');
        } catch (compressError) {
          console.warn('[AutovistoriaCotacao] Erro na compressão, usando original:', compressError);
          toast.dismiss('compress');
        }
      }

      // Tentar obter geolocalização
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch {
          console.log('Geolocalização não disponível');
        }
      }
      
      const result = await uploadMutation.mutateAsync({
        cotacaoId,
        fotoId: fotoAtual.id,
        file: arquivoFinal,
        latitude,
        longitude,
      });
      
      // Atualizar estado local
      setFotosEnviadas(prev => ({ ...prev, [fotoAtual.id]: result.url }));
      
      // Liberar preview local após sucesso
      revokePreview(localUrl);
      setPreviewLocal(null);
      
      // Se extraiu KM do odômetro
      if (result.kmExtraido) {
        setKmIdentificado(result.kmExtraido);
        toast.success(`Quilometragem identificada: ${result.kmExtraido.toLocaleString('pt-BR')} km`);
      } else {
        toast.success('Foto enviada com sucesso!');
      }
      
      // Avançar para próxima foto automaticamente
      if (fotoAtualIndex < totalFotos - 1) {
        setTimeout(() => setFotoAtualIndex(fotoAtualIndex + 1), 800);
      }
    } catch (error: any) {
      console.error('[AutovistoriaCotacao] Erro no upload:', error);
      toast.error('Não foi possível enviar a foto. Tente novamente.', {
        action: {
          label: 'Tentar novamente',
          onClick: () => inputRef.current?.click(),
        },
      });
    }
    
    e.target.value = '';
  };

  const handleVideoCapture = async (file: File) => {
    setUploadingVideo(true);
    try {
      const result = await uploadMutation.mutateAsync({
        cotacaoId,
        fotoId: 'video_360',
        file,
      });
      setVideoUrl(result.url);
      toast.success('Vídeo 360° enviado com sucesso!');
    } catch (error) {
      console.error('[AutovistoriaCotacao] Erro no upload do vídeo:', error);
      toast.error('Erro ao enviar vídeo. Tente novamente.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleVideoReset = () => {
    setVideoUrl(null);
  };
  
  const handleFinalizar = async () => {
    if (finalizandoRef.current || finalizarMutation.isPending) return;
    finalizandoRef.current = true;
    
    try {
      await finalizarMutation.mutateAsync({
        cotacaoId,
        tipoVistoria: 'autovistoria'
      });
      onComplete();
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      finalizandoRef.current = false;
    }
  };
  
  const fotoJaEnviada = !!fotosEnviadas[fotoAtual?.id];
  const isUploading = uploadMutation.isPending && !uploadingVideo;
  
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

  // ETAPA 1: Vídeo 360° (obrigatório antes das fotos)
  if (!videoUrl) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-xl overflow-hidden">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Autovistoria</CardTitle>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Etapa 1 de 2
            </Badge>
          </div>
          <Progress value={0} className="h-2" />
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Video className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Grave o Vídeo 360°
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Siga as instruções abaixo para gravar o vídeo do veículo.
              </p>
            </div>
          </div>

          {/* Instruções de gravação */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border/50">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Instruções de Gravação
            </h4>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                <span>Comece filmando a <strong className="text-foreground">frente do veículo com a placa visível</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                <span>Caminhe lentamente pela <strong className="text-foreground">lateral direita</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
                <span>Filme a <strong className="text-foreground">traseira com a placa visível</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">4</span>
                <span>Continue pela <strong className="text-foreground">lateral esquerda</strong> até voltar à frente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">5</span>
                <span>Entre no veículo e filme o <strong className="text-foreground">interior: bancos, forração e teto</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">6</span>
                <span><strong className="text-foreground">Ligue o veículo</strong> e filme o <strong className="text-foreground">painel ligado</strong> mostrando hodômetro e indicadores</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">7</span>
                <span>Filme o <strong className="text-foreground">compartimento do motor</strong> com o capô aberto</span>
              </li>
            </ol>
            <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span>Duração mínima: <strong>30 segundos</strong> / Máxima: <strong>2 minutos</strong></span>
            </div>
          </div>

          <VideoCapture
            onCapture={handleVideoCapture}
            onReset={handleVideoReset}
            videoUrl={videoUrl ?? undefined}
            uploading={uploadingVideo}
            confirmed={!!videoUrl}
            maxDuration={120}
            label="Vídeo 360° do Veículo"
            cameraOnly={true}
          />
        </CardContent>
      </Card>
    );
  }
  
  // ETAPA 2: Fotos (chassi + motor)
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-xl overflow-hidden">
      {/* Header com progresso */}
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Autovistoria</CardTitle>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {fotosCompletadas}/{totalFotos} fotos • 1/1 vídeo
          </Badge>
        </div>
        <Progress value={progresso} className="h-2" />
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Vídeo OK indicator */}
        <div className="flex items-center gap-2 bg-success/10 text-success rounded-lg p-2.5 border border-success/20">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-medium">Vídeo 360° enviado</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleVideoReset}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Regravar
          </Button>
        </div>

        {/* Indicadores de fotos (miniaturas) */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {fotos.map((foto, index) => {
            const enviada = !!fotosEnviadas[foto.id];
            const atual = index === fotoAtualIndex;
            
            return (
              <div
                key={foto.id}
                className={cn(
                  "shrink-0 w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center",
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
              </div>
            );
          })}
        </div>
        
        {/* Foto atual */}
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
                    <div className="absolute top-3 right-3">
                      <div className="bg-success text-white rounded-full p-1.5">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                    </div>
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
            
            {/* KM identificado (odômetro) */}
            {fotoAtual.id === 'odometro' && kmIdentificado && (
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
        
        {/* Botão de captura */}
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
        

        {/* Botão finalizar */}
        {todasEnviadas && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-4"
          >
            <Button
              onClick={handleFinalizar}
              disabled={finalizarMutation.isPending}
              className="w-full bg-success hover:bg-success/90 text-white"
              size="lg"
            >
              {finalizarMutation.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5 mr-2" />
              )}
              Concluir Vistoria
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
