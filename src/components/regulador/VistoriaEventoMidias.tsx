import { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FotoCapture } from '@/components/instalador/FotoCapture';
import { VideoCapture } from '@/components/instalador/VideoCapture';
import { CloudOff } from 'lucide-react';
import { offlineDB, enfileirarMidia } from '@/lib/offline/db';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncQueue } from '@/hooks/useSyncQueue';
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
  const online = useOnlineStatus();
  const { forcarSync } = useSyncQueue();

  // Mídias pendentes desta vistoria (live)
  const pendentes = useLiveQuery(
    () =>
      offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(vistoriaId)
        .toArray(),
    [vistoriaId],
    []
  );

  // Previews offline a partir dos blobs locais
  const [previewsLocais, setPreviewsLocais] = useState<Record<string, string>>({});
  useEffect(() => {
    const novos: Record<string, string> = {};
    pendentes?.forEach((m) => {
      novos[`${m.tipo}-${m.slot}`] = URL.createObjectURL(m.blob);
    });
    setPreviewsLocais(novos);
    return () => {
      Object.values(novos).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [pendentes]);

  // Helpers para juntar URLs do servidor + previews locais
  const fotoUrl = (i: number): string | undefined => {
    if (fotosUrls[i]) return fotosUrls[i];
    return previewsLocais[`foto-${i + 1}`];
  };
  const videoDisplay = videoUrl || previewsLocais['video-360'] || undefined;

  const fotoEnfileiradaSemUrl = (i: number) =>
    !fotosUrls[i] && !!previewsLocais[`foto-${i + 1}`];
  const videoEnfileiradoSemUrl = !videoUrl && !!previewsLocais['video-360'];

  const fotosPreenchidas =
    fotosUrls.filter(Boolean).length +
    Array.from({ length: 10 }).filter((_, i) => fotoEnfileiradaSemUrl(i)).length;
  const temVideo = !!videoUrl || videoEnfileiradoSemUrl;
  const todasMidias = fotosPreenchidas >= 10 && temVideo;

  const handleFotoCapture = useCallback(async (index: number, file: File) => {
    try {
      await enfileirarMidia({
        vistoria_id: vistoriaId,
        origem: 'regulador',
        tipo: 'foto',
        slot: index + 1,
        blob: file,
        mime: file.type,
      });
      if (online) forcarSync();
      else toast.info('Sem internet — foto salva no celular, será enviada depois.');
    } catch (err: any) {
      toast.error(`Falha ao salvar foto: ${err.message}`);
    }
  }, [vistoriaId, online, forcarSync]);

  const handleVideoCapture = useCallback(async (file: File) => {
    try {
      await enfileirarMidia({
        vistoria_id: vistoriaId,
        origem: 'regulador',
        tipo: 'video',
        slot: '360',
        blob: file,
        mime: file.type,
      });
      if (online) forcarSync();
      else toast.info('Sem internet — vídeo salvo no celular, será enviado depois.');
    } catch (err: any) {
      toast.error(`Falha ao salvar vídeo: ${err.message}`);
    }
  }, [vistoriaId, online, forcarSync]);

  // Conta uploads em fila desta vistoria
  const filaPendente = pendentes?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Captura de Evidências</CardTitle>
        <p className="text-xs text-muted-foreground">
          {fotosPreenchidas}/10 fotos • {temVideo ? '1' : '0'}/1 vídeo
          {filaPendente > 0 && ` • ${filaPendente} aguardando envio`}
        </p>
        {!online && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <CloudOff className="h-4 w-4" />
            Modo offline — fotos e vídeos serão enviados quando a internet voltar.
          </div>
        )}
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
                fotoUrl={fotoUrl(i)}
                uploading={false}
                hasError={false}
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
            videoUrl={videoDisplay}
            uploading={false}
            confirmed={!!videoUrl}
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
        {todasMidias && filaPendente > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            ⚠️ Você pode prosseguir, mas {filaPendente} {filaPendente === 1 ? 'mídia ainda está' : 'mídias ainda estão'} sendo enviada{filaPendente === 1 ? '' : 's'} ao servidor.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
