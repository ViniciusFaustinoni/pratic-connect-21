import { useState, useRef } from 'react';
import { 
  Camera, Check, ArrowLeft, ArrowRight, Loader2, ChevronRight, Gauge, 
  CheckCircle, XCircle, Lightbulb, RotateCcw 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getFotosAutovistoria, TipoVeiculo } from '@/data/autovistoriaConfig';
import { useCriarAutovistoria, useUploadFotoAutovistoria } from '@/hooks/useContratoLink';
import { toast } from 'sonner';

interface AutovistoriaProps {
  contratoId: string;
  associadoId: string;
  veiculoId?: string;
  tipoVeiculo: TipoVeiculo;
  onComplete: (vistoriaId: string) => void;
  onVoltar: () => void;
}

export function Autovistoria({ contratoId, associadoId, veiculoId, tipoVeiculo, onComplete, onVoltar }: AutovistoriaProps) {
  const fotos = getFotosAutovistoria(tipoVeiculo);
  const [fotosEnviadas, setFotosEnviadas] = useState<Record<string, string>>({});
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [vistoriaId, setVistoriaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kmIdentificado, setKmIdentificado] = useState<number | null>(null);
  const [previewsLocais, setPreviewsLocais] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const criarAutovistoria = useCriarAutovistoria();
  const uploadFoto = useUploadFotoAutovistoria();

  const totalFotos = fotos.length;
  const fotosCompletadas = Object.keys(fotosEnviadas).length;
  const progresso = (fotosCompletadas / totalFotos) * 100;
  const todasEnviadas = fotosCompletadas === totalFotos;
  
  const fotoAtual = fotos[indiceAtual];
  const isUltimaFoto = indiceAtual === totalFotos - 1;
  const isPrimeiraFoto = indiceAtual === 0;
  const fotoAtualEnviada = !!fotosEnviadas[fotoAtual.id];

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
    // Criar vistoria se ainda não existir
    if (!vistoriaId) {
      try {
        const result = await criarAutovistoria.mutateAsync({ 
          contratoId, 
          associadoId, 
          veiculoId 
        });
        setVistoriaId(result.id);
      } catch (error) {
        toast.error('Erro ao iniciar autovistoria');
        return;
      }
    }
    
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vistoriaId) return;

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione apenas imagens.');
      return;
    }

    // Criar preview local IMEDIATAMENTE e guardar por fotoId
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewsLocais(prev => ({
        ...prev,
        [fotoAtual.id]: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const result = await uploadFoto.mutateAsync({
        vistoriaId,
        fotoId: fotoAtual.id,
        file,
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
      } else {
        toast.success(`Foto "${fotoAtual.label}" enviada com sucesso!`);
      }
      
      // Avançar automaticamente para a próxima foto após sucesso
      if (!isUltimaFoto) {
        setTimeout(() => {
          avancarFoto();
        }, 500);
      }
    } catch (error) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleContinuar = () => {
    if (vistoriaId) {
      onComplete(vistoriaId);
    }
  };

  // Se todas foram enviadas, mostrar tela de conclusão
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
                Todas as {totalFotos} fotos foram enviadas com sucesso.
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
              Foto {indiceAtual + 1} de {totalFotos}
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
        {/* Ícone ilustrativo */}
        <div className="bg-muted rounded-xl p-8 flex flex-col items-center justify-center min-h-[200px]">
          {(fotoAtualEnviada || previewsLocais[fotoAtual.id]) ? (
            <div className="relative w-full">
              <img 
                src={fotosEnviadas[fotoAtual.id] || previewsLocais[fotoAtual.id] || ''}
                alt={fotoAtual.label}
                className="w-full max-h-48 object-contain rounded-lg"
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
          disabled={uploading}
          variant={fotoAtualEnviada ? "outline" : "default"}
        >
          {uploading ? (
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

        {/* Input Hidden */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

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
            disabled={isUltimaFoto || uploading}
          >
            {fotoAtualEnviada ? 'Próxima' : 'Pular'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

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
