import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { offlineDB, enfileirarMidia, removerMidia, type MidiaPendente } from '@/lib/offline/db';

/**
 * Camada offline-first para a rota pública de vistoria (link público).
 *
 * Diferente do app do instalador, aqui a "chave" da fila é o TOKEN do link
 * — não há sessão autenticada para usar. O `useSyncQueuePublica` cuida do
 * upload via cliente público + bucket do storage com policy de upload aberto
 * para o caminho `${token}/...`.
 *
 * Mantém a mesma semântica do hook autenticado: enfileira blob, exibe
 * preview local até o upload completar, dedupe por slot.
 */
export function useUploadVistoriaPublicaOffline(token: string | undefined) {
  // Mídias pendentes desta vistoria pública (chave = token)
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
      // Remove qualquer foto anterior do mesmo slot que ainda esteja na fila
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

  // Previews locais (URL.createObjectURL) — mostrados na UI até o upload completar
  const previewsFotos: Record<string, string> = {};
  let previewVideo: string | null = null;

  pendentes?.forEach((m) => {
    if (m.tipo === 'foto') {
      previewsFotos[String(m.slot)] = URL.createObjectURL(m.blob);
    } else if (m.tipo === 'video') {
      previewVideo = URL.createObjectURL(m.blob);
    }
  });

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
