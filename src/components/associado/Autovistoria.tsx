import { useState, useRef } from 'react';
import { Camera, Check, ArrowLeft, Loader2, Upload, X, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getFotosAutovistoria, TipoVeiculo, FotoAutovistoria } from '@/data/autovistoriaConfig';
import { useCriarAutovistoria, useUploadFotoAutovistoria } from '@/hooks/useContratoLink';
import { toast } from 'sonner';

interface AutovistoriaProps {
  contratoId: string;
  tipoVeiculo: TipoVeiculo;
  onComplete: (vistoriaId: string) => void;
  onVoltar: () => void;
}

export function Autovistoria({ contratoId, tipoVeiculo, onComplete, onVoltar }: AutovistoriaProps) {
  const fotos = getFotosAutovistoria(tipoVeiculo);
  const [fotosEnviadas, setFotosEnviadas] = useState<Record<string, string>>({});
  const [fotoAtual, setFotoAtual] = useState<FotoAutovistoria | null>(null);
  const [vistoriaId, setVistoriaId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const criarAutovistoria = useCriarAutovistoria();
  const uploadFoto = useUploadFotoAutovistoria();

  const totalFotos = fotos.length;
  const fotosCompletadas = Object.keys(fotosEnviadas).length;
  const progresso = (fotosCompletadas / totalFotos) * 100;
  const todasEnviadas = fotosCompletadas === totalFotos;

  const handleSelecionarFoto = async (foto: FotoAutovistoria) => {
    // Criar vistoria se ainda não existir
    if (!vistoriaId) {
      try {
        const result = await criarAutovistoria.mutateAsync({ contratoId });
        setVistoriaId(result.id);
      } catch (error) {
        toast.error('Erro ao iniciar autovistoria');
        return;
      }
    }
    
    setFotoAtual(foto);
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fotoAtual || !vistoriaId) return;

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

      toast.success(`Foto "${fotoAtual.label}" enviada!`);
    } catch (error) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
      setFotoAtual(null);
      // Reset input
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleContinuar = () => {
    if (vistoriaId) {
      onComplete(vistoriaId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Autovistoria
            </CardTitle>
            <CardDescription>
              Envie as fotos do seu veículo ({tipoVeiculo === 'moto' ? '10 fotos' : '15 fotos'})
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{fotosCompletadas}/{totalFotos} fotos</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>

        {/* Lista de Fotos */}
        <div className="space-y-2">
          {fotos.map((foto) => {
            const enviada = !!fotosEnviadas[foto.id];
            const isUploading = uploading && fotoAtual?.id === foto.id;

            return (
              <button
                key={foto.id}
                onClick={() => handleSelecionarFoto(foto)}
                disabled={uploading}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  enviada 
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' 
                    : 'hover:bg-muted/50 border-muted'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  enviada 
                    ? 'bg-green-500 text-white' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : enviada ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-medium">{foto.ordem}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium text-sm ${enviada ? 'text-green-700 dark:text-green-400' : ''}`}>
                    {foto.label}
                  </p>
                  {foto.descricao && (
                    <p className="text-xs text-muted-foreground">{foto.descricao}</p>
                  )}
                </div>
                {!enviada && (
                  <Camera className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>

        {/* Input Hidden */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Botão Continuar */}
        {todasEnviadas && (
          <div className="space-y-4 pt-4 border-t">
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg text-center">
              <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-green-700 dark:text-green-400">
                Todas as fotos foram enviadas!
              </p>
              <p className="text-sm text-muted-foreground">
                Agora você pode prosseguir para o pagamento da adesão.
              </p>
            </div>
            
            <Button onClick={handleContinuar} className="w-full" size="lg">
              Continuar para Pagamento
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
