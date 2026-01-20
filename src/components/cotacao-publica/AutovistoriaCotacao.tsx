import { useState, useEffect, useRef } from 'react';
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
  X
} from 'lucide-react';
import { getFotosAutovistoria, type TipoVeiculo, type FotoAutovistoria } from '@/data/autovistoriaConfig';
import { useFotosCotacaoVistoria, useUploadFotoCotacaoVistoria, useFinalizarVistoriaCotacao } from '@/hooks/useCotacaoVistoria';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
  
  const inputRef = useRef<HTMLInputElement>(null);
  const finalizandoRef = useRef(false);
  
  const { data: fotosExistentes, isLoading: carregandoFotos } = useFotosCotacaoVistoria(cotacaoId);
  const uploadMutation = useUploadFotoCotacaoVistoria();
  const finalizarMutation = useFinalizarVistoriaCotacao();
  
  const fotoAtual = fotos[fotoAtualIndex];
  const progresso = (Object.keys(fotosEnviadas).length / totalFotos) * 100;
  const todasEnviadas = Object.keys(fotosEnviadas).length >= totalFotos;
  
  // Reidratar fotos existentes (refresh mantém progresso)
  useEffect(() => {
    if (fotosExistentes && fotosExistentes.length > 0 && !hidratado) {
      const fotosMap: Record<string, string> = {};
      for (const foto of fotosExistentes) {
        if (foto.tipo && foto.arquivo_url) {
          fotosMap[foto.tipo] = foto.arquivo_url;
        }
      }
      
      if (Object.keys(fotosMap).length > 0) {
        setFotosEnviadas(fotosMap);
        toast.success(`${Object.keys(fotosMap).length} foto(s) carregadas de sessão anterior`);
        
        // Ir para próxima foto pendente
        const indexPendente = fotos.findIndex(f => !fotosMap[f.id]);
        if (indexPendente >= 0) {
          setFotoAtualIndex(indexPendente);
        }
      }
      
      setHidratado(true);
    }
  }, [fotosExistentes, fotos, hidratado]);
  
  const handleCapturarFoto = () => {
    inputRef.current?.click();
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Preview local imediato
    const localUrl = URL.createObjectURL(file);
    setPreviewLocal(localUrl);
    
    try {
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
        file,
        latitude,
        longitude,
      });
      
      // Atualizar estado local
      setFotosEnviadas(prev => ({ ...prev, [fotoAtual.id]: result.url }));
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
    } catch (error) {
      console.error('Erro no upload:', error);
      setPreviewLocal(null);
    }
    
    // Limpar input para permitir reenvio
    e.target.value = '';
  };
  
  const handleFinalizar = async () => {
    // Prevenir duplo clique
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
      finalizandoRef.current = false; // Reset apenas em erro para permitir retry
    }
  };
  
  
  const fotoJaEnviada = !!fotosEnviadas[fotoAtual.id];
  const isUploading = uploadMutation.isPending;
  
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
      {/* Header com progresso */}
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Autovistoria</CardTitle>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {Object.keys(fotosEnviadas).length}/{totalFotos} fotos
          </Badge>
        </div>
        <Progress value={progresso} className="h-2" />
      </CardHeader>
      
      <CardContent className="space-y-4">
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
              {/* Preview da foto */}
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
