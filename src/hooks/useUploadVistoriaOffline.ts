import { useCallback } from 'react';
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
 * - O preview na UI é montado a partir do blob local até a sincronização
 *   completar — momento em que a foto desaparece da fila e a URL real
 *   (vinda de `vistoria_fotos`) toma o lugar.
 *
 * Esse hook NÃO faz upload direto. Quem decide se está online/offline é o
 * worker global. Isso garante consistência: tudo passa pela mesma fila.
 */
export function useUploadVistoriaOffline(vistoriaId: string | undefined) {
  // Mídias pendentes desta vistoria
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
      // Remove qualquer foto anterior do mesmo slot que ainda esteja na fila
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
      // Substitui qualquer vídeo pendente
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

  // Mapa { tipo -> blobUrl } para fotos pendentes (para preview na UI)
  const previewsFotos: Record<string, string> = {};
  const fotosPendentesTipos: string[] = [];
  pendentes?.forEach((m) => {
    if (m.tipo === 'foto') {
      const tipo = String(m.slot);
      previewsFotos[tipo] = URL.createObjectURL(m.blob);
      fotosPendentesTipos.push(tipo);
    }
  });

  const videoPendente = pendentes?.find((m) => m.tipo === 'video');
  const previewVideo = videoPendente ? URL.createObjectURL(videoPendente.blob) : null;

  return {
    enfileirarFoto,
    enfileirarVideo,
    previewsFotos,
    fotosPendentesTipos,
    previewVideo,
    totalPendentes: pendentes?.length ?? 0,
  };
}
