import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { offlineDB, enfileirarMidia, removerMidia, type MidiaPendente } from '@/lib/offline/db';

/**
 * Camada offline-first para a rota pública de vistoria (link público).
 * Ver useUploadVistoriaOffline para detalhes do gerenciamento de URLs.
 */
export function useUploadVistoriaPublicaOffline(token: string | undefined) {
  const pendentes = useLiveQuery(
    () => {
      if (!token) return Promise.resolve([] as MidiaPendente[]);
      return offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(token)
        .toArray();
    },
    [token]
  ) as MidiaPendente[] | undefined;

  const enfileirarFoto = useCallback(
    async (tipo: string, file: File | Blob) => {
      if (!token) return;
      const anteriores = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(token)
        .and((m) => m.tipo === 'foto' && String(m.slot) === tipo)
        .toArray();
      for (const a of anteriores) await removerMidia(a.id);

      await enfileirarMidia({
        vistoria_id: token,
        origem: 'publico',
        token,
        tipo: 'foto',
        slot: tipo,
        blob: file,
        mime: (file as File).type || 'image/jpeg',
      });

      if (!navigator.onLine) {
        toast.success('Foto salva offline', {
          description: 'Será enviada automaticamente quando a internet voltar.',
        });
      }
    },
    [token]
  );

  const enfileirarVideo = useCallback(
    async (file: File | Blob) => {
      if (!token) return;
      const anteriores = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(token)
        .and((m) => m.tipo === 'video')
        .toArray();
      for (const a of anteriores) await removerMidia(a.id);

      await enfileirarMidia({
        vistoria_id: token,
        origem: 'publico',
        token,
        tipo: 'video',
        slot: '360',
        blob: file,
        mime: (file as File).type || 'video/webm',
      });

      if (!navigator.onLine) {
        toast.success('Vídeo salvo offline', {
          description: 'Será enviado automaticamente quando a internet voltar.',
        });
      }
    },
    [token]
  );

  // ---- Object URLs gerenciados (sem vazamento) ----
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [previewsFotos, setPreviewsFotos] = useState<Record<string, string>>({});
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  useEffect(() => {
    const cache = urlCacheRef.current;
    const idsAtuais = new Set<string>();
    const fotos: Record<string, string> = {};
    let video: string | null = null;

    pendentes?.forEach((m) => {
      const key = String(m.id);
      idsAtuais.add(key);
      let url = cache.get(key);
      if (!url) {
        url = URL.createObjectURL(m.blob);
        cache.set(key, url);
      }
      if (m.tipo === 'foto') fotos[String(m.slot)] = url;
      else if (m.tipo === 'video') video = url;
    });

    for (const [key, url] of cache.entries()) {
      if (!idsAtuais.has(key)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        cache.delete(key);
      }
    }

    setPreviewsFotos(fotos);
    setPreviewVideo(video);
  }, [pendentes]);

  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => {
      for (const url of cache.values()) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
      cache.clear();
    };
  }, []);

  const totalPendentes = pendentes?.length ?? 0;

  return {
    pendentes: pendentes ?? [],
    previewsFotos,
    previewVideo,
    totalPendentes,
    enfileirarFoto,
    enfileirarVideo,
  };
}
