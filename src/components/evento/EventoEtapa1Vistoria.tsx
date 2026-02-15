import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2, Video, CheckCircle2 } from 'lucide-react';
import { compressImage, createOptimizedPreview, revokePreview } from '@/lib/imageCompressor';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';

const MIN_FOTOS = 5;
const MAX_FOTOS = 15;

interface Props {
  token: string;
  onComplete: () => void;
}

interface FotoItem {
  file: File;
  previewUrl: string;
}

export default function EventoEtapa1Vistoria({ token, onComplete }: Props) {
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const addFoto = useCallback(async (file: File) => {
    if (fotos.length >= MAX_FOTOS) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos`);
      return;
    }
    const compressed = await compressImage(file);
    const previewUrl = createOptimizedPreview(compressed);
    setFotos((prev) => [...prev, { file: compressed, previewUrl }]);
  }, [fotos.length]);

  const removeFoto = useCallback((idx: number) => {
    setFotos((prev) => {
      revokePreview(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await addFoto(file);
    }
    e.target.value = '';
  }, [addFoto]);

  const handleVideoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideo(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  }, [videoPreviewUrl]);

  const removeVideo = useCallback(() => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideo(null);
    setVideoPreviewUrl(null);
  }, [videoPreviewUrl]);

  const handleSubmit = async () => {
    if (fotos.length < MIN_FOTOS || !video) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('etapa', '1');
      formData.append('dados', JSON.stringify({}));
      fotos.forEach((f, i) => formData.append(`arquivo${i}`, f.file));
      formData.append(`arquivo${fotos.length}`, video);

      const { data, error } = await publicSupabase.functions.invoke('salvar-etapa-evento', {
        body: formData,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Fotos e vídeo enviados com sucesso!');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Fotos do Veículo Danificado</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tire fotos claras dos danos no seu veículo. Mínimo de {MIN_FOTOS} fotos, máximo de {MAX_FOTOS}.
          Inclua: visão geral do veículo, close dos danos, placa visível em pelo menos uma foto.
        </p>
      </div>

      <p className="text-sm font-medium">
        {fotos.length} de {MAX_FOTOS} fotos
        {fotos.length < MIN_FOTOS && (
          <span className="text-amber-600 ml-2">(mínimo {MIN_FOTOS})</span>
        )}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {fotos.map((foto, idx) => (
          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
            <img src={foto.previewUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeFoto(idx)}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {fotos.length < MAX_FOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Camera className="h-6 w-6" />
            <span className="text-xs">Adicionar</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Video section */}
      <div className="pt-2 border-t">
        <h2 className="text-lg font-semibold">Vídeo do Veículo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Grave um vídeo curto (até 2 minutos) mostrando os danos no veículo.
        </p>

        {videoPreviewUrl ? (
          <div className="mt-3 space-y-2">
            <div className="relative rounded-lg overflow-hidden border bg-muted">
              <video
                src={videoPreviewUrl}
                controls
                className="w-full max-h-48 object-contain"
              />
              <button
                type="button"
                onClick={removeVideo}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Vídeo adicionado</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="mt-3 w-full py-6 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Video className="h-8 w-8" />
            <span className="text-sm font-medium">Gravar / Selecionar Vídeo</span>
          </button>
        )}

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={handleVideoChange}
          className="hidden"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={fotos.length < MIN_FOTOS || !video || saving}
        className="w-full"
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Enviando fotos e vídeo...
          </>
        ) : (
          'Próxima Etapa'
        )}
      </Button>
    </div>
  );
}
