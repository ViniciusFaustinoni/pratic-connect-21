import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FotoCapture } from '@/components/instalador/FotoCapture';
import { VideoCapture } from '@/components/instalador/VideoCapture';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VistoriaEventoMidiasProps {
  vistoriaId: string;
  fotosUrls: string[];
  videoUrl: string | null;
  onFotosChange: (fotos: string[]) => void;
  onVideoChange: (url: string | null) => void;
  onProsseguir: () => void;
}

export function VistoriaEventoMidias({
  vistoriaId,
  fotosUrls,
  videoUrl,
  onFotosChange,
  onVideoChange,
  onProsseguir,
}: VistoriaEventoMidiasProps) {
  const [uploadingFoto, setUploadingFoto] = useState<number | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const fotosPreenchidas = fotosUrls.filter(Boolean).length;
  const todasMidias = fotosPreenchidas >= 10 && !!videoUrl;

  const uploadMidia = useCallback(async (file: File, tipo: 'foto' | 'video', index?: number) => {
    const maxRetries = 3;
    for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sessão expirada');

        const formData = new FormData();
        formData.append('acao', 'salvar_midias');
        formData.append('vistoria_id', vistoriaId);
        formData.append('tipo', tipo);
        formData.append('arquivo', file);
        if (index !== undefined) {
          formData.append('index', String(index + 1));
        }

        const res = await fetch(
          `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/salvar-vistoria-regulador`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erro ${res.status}`);
        }

        const result = await res.json();
        return result.url;
      } catch (err: any) {
        console.error(`[Upload] Tentativa ${tentativa}/${maxRetries}:`, err);
        if (tentativa === maxRetries) {
          toast.error(`Falha no upload após ${maxRetries} tentativas`);
          throw err;
        }
        await new Promise((r) => setTimeout(r, 1000 * tentativa));
      }
    }
  }, [vistoriaId]);

  const handleFotoCapture = useCallback(async (index: number, file: File) => {
    setUploadingFoto(index);
    try {
      const url = await uploadMidia(file, 'foto', index);
      const novasFotos = [...fotosUrls];
      novasFotos[index] = url;
      onFotosChange(novasFotos);
    } catch {
      // toast already shown in uploadMidia
    } finally {
      setUploadingFoto(null);
    }
  }, [fotosUrls, onFotosChange, uploadMidia]);

  const handleVideoCapture = useCallback(async (file: File) => {
    setUploadingVideo(true);
    try {
      const url = await uploadMidia(file, 'video');
      onVideoChange(url);
    } catch {
      // toast already shown
    } finally {
      setUploadingVideo(false);
    }
  }, [onVideoChange, uploadMidia]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Captura de Evidências</CardTitle>
        <p className="text-xs text-muted-foreground">
          {fotosPreenchidas}/10 fotos • {videoUrl ? '1' : '0'}/1 vídeo
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grade de 10 fotos */}
        <div>
          <p className="text-sm font-medium mb-2">Fotos (10 obrigatórias)</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <FotoCapture
                key={i}
                tipo={`foto-${i + 1}`}
                label={`Foto ${i + 1}`}
                obrigatoria
                fotoUrl={fotosUrls[i] || undefined}
                uploading={uploadingFoto === i}
                onCapture={(file) => handleFotoCapture(i, file)}
              />
            ))}
          </div>
        </div>

        {/* Vídeo */}
        <div>
          <p className="text-sm font-medium mb-2">Vídeo (1 obrigatório)</p>
          <VideoCapture
            onCapture={handleVideoCapture}
            onReset={() => onVideoChange(null)}
            videoUrl={videoUrl || undefined}
            uploading={uploadingVideo}
            maxDuration={120}
            label="Vídeo do veículo (máx. 2 min)"
          />
        </div>

        {/* Botão Prosseguir */}
        <Button
          className="w-full"
          size="lg"
          disabled={!todasMidias}
          onClick={onProsseguir}
        >
          Prosseguir para Orçamento
        </Button>
        {!todasMidias && (
          <p className="text-xs text-center text-muted-foreground">
            Preencha todas as 10 fotos e o vídeo para continuar
          </p>
        )}
      </CardContent>
    </Card>
  );
}
