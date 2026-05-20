import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import {
  offlineDB,
  enfileirarMidia,
  marcarEnviando,
  registrarFalha,
  removerMidia,
  type MidiaPendente,
} from '@/lib/offline/db';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Camada offline-first para o link público do prestador.
 *
 * Estratégia (paridade com a vistoria pública do cliente):
 *  - Toda foto capturada é gravada localmente no IndexedDB (Dexie)
 *    ANTES de ir pro Storage. Isso garante que, se o Chrome descartar
 *    a aba por falta de memória (Moto G / Android low-end), a foto não
 *    se perde — basta reabrir o link.
 *  - Um worker em background consome a fila, faz upload pro bucket
 *    `prestador-fotos` e, em sucesso, remove a entrada do Dexie e
 *    devolve a URL pública via callback `onUploaded`.
 *
 * Namespacing: usamos `vistoria_id = "prestador:" + token` para não
 * colidir com a fila da rota pública do associado.
 */

const ns = (token: string) => `prestador:${token}`;

interface UseUploadPrestadorOfflineOptions {
  token: string | undefined;
  linkId: string | undefined;
  /** Callback chamado quando uma foto termina de subir pro Storage. */
  onFotoUploaded?: (slot: string, url: string) => void;
}

export function useUploadPrestadorOffline({
  token,
  linkId,
  onFotoUploaded,
}: UseUploadPrestadorOfflineOptions) {
  const online = useOnlineStatus();
  const trabalhando = useRef(false);
  const [sincronizando, setSincronizando] = useState(false);

  const pendentes = useLiveQuery(
    () => {
      if (!token) return Promise.resolve([] as MidiaPendente[]);
      return offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(ns(token))
        .toArray();
    },
    [token]
  ) as MidiaPendente[] | undefined;

  // ---- Object URLs gerenciados para previews locais (sem vazamento) ----
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [previewsFotos, setPreviewsFotos] = useState<Record<string, string>>({});

  useEffect(() => {
    const cache = urlCacheRef.current;
    const idsAtuais = new Set<string>();
    const fotos: Record<string, string> = {};

    pendentes?.forEach((m) => {
      const key = String(m.id);
      idsAtuais.add(key);
      let url = cache.get(key);
      if (!url) {
        url = URL.createObjectURL(m.blob);
        cache.set(key, url);
      }
      if (m.tipo === 'foto') fotos[String(m.slot)] = url;
    });

    for (const [key, url] of cache.entries()) {
      if (!idsAtuais.has(key)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        cache.delete(key);
      }
    }
    setPreviewsFotos(fotos);
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

  // ---- Enqueue ----
  const enfileirarFoto = useCallback(
    async (slot: string, file: File | Blob) => {
      if (!token) return;
      // Drop entradas anteriores do mesmo slot (refazer foto)
      const anteriores = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(ns(token))
        .and((m) => m.tipo === 'foto' && String(m.slot) === slot)
        .toArray();
      for (const a of anteriores) await removerMidia(a.id);

      await enfileirarMidia({
        vistoria_id: ns(token),
        origem: 'publico',
        token,
        tipo: 'foto',
        slot,
        blob: file,
        mime: (file as File).type || 'image/jpeg',
      });

      if (!navigator.onLine) {
        toast.success('Foto salva no celular', {
          description: 'Será enviada automaticamente quando a internet voltar.',
        });
      }
    },
    [token]
  );

  // ---- Worker de upload ----
  const callbackRef = useRef(onFotoUploaded);
  useEffect(() => { callbackRef.current = onFotoUploaded; }, [onFotoUploaded]);

  const processar = useCallback(async () => {
    if (!token || !linkId) return;
    if (trabalhando.current) return;
    if (!navigator.onLine) return;
    trabalhando.current = true;
    setSincronizando(true);
    try {
      const agora = Date.now();
      const lista = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(ns(token))
        .and((m) => m.status === 'pendente' && m.proximo_retry_em <= agora)
        .sortBy('criado_em');

      for (const item of lista) {
        await marcarEnviando(item.id);
        try {
          if (!item.blob || item.blob.size === 0) {
            throw new Error('HTTP 422: blob vazio');
          }
          const slot = String(item.slot);
          const path = `${linkId}/${slot}_${item.id}.jpg`;
          const { error: upErr } = await publicSupabase.storage
            .from('prestador-fotos')
            .upload(path, item.blob, {
              contentType: item.mime || 'image/jpeg',
              upsert: true,
              cacheControl: '3600',
            });
          if (upErr) throw new Error(upErr.message);

          const { data: pub } = publicSupabase.storage
            .from('prestador-fotos')
            .getPublicUrl(path);
          const finalUrl = pub.publicUrl;
          await removerMidia(item.id);
          callbackRef.current?.(slot, finalUrl);
        } catch (err: any) {
          const msg = err?.message || 'Erro desconhecido';
          console.warn('[useUploadPrestadorOffline] falha upload:', msg);
          await registrarFalha(item.id, msg);
          if (/HTTP 4(0[0-9]|1[0-7])/.test(msg)) break;
        }
      }
    } finally {
      trabalhando.current = false;
      setSincronizando(false);
    }
  }, [token, linkId]);

  useEffect(() => {
    if (!online || !token || !linkId) return;
    processar();
    const i = setInterval(processar, 12_000);
    return () => clearInterval(i);
  }, [online, processar, token, linkId]);

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

  /** Libera Object URLs locais para aliviar pressão de memória. */
  const liberarPreviews = useCallback(() => {
    const cache = urlCacheRef.current;
    for (const url of cache.values()) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
    cache.clear();
    setPreviewsFotos({});
  }, []);

  return {
    pendentes: pendentes ?? [],
    previewsFotos,
    totalPendentes: pendentes?.length ?? 0,
    sincronizando,
    enfileirarFoto,
    forcarSync: processar,
    liberarPreviews,
  };
}
