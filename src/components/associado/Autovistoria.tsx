import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Check, ArrowLeft, ArrowRight, Loader2, ChevronRight, Gauge, 
  CheckCircle, XCircle, Lightbulb, RotateCcw, Lock, RefreshCw, AlertTriangle,
  Video
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getFotosAutovistoria, TipoVeiculo } from '@/data/autovistoriaConfig';
import { useCriarAutovistoria, useUploadFotoAutovistoria, useAutovistoriaExistente, useFinalizarAutovistoria } from '@/hooks/useContratoLink';
import { toast } from 'sonner';
import { compressImage, createOptimizedPreview, revokePreview } from '@/lib/imageCompressor';
import { LocationCapture, Coordenadas } from './LocationCapture';
import { VideoCapture } from '@/components/instalador/VideoCapture';

interface AutovistoriaProps {
  contratoId: string;
  associadoId: string;
  veiculoId?: string;
  tipoVeiculo: TipoVeiculo;
  readOnly?: boolean;
  onComplete: (vistoriaId: string) => void;
  onVoltar: () => void;
}

// Interface para resultado da validação do chassi
interface ChassiResultado {
  chassi: string | null;
  validacao: 'confere' | 'diverge' | 'ilegivel' | null;
  confianca: number;
}

export function Autovistoria({ contratoId, associadoId, veiculoId, tipoVeiculo, readOnly, onComplete, onVoltar }: AutovistoriaProps) {
  const fotos = getFotosAutovistoria(tipoVeiculo);
  const [fotosEnviadas, setFotosEnviadas] = useState<Record<string, string>>({});
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [vistoriaId, setVistoriaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kmIdentificado, setKmIdentificado] = useState<number | null>(null);
  const [previewsLocais, setPreviewsLocais] = useState<Record<string, string>>({});
  const [hidratado, setHidratado] = useState(false);
  const [imagensComErro, setImagensComErro] = useState<Record<string, boolean>>({});
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
  const [chassiResultado, setChassiResultado] = useState<ChassiResultado | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Buscar autovistoria existente para reidratar fotos após refresh
  const { data: vistoriaExistente, isLoading: carregandoVistoria } = useAutovistoriaExistente(contratoId);

  const criarAutovistoria = useCriarAutovistoria();
  const uploadFoto = useUploadFotoAutovistoria();
  const finalizarAutovistoria = useFinalizarAutovistoria();

  // Reidratar estado quando carregar vistoria existente
  useEffect(() => {
    if (vistoriaExistente && !hidratado) {
      console.log('[Autovistoria] Reidratando fotos existentes:', vistoriaExistente);
      setVistoriaId(vistoriaExistente.id);
      
      // Montar mapa de fotos: { [tipo]: arquivo_url }
      const fotosMap: Record<string, string> = {};
      if (vistoriaExistente.fotos && Array.isArray(vistoriaExistente.fotos)) {
        for (const foto of vistoriaExistente.fotos) {
          if (foto.tipo && foto.arquivo_url) {
            fotosMap[foto.tipo] = foto.arquivo_url;
          }
        }
      }
      
      if (Object.keys(fotosMap).length > 0) {
        setFotosEnviadas(fotosMap);
        toast.success(`${Object.keys(fotosMap).length} foto(s) carregadas de sessão anterior`);
      }
      
      setHidratado(true);
    }
  }, [vistoriaExistente, hidratado]);

  const totalFotos = fotos.length;
  const fotosCompletadas = Object.keys(fotosEnviadas).length;
  const progresso = (fotosCompletadas / totalFotos) * 100;
  const todasFotosEnviadas = fotosCompletadas === totalFotos;
  const videoObrigatorio = true; // Vídeo obrigatório para TODOS os tipos
  const todasEnviadas = todasFotosEnviadas && !!videoUrl;
  
  const fotoAtual = fotos[indiceAtual];
  const isUltimaFoto = indiceAtual === totalFotos - 1;
  const isPrimeiraFoto = indiceAtual === 0;
  const fotoAtualEnviada = !!fotosEnviadas[fotoAtual.id];

  // Finalizar autovistoria quando todas as fotos forem enviadas
  useEffect(() => {
    if (todasEnviadas && vistoriaId && hidratado) {
      finalizarAutovistoria.mutate({ vistoriaId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasEnviadas, vistoriaId, hidratado]);

  const avancarFoto = () => {
    if (indiceAtual < totalFotos - 1) {
      setIndiceAtual(prev => prev + 1);
    }
  };

  const voltarFoto = () => {
    if (indiceAtual > 0) {
      setIndiceAtual(prev => prev - 1);
    }
  };

  const handleTirarFoto = async () => {
    // Verificar se localização foi capturada (obrigatório)
    if (!coordenadas) {
      toast.error('Por favor, permita o acesso à sua localização antes de tirar as fotos.');
      return;
    }
    
    // Criar vistoria se ainda não existir
    if (!vistoriaId) {
      try {
        const result = await criarAutovistoria.mutateAsync({ 
          contratoId, 
          associadoId, 
          veiculoId,
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
        });
        setVistoriaId(result.id);
      } catch (error) {
        toast.error('Erro ao iniciar autovistoria');
        return;
      }
    }
    
    inputRef.current?.click();
  };

  // Limpar previews locais ao desmontar para liberar memória
  useEffect(() => {
    return () => {
      Object.values(previewsLocais).forEach((url) => {
        revokePreview(url);
      });
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vistoriaId) return;

    // Validar tamanho (max 15MB antes de comprimir)
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 15MB.');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas imagens.');
      return;
    }

    // Criar preview local usando Object URL (muito mais eficiente que base64)
    const previewUrl = createOptimizedPreview(file);
    
    // Revogar preview anterior se existir
    if (previewsLocais[fotoAtual.id]) {
      revokePreview(previewsLocais[fotoAtual.id]);
    }
    
    setPreviewsLocais(prev => ({
      ...prev,
      [fotoAtual.id]: previewUrl,
    }));

    setUploading(true);
    try {
      // Comprimir imagem para economizar memória e acelerar upload
      let arquivoFinal = file;
      if (file.size > 500 * 1024) { // Comprimir se > 500KB
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
          console.warn('[Autovistoria] Erro na compressão, usando original:', compressError);
          toast.dismiss('compress');
        }
      }

      const result = await uploadFoto.mutateAsync({
        vistoriaId,
        fotoId: fotoAtual.id,
        file: arquivoFinal,
        contratoId,
      });

      setFotosEnviadas(prev => ({
        ...prev,
        [fotoAtual.id]: result.url,
      }));

      // Se for odômetro e KM foi extraído, mostrar
      if (fotoAtual.id === 'odometro' && result.kmExtraido) {
        setKmIdentificado(result.kmExtraido);
        toast.success(`Quilometragem identificada: ${result.kmExtraido.toLocaleString('pt-BR')} km`);
      } 
      // Se for chassi e validação foi realizada, mostrar feedback ao cliente
      else if (fotoAtual.id === 'chassi' && result.chassiValidacao) {
        setChassiResultado(result.chassiValidacao);
        
        if (result.chassiValidacao.validacao === 'confere') {
          toast.success('✅ Chassi validado automaticamente!', {
            duration: 5000,
            description: 'O número confere com o cadastro.',
          });
        } else if (result.chassiValidacao.validacao === 'diverge') {
          toast.error('⚠️ Atenção: O chassi da foto não confere com o cadastro!', {
            duration: 8000,
            description: 'Verifique se a foto está correta ou tire novamente.',
          });
        } else if (result.chassiValidacao.validacao === 'ilegivel') {
          toast.warning('Não foi possível ler o chassi na foto.', {
            duration: 6000,
            description: 'Tente tirar uma nova foto com melhor iluminação.',
          });
        }
      } else {
        toast.success(`Foto "${fotoAtual.label}" enviada com sucesso!`);
      }
      
      // Avançar automaticamente para a próxima foto após sucesso
      if (!isUltimaFoto) {
        setTimeout(() => {
          avancarFoto();
        }, 500);
      }
    } catch (error: any) {
      console.error('[Autovistoria] Erro no upload:', error);
      // Mensagem amigável em vez de erro técnico
      toast.error('Não foi possível enviar a foto. Tente novamente.', {
        action: {
          label: 'Tentar novamente',
          onClick: () => inputRef.current?.click(),
        },
      });
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleVideoCapture = async (file: File) => {
    // Criar vistoria se ainda não existir
    let currentVistoriaId = vistoriaId;
    if (!currentVistoriaId) {
      if (!coordenadas) {
        toast.error('Por favor, permita o acesso à sua localização antes de gravar o vídeo.');
        return;
      }
      try {
        const result = await criarAutovistoria.mutateAsync({ 
          contratoId, 
          associadoId, 
          veiculoId,
          latitude: coordenadas.latitude,
          longitude: coordenadas.longitude,
        });
        currentVistoriaId = result.id;
        setVistoriaId(result.id);
      } catch (error) {
        toast.error('Erro ao iniciar autovistoria');
        return;
      }
    }
    
    setUploadingVideo(true);
    try {
      const result = await uploadFoto.mutateAsync({
        vistoriaId: currentVistoriaId!,
        fotoId: 'video_360',
        file,
        contratoId,
      });
      setVideoUrl(result.url);
      toast.success('Vídeo 360° enviado com sucesso!');
    } catch (error) {
      console.error('[Autovistoria] Erro no upload do vídeo:', error);
      toast.error('Erro ao enviar vídeo. Tente novamente.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleVideoReset = () => {
    // O vídeo anterior já foi salvo silenciosamente no servidor
    // Apenas limpar a referência local para permitir nova gravação
    setVideoUrl(null);
  };

  const handleContinuar = () => {
    if (vistoriaId) {
      onComplete(vistoriaId);
    }
  };

  // Loading enquanto carrega vistoria existente
  if (carregandoVistoria && !hidratado) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Carregando vistoria...</p>
        </CardContent>
      </Card>
    );
  }

  // NOVO FLUXO: Vídeo com instruções PRIMEIRO, depois fotos
  // Etapa 1: Se ainda não tem vídeo, mostrar instruções + gravação
  if (!videoUrl && !todasFotosEnviadas) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 pb-8 space-y-6">
          {/* Captura de Localização - OBRIGATÓRIO */}
          <LocationCapture 
            onLocationCapture={setCoordenadas}
            coordenadas={coordenadas}
            disabled={readOnly}
          />

          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Video className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Etapa 1: Grave o Vídeo 360°
              </h2>
              <p className="text-muted-foreground mt-1">
                Siga as instruções abaixo para gravar o vídeo do veículo.
              </p>
            </div>
          </div>

          {/* Instruções de gravação */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
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
                <span>Filme o <strong className="text-foreground">interior: painel, bancos e odômetro</strong></span>
              </li>
            </ol>
            <div className="flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span>Duração mínima: <strong>30 segundos</strong> / Máxima: <strong>2 minutos</strong></span>
            </div>
          </div>

          <VideoCapture
            onCapture={handleVideoCapture}
            onReset={handleVideoReset}
            videoUrl={videoUrl || undefined}
            uploading={uploadingVideo}
            maxDuration={120}
            label="Vídeo 360° do Veículo"
            cameraOnly={true}
          />
        </CardContent>
      </Card>
    );
  }

  // Etapa 1.5: Vídeo gravado mas fotos pendentes - mostrar vídeo OK + ir para fotos
  if (videoUrl && !todasFotosEnviadas) {
    // Continua para a tela de fotos abaixo (fluxo normal de fotos)
  }

  // Se todas foram enviadas (fotos + vídeo), mostrar tela de conclusão
  if (todasEnviadas) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
                Autovistoria Concluída!
              </h2>
              <p className="text-muted-foreground mt-1">
                Todas as {totalFotos} fotos e o vídeo 360° foram enviados com sucesso.
              </p>
            </div>
          </div>

          {/* Quilometragem Identificada */}
          {kmIdentificado && (
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg flex items-center gap-3 border border-blue-200 dark:border-blue-900">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Gauge className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quilometragem Identificada</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {kmIdentificado.toLocaleString('pt-BR')} km
                </p>
              </div>
            </div>
          )}

          {/* Resultado da Validação do Chassi */}
          {chassiResultado && chassiResultado.validacao && (
            <div className={`p-4 rounded-lg flex items-center gap-3 border ${
              chassiResultado.validacao === 'confere'
                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                : chassiResultado.validacao === 'diverge'
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                chassiResultado.validacao === 'confere'
                  ? 'bg-green-500'
                  : chassiResultado.validacao === 'diverge'
                  ? 'bg-red-500'
                  : 'bg-amber-500'
              }`}>
                {chassiResultado.validacao === 'confere' ? (
                  <CheckCircle className="h-5 w-5 text-white" />
                ) : chassiResultado.validacao === 'diverge' ? (
                  <XCircle className="h-5 w-5 text-white" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="flex-1">
                {chassiResultado.validacao === 'confere' ? (
                  <>
                    <p className="font-semibold text-green-700 dark:text-green-400">
                      Chassi Validado
                    </p>
                    <p className="text-sm text-muted-foreground">
                      O número do chassi confere com o cadastro.
                    </p>
                  </>
                ) : chassiResultado.validacao === 'diverge' ? (
                  <>
                    <p className="font-semibold text-red-700 dark:text-red-400">
                      Chassi Divergente
                    </p>
                    <p className="text-sm text-muted-foreground">
                      O número da foto não confere com o cadastro.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      Chassi Ilegível
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Não foi possível ler o chassi na foto.
                    </p>
                  </>
                )}
                {chassiResultado.confianca > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Confiança: {Math.round(chassiResultado.confianca * 100)}%
                  </p>
                )}
              </div>
            </div>
          )}

          <Button onClick={handleContinuar} className="w-full" size="lg">
            Continuar para Pagamento
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" onClick={onVoltar} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 flex items-center justify-between">
            <CardTitle className="text-lg">
              Etapa 2: Foto {indiceAtual + 1} de {totalFotos}
            </CardTitle>
            {fotoAtualEnviada && (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                <Check className="h-3 w-3 mr-1" /> Enviada
              </Badge>
            )}
          </div>
        </div>
        <Progress value={progresso} className="h-2" />
        <p className="text-xs text-muted-foreground text-center mt-1">
          {fotosCompletadas} de {totalFotos} fotos enviadas
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Captura de Localização - OBRIGATÓRIO */}
        <LocationCapture 
          onLocationCapture={setCoordenadas}
          coordenadas={coordenadas}
          disabled={readOnly}
        />
        
        {/* Ícone ilustrativo */}
        <div className="bg-muted rounded-xl p-8 flex flex-col items-center justify-center min-h-[200px]">
          {(fotoAtualEnviada || previewsLocais[fotoAtual.id]) && !imagensComErro[fotoAtual.id] ? (
            <div className="relative w-full">
              <img 
                src={previewsLocais[fotoAtual.id] || fotosEnviadas[fotoAtual.id] || ''}
                alt={fotoAtual.label}
                className="w-full max-h-48 object-contain rounded-lg"
                onError={() => {
                  console.warn(`[Autovistoria] Erro ao carregar imagem: ${fotoAtual.id}`);
                  setImagensComErro(prev => ({ ...prev, [fotoAtual.id]: true }));
                }}
                onLoad={() => {
                  if (imagensComErro[fotoAtual.id]) {
                    setImagensComErro(prev => ({ ...prev, [fotoAtual.id]: false }));
                  }
                }}
              />
              {/* Overlay de loading durante upload */}
              {uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                    <span className="text-white text-sm font-medium">Enviando...</span>
                  </div>
                </div>
              )}
              {/* Check de sucesso quando enviada */}
              {fotoAtualEnviada && !uploading && (
                <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Camera className="h-10 w-10 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground text-center font-medium">
                {fotoAtual.label}
              </span>
              {imagensComErro[fotoAtual.id] && fotoAtualEnviada && (
                <span className="text-xs text-amber-600 mt-2">Erro ao carregar preview - foto já enviada</span>
              )}
            </>
          )}
        </div>

        {/* Nome e descrição da foto */}
        <div className="text-center">
          <h3 className="text-xl font-bold">{fotoAtual.label}</h3>
          {fotoAtual.descricao && (
            <p className="text-muted-foreground text-sm mt-1">{fotoAtual.descricao}</p>
          )}
        </div>

        {/* Quilometragem Identificada (se for odômetro) */}
        {fotoAtual.id === 'odometro' && kmIdentificado && (
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg flex items-center gap-3 border border-blue-200 dark:border-blue-900">
            <Gauge className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">KM Identificado</p>
              <p className="font-bold text-blue-700 dark:text-blue-400">
                {kmIdentificado.toLocaleString('pt-BR')} km
              </p>
            </div>
          </div>
        )}

        {/* Instruções - O que fazer */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Como tirar esta foto:
          </h4>
          <ul className="space-y-1.5 pl-6">
            {fotoAtual.instrucoes.map((instrucao, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <span>{instrucao}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Evitar - O que não fazer */}
        {fotoAtual.evitar?.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Evite:
            </h4>
            <ul className="space-y-1.5 pl-6">
              {fotoAtual.evitar.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dica Extra */}
        {fotoAtual.dicaExtra && (
          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {fotoAtual.dicaExtra}
              </p>
            </div>
          </div>
        )}

        {/* Botão de Tirar Foto */}
        <Button 
          onClick={handleTirarFoto} 
          className="w-full h-14 text-lg"
          disabled={uploading || readOnly}
          variant={fotoAtualEnviada ? "outline" : "default"}
        >
          {readOnly ? (
            <>
              <Lock className="h-5 w-5 mr-2" />
              Envio Bloqueado
            </>
          ) : uploading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Enviando...
            </>
          ) : fotoAtualEnviada ? (
            <>
              <RotateCcw className="h-5 w-5 mr-2" />
              Tirar Novamente
            </>
          ) : (
            <>
              <Camera className="h-5 w-5 mr-2" />
              Tirar Foto
            </>
          )}
        </Button>

        {/* Input Hidden - só mostra se não for readOnly */}
        {!readOnly && (
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        )}

        {/* Navegação entre fotos */}
        <div className="flex justify-between pt-2 border-t">
          <Button 
            variant="outline" 
            onClick={voltarFoto}
            disabled={isPrimeiraFoto || uploading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>
          
          <Button 
            variant="outline" 
            onClick={avancarFoto}
            disabled={isUltimaFoto || uploading || !fotoAtualEnviada}
          >
            Próxima
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Aviso de foto obrigatória */}
        {!fotoAtualEnviada && !uploading && (
          <p className="text-xs text-center text-amber-600 dark:text-amber-400 py-2">
            Esta foto é obrigatória para continuar
          </p>
        )}

        {/* Resumo rápido das fotos */}
        <div className="flex flex-wrap gap-1.5 justify-center pt-2">
          {fotos.map((foto, index) => (
            <button
              key={foto.id}
              onClick={() => setIndiceAtual(index)}
              className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                index === indiceAtual
                  ? 'bg-primary text-primary-foreground'
                  : fotosEnviadas[foto.id]
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {fotosEnviadas[foto.id] ? <Check className="h-3 w-3 mx-auto" /> : foto.ordem}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
