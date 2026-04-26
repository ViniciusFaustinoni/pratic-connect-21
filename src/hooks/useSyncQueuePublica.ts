import { useEffect, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  offlineDB,
  marcarEnviando,
  registrarFalha,
  removerMidia,
  type MidiaPendente,
} from '@/lib/offline/db';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Worker de sincronização da fila offline para a rota pública de vistoria.
 *
 * Diferenças vs `useSyncQueue`:
 * - Não usa `supabase.auth.getSession()` (rota pública).
 * - Usa `publicSupabase` (cliente com chave anônima).
 * - O caminho do storage é `${token}/fotos/${slot}.jpg` ou
 *   `${token}/video/video_360.${ext}` — bucket `vistoria-prestador-fotos`.
 *
 * Importante: este hook deve receber o token do link como parâmetro e
 * processa apenas mídias pendentes desse token.
 */

async function uploadMidiaPublica(midia: MidiaPendente): Promise<string> {
  if (!midia.blob || midia.blob.size === 0) {
    throw new Error('HTTP 422: blob vazio (descartado para evitar arquivo corrompido)');
  }
  const token = midia.token || midia.vistoria_id;

  if (midia.tipo === 'foto') {
    const slot = String(midia.slot);
    const fileName = `${token}/fotos/${slot}.jpg`;

    const { error: upErr } = await publicSupabase.storage
      .from('vistoria-prestador-fotos')
      .upload(fileName, midia.blob, {
        contentType: midia.mime || 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = publicSupabase.storage
      .from('vistoria-prestador-fotos')
      .getPublicUrl(fileName);
    return `${pub.publicUrl}?v=${Date.now()}`;
  }

  // Vídeo
  const ext = (midia.mime || '').includes('mp4') ? 'mp4' : 'webm';
  const fileName = `${token}/video/video_360.${ext}`;

  const { error: upErr } = await publicSupabase.storage
    .from('vistoria-prestador-fotos')
    .upload(fileName, midia.blob, {
      contentType: midia.mime || `video/${ext}`,
      upsert: true,
      cacheControl: '3600',
    });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = publicSupabase.storage
    .from('vistoria-prestador-fotos')
    .getPublicUrl(fileName);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

export interface SyncQueuePublicaState {
  total: number;
  pendentes: number;
  comErro: number;
  sincronizando: boolean;
  ultimaSync: number | null;
  /** URLs públicas finais por slot, após upload concluído (para o componente coletar) */
  uploadsConcluidos: Record<string, string>;
  forcarSync: () => Promise<void>;
}

export function useSyncQueuePublica(token: string | undefined): SyncQueuePublicaState {
  const online = useOnlineStatus();
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<number | null>(null);
  const [uploadsConcluidos, setUploadsConcluidos] = useState<Record<string, string>>({});
  const trabalhando = useRef(false);

  // Filtra para o token deste link
  const todas = useLiveQuery(
    () => {
      if (!token) return Promise.resolve([] as MidiaPendente[]);
      return offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(token)
        .toArray();
    },
    [token],
    [] as MidiaPendente[]
  );

  const total = todas?.length ?? 0;
  const pendentes = todas?.filter((m) => m.status !== 'enviada').length ?? 0;
  const comErro = todas?.filter((m) => m.tentativas >= 5).length ?? 0;

  const processar = useCallback(async () => {
    if (!token) return;
    if (trabalhando.current) return;
    if (!navigator.onLine) return;
    trabalhando.current = true;
    setSincronizando(true);
    try {
      const agora = Date.now();
      const lista = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(token)
        .and((m) => m.status === 'pendente' && m.proximo_retry_em <= agora && m.origem === 'publico')
        .sortBy('criado_em');

      for (const item of lista) {
        await marcarEnviando(item.id);
        try {
          const url = await uploadMidiaPublica(item);
          await removerMidia(item.id);
          // Reporta a URL para o componente consumidor consolidar com o estado
          setUploadsConcluidos((prev) => ({
            ...prev,
            [item.tipo === 'video' ? 'video_360' : String(item.slot)]: url,
          }));
        } catch (err: any) {
          const msg = err?.message || 'Erro desconhecido';
          await registrarFalha(item.id, msg);
          // 4xx não-recuperável: sai do loop para intervenção do usuário
          if (/HTTP 4(0[0-9]|1[0-7])/.test(msg)) break;
        }
      }
      setUltimaSync(Date.now());
    } finally {
      trabalhando.current = false;
      setSincronizando(false);
    }
  }, [token]);

  // Roda quando ficar online ou a cada 15s enquanto online
  useEffect(() => {
    if (!online || !token) return;
    processar();
    const i = setInterval(processar, 15_000);
    return () => clearInterval(i);
  }, [online, processar, token]);

  // Reage quando o usuário volta para a aba
  useEffect(() => {
    if (!token) return;
    const onFocus = () => processar();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [processar, token]);

  return {
    total,
    pendentes,
    comErro,
    sincronizando,
    ultimaSync,
    uploadsConcluidos,
    forcarSync: processar,
  };
}
