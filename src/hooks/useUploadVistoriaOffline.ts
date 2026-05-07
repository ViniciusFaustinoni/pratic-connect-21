import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { offlineDB, enfileirarMidia, removerMidia, type MidiaPendente } from '@/lib/offline/db';

/**
 * Camada offline-first para o vistoriador comum (instalador).
 *
 * Estratégia:
 * - Sempre que o usuário tira uma foto / grava um vídeo, gravamos o blob no
 *   IndexedDB (Dexie) e o `useSyncQueue` cuida de subir pro Storage assim
 *   que houver internet.
 * - Os Object URLs são gerenciados em ref/efeito e revogados quando o blob
 *   correspondente sai da fila ou no unmount. Sem isso celulares antigos
 *   vazam memória rápido em vistorias com muitas fotos.
 */
export function useUploadVistoriaOffline(vistoriaId: string | undefined) {
  const pendentes = useLiveQuery(
    () => {
      if (!vistoriaId) return Promise.resolve([] as MidiaPendente[]);
      return offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(vistoriaId)
        .toArray();
    },
    [vistoriaId]
  ) as MidiaPendente[] | undefined;

  const enfileirarFoto = useCallback(
    async (tipo: string, file: File | Blob) => {
      if (!vistoriaId) return;
      const anteriores = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(vistoriaId)
        .and((m) => m.tipo === 'foto' && String(m.slot) === tipo)
        .toArray();
      for (const a of anteriores) await removerMidia(a.id);

      await enfileirarMidia({
        vistoria_id: vistoriaId,
        origem: 'instalador',
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
    [vistoriaId]
  );

  const enfileirarVideo = useCallback(
    async (file: File | Blob) => {
      if (!vistoriaId) return;
      const anteriores = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(vistoriaId)
        .and((m) => m.tipo === 'video')
        .toArray();
      for (const a of anteriores) await removerMidia(a.id);

      await enfileirarMidia({
        vistoria_id: vistoriaId,
        origem: 'instalador',
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
    [vistoriaId]
  );

  // ---- Gestão de Object URLs com revogação automática ----
  // Mantemos um cache por id da mídia. Quando a mídia some da fila (upload
  // concluído ou remoção), revogamos a URL correspondente.
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [previewsFotos, setPreviewsFotos] = useState<Record<string, string>>({});
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [fotosPendentesTipos, setFotosPendentesTipos] = useState<string[]>([]);

  useEffect(() => {
    const cache = urlCacheRef.current;
    const idsAtuais = new Set<string>();
    const fotos: Record<string, string> = {};
    const tipos: string[] = [];
    let video: string | null = null;

    pendentes?.forEach((m) => {
      const key = String(m.id);
      idsAtuais.add(key);
      let url = cache.get(key);
      if (!url) {
        url = URL.createObjectURL(m.blob);
        cache.set(key, url);
      }
      if (m.tipo === 'foto') {
        const tipo = String(m.slot);
        fotos[tipo] = url;
        tipos.push(tipo);
      } else if (m.tipo === 'video') {
        video = url;
      }
    });

    // Revoga URLs de mídias que saíram da fila
    for (const [key, url] of cache.entries()) {
      if (!idsAtuais.has(key)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        cache.delete(key);
      }
    }

    setPreviewsFotos(fotos);
    setFotosPendentesTipos(tipos);
    setPreviewVideo(video);
  }, [pendentes]);

  // Cleanup total no unmount
  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => {
      for (const url of cache.values()) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
      cache.clear();
    };
  }, []);

  return {
    enfileirarFoto,
    enfileirarVideo,
    previewsFotos,
    fotosPendentesTipos,
    previewVideo,
    totalPendentes: pendentes?.length ?? 0,
  };
}
