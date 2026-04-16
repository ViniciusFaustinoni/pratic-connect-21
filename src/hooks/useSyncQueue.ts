import { useEffect, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  offlineDB,
  listarProntasParaEnvio,
  marcarEnviando,
  registrarFalha,
  removerMidia,
  type MidiaPendente,
} from '@/lib/offline/db';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';

async function uploadMidiaServidor(midia: MidiaPendente): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada — reentre para sincronizar');

  if (midia.origem === 'regulador') {
    const fd = new FormData();
    fd.append('acao', 'salvar_midias');
    fd.append('vistoria_id', midia.vistoria_id);
    fd.append('tipo', midia.tipo);
    fd.append('client_id', midia.id);
    if (midia.tipo === 'foto') {
      fd.append('index', String(midia.slot));
    }
    const ext = midia.tipo === 'video' ? 'webm' : 'jpg';
    const filename = midia.tipo === 'video' ? `video.${ext}` : `foto-${midia.slot}.${ext}`;
    fd.append('arquivo', new File([midia.blob], filename, { type: midia.mime }));

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/salvar-vistoria-regulador`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      }
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    return json.url || '';
  }

  // origem === 'instalador' — fluxo via storage direto (mantém compat com hooks existentes)
  const ext = midia.tipo === 'video' ? 'webm' : 'jpg';
  const path = `${midia.vistoria_id}/${midia.tipo}-${midia.slot}-${midia.id}.${ext}`;
  const bucket = midia.tipo === 'video' ? 'vistoria-videos' : 'vistoria-fotos';
  const { error } = await supabase.storage.from(bucket).upload(path, midia.blob, {
    contentType: midia.mime,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export interface SyncQueueState {
  total: number;
  pendentes: number;
  comErro: number;
  sincronizando: boolean;
  ultimaSync: number | null;
  forcarSync: () => Promise<void>;
}

/**
 * Worker global de sincronização. Deve ser instanciado UMA vez no app
 * (ex.: dentro do banner global). Faz upload sequencial das mídias pendentes,
 * com retry/backoff persistido no IndexedDB.
 */
export function useSyncQueue(): SyncQueueState {
  const online = useOnlineStatus();
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<number | null>(null);
  const trabalhando = useRef(false);

  const todas = useLiveQuery(() => offlineDB.midias_pendentes.toArray(), [], []);
  const total = todas?.length ?? 0;
  const pendentes = todas?.filter((m) => m.status !== 'enviada').length ?? 0;
  const comErro = todas?.filter((m) => m.tentativas >= 5).length ?? 0;

  const processar = useCallback(async () => {
    if (trabalhando.current) return;
    if (!navigator.onLine) return;
    trabalhando.current = true;
    setSincronizando(true);
    try {
      let item: MidiaPendente | undefined;
      // eslint-disable-next-line no-cond-assign
      while ((item = (await listarProntasParaEnvio())[0])) {
        await marcarEnviando(item.id);
        try {
          await uploadMidiaServidor(item);
          await removerMidia(item.id);
        } catch (err: any) {
          const msg = err?.message || 'Erro desconhecido';
          await registrarFalha(item.id, msg);
          // Para erros não-recuperáveis (4xx que não 408/429), ainda assim só
          // continuaremos quando a janela de backoff fechar.
          if (/HTTP 4(0[0-9]|1[0-7])/.test(msg)) {
            // sai do loop para permitir intervenção do usuário
            break;
          }
        }
      }
      setUltimaSync(Date.now());
    } finally {
      trabalhando.current = false;
      setSincronizando(false);
    }
  }, []);

  // Roda quando ficar online ou a cada 15s enquanto online
  useEffect(() => {
    if (!online) return;
    processar();
    const i = setInterval(processar, 15_000);
    return () => clearInterval(i);
  }, [online, processar]);

  // Reage quando o usuário volta para a aba
  useEffect(() => {
    const onFocus = () => processar();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [processar]);

  return {
    total,
    pendentes,
    comErro,
    sincronizando,
    ultimaSync,
    forcarSync: processar,
  };
}
