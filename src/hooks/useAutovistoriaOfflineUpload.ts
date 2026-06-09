import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQueryClient } from '@tanstack/react-query';
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
import { supabase } from '@/integrations/supabase/client';
import { uploadVideoWithRetry, VideoUploadError } from '@/lib/videoUpload';
import { isFotoComValidacaoPlaca } from '@/data/autovistoriaConfig';
import { isPlacaPlaceholder } from '@/lib/placa-utils';
import { useOnlineStatus } from './useOnlineStatus';
import type { PlacaOcrResultado } from './useCotacaoVistoria';

/**
 * Camada offline-first para a autovistoria do link público de cotação.
 *
 * Estratégia (idêntica ao link do prestador `useUploadVistoriaPublicaOffline` +
 * `useSyncQueuePublica`, mas direcionada ao bucket `cotacoes-vistoria` e à
 * tabela `cotacoes_vistoria_fotos`):
 *
 * 1. Capturar foto/vídeo → grava blob em IndexedDB (Dexie) com
 *    `origem='cotacao_publica'` e `vistoria_id=cotacaoId`.
 * 2. UI avança imediatamente (preview vem do blob local).
 * 3. Worker em background faz upload para Supabase Storage + upsert em
 *    `cotacoes_vistoria_fotos` (mesmo schema do hook legado, para não quebrar
 *    `useFotosCotacaoVistoria`, `finalizar-autovistoria-cotacao` e os gates
 *    `checarCompletudeAutovistoriaSubFipe`).
 * 4. OCR (placa + odômetro) roda PÓS-upload, em background. Falha de OCR
 *    NUNCA descarta o blob nem reverte o estado.
 * 5. Mídia sai da fila local apenas quando o upsert no DB volta sem erro.
 *
 * Por que substituir `useUploadFotoCotacaoVistoria`: o hook legado faz
 * upload direto inline. Se a conexão cair ou o Chrome mobile descartar a
 * aba no meio do upload, o blob some — o cliente percebe "voltou pro
 * início". Com a fila, o blob sobrevive a refresh, queda de aba e OOM
 * (vide memória `prestador-link-memoria-e-layout`).
 */

const BUCKET = 'cotacoes-vistoria';
const VIDEO_SLOT = 'video_360';

export interface AutovistoriaOcrResult {
  kmExtraido?: number;
  ocrFalhou?: boolean;
  placaOcr?: PlacaOcrResultado;
}

export interface UseAutovistoriaOfflineUploadResult {
  /** Pendentes na fila local (não enviadas ao servidor ainda). */
  pendentes: number;
  /** Itens em backoff prolongado (>= 5 tentativas). */
  comErro: number;
  /** Worker está processando agora. */
  sincronizando: boolean;
  /** Online? (apenas observabilidade — worker já reage internamente.) */
  online: boolean;
  /** map slot → object URL local (preview do blob no Dexie). */
  urlsLocais: Record<string, string>;
  /**
   * map slot → progresso 0–100 (apenas vídeo, durante upload). Foto não
   * expõe progresso parcial — é binário.
   */
  progressoUpload: Record<string, number>;
  /**
   * map slot → resultado de OCR pós-upload (placa/odômetro). Atualizado
   * quando worker termina o OCR daquele slot.
   */
  ocrPorSlot: Record<string, AutovistoriaOcrResult>;
  /** Enfileira foto. UI deve avançar imediatamente após esta chamada. */
  enfileirarFoto: (slot: string, file: File | Blob) => Promise<void>;
  /** Enfileira vídeo 360°. UI deve avançar imediatamente após esta chamada. */
  enfileirarVideo: (file: File | Blob) => Promise<void>;
  /** Força tentativa imediata de drenar a fila (botão "Tentar enviar agora"). */
  forcarSync: () => Promise<void>;
}

function logAuditoriaFire(
  cotacaoId: string,
  acao: 'criar' | 'editar',
  prefixo: string,
  payload: Record<string, unknown>,
): void {
  try {
    const descricao = `${prefixo} cotacao=${cotacaoId} ${Object.entries(payload)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' ')}`.slice(0, 800);
    void publicSupabase.from('logs_auditoria').insert({
      acao,
      entidade: 'cotacoes_vistoria_fotos',
      entidade_id: cotacaoId,
      descricao,
    } as any);
  } catch {
    // nunca quebrar fluxo por falha em log
  }
}

export function useAutovistoriaOfflineUpload(
  cotacaoId: string | undefined,
): UseAutovistoriaOfflineUploadResult {
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const [sincronizando, setSincronizando] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState<Record<string, number>>({});
  const [ocrPorSlot, setOcrPorSlot] = useState<Record<string, AutovistoriaOcrResult>>({});
  const trabalhando = useRef(false);


  // Lista reativa de mídias pendentes para esta cotação.
  const pendentesList = useLiveQuery(
    () => {
      if (!cotacaoId) return Promise.resolve([] as MidiaPendente[]);
      return offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(cotacaoId)
        .toArray();
    },
    [cotacaoId],
    [] as MidiaPendente[],
  );

  const pendentes = pendentesList?.length ?? 0;
  const comErro = pendentesList?.filter((m) => m.tentativas >= 5).length ?? 0;

  // ---- Object URLs locais gerenciados (sem vazamento) ----
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [urlsLocais, setUrlsLocais] = useState<Record<string, string>>({});

  useEffect(() => {
    const cache = urlCacheRef.current;
    const idsAtuais = new Set<string>();
    const urls: Record<string, string> = {};

    pendentesList?.forEach((m) => {
      const cacheKey = m.id;
      idsAtuais.add(cacheKey);
      let url = cache.get(cacheKey);
      if (!url) {
        try {
          url = URL.createObjectURL(m.blob);
          cache.set(cacheKey, url);
        } catch {
          return;
        }
      }
      const slotKey = m.tipo === 'video' ? VIDEO_SLOT : String(m.slot);
      urls[slotKey] = url;
    });

    for (const [key, url] of cache.entries()) {
      if (!idsAtuais.has(key)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        cache.delete(key);
      }
    }

    setUrlsLocais(urls);
  }, [pendentesList]);

  useEffect(() => {
    const cache = urlCacheRef.current;
    return () => {
      for (const url of cache.values()) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
      cache.clear();
    };
  }, []);

  // ---- Enfileiramento ----
  const enfileirarFoto = useCallback(
    async (slot: string, file: File | Blob) => {
      if (!cotacaoId) return;
      // Remove qualquer pendência anterior para esse slot — sempre a mais recente vence.
      const anteriores = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(cotacaoId)
        .and((m) => m.tipo === 'foto' && String(m.slot) === slot)
        .toArray();
      for (const a of anteriores) await removerMidia(a.id);

      await enfileirarMidia({
        vistoria_id: cotacaoId,
        origem: 'cotacao_publica',
        tipo: 'foto',
        slot,
        blob: file,
        mime: (file as File).type || 'image/jpeg',
      });

      if (!navigator.onLine) {
        toast.success('Foto salva no aparelho', {
          description: 'Será enviada automaticamente quando a internet voltar.',
        });
      }
    },
    [cotacaoId],
  );

  const enfileirarVideo = useCallback(
    async (file: File | Blob) => {
      if (!cotacaoId) return;
      const anteriores = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(cotacaoId)
        .and((m) => m.tipo === 'video')
        .toArray();
      for (const a of anteriores) await removerMidia(a.id);

      await enfileirarMidia({
        vistoria_id: cotacaoId,
        origem: 'cotacao_publica',
        tipo: 'video',
        slot: VIDEO_SLOT,
        blob: file,
        mime: (file as File).type || 'video/webm',
      });

      if (!navigator.onLine) {
        toast.success('Vídeo salvo no aparelho', {
          description: 'Será enviado automaticamente quando a internet voltar.',
        });
      }
    },
    [cotacaoId],
  );

  // ---- OCR pós-upload (não-bloqueante; nunca descarta o blob) ----
  const rodarOcrPosUpload = useCallback(
    async (slot: string, url: string) => {
      try {
        // OCR de placa (apenas fotos com placa visível)
        if (isFotoComValidacaoPlaca(slot)) {
          try {
            const { data: cot } = await publicSupabase
              .from('cotacoes')
              .select('veiculo_placa')
              .eq('id', cotacaoId!)
              .maybeSingle();
            const placaEsperada = (cot as any)?.veiculo_placa || '';
            if (!placaEsperada || isPlacaPlaceholder(placaEsperada)) {
              setOcrPorSlot((prev) => ({
                ...prev,
                [slot]: { ...prev[slot], placaOcr: { placa: null, match: true, legivel: true, confianca: 1, skipped: true } },
              }));
            } else {
              const { data: ocrPlaca } = await supabase.functions.invoke('placa-ocr', {
                body: { url, placaEsperada, fotoTipo: slot },
              });
              if (ocrPlaca) {
                setOcrPorSlot((prev) => ({
                  ...prev,
                  [slot]: { ...prev[slot], placaOcr: ocrPlaca as PlacaOcrResultado },
                }));
              }
            }
          } catch (e) {
            console.warn('[autovistoria-offline] placa-ocr falhou (não bloqueia):', e);
          }
        }

        // OCR de odômetro
        if (slot === 'odometro' || slot === 'painel_ligado') {
          try {
            const { data: ocrData } = await supabase.functions.invoke('odometro-ocr', { body: { url } });
            if (ocrData?.km && (ocrData.confianca == null || ocrData.confianca >= 0.7)) {
              setOcrPorSlot((prev) => ({ ...prev, [slot]: { ...prev[slot], kmExtraido: ocrData.km } }));
            } else {
              setOcrPorSlot((prev) => ({ ...prev, [slot]: { ...prev[slot], ocrFalhou: true } }));
            }
          } catch (e) {
            console.warn('[autovistoria-offline] odometro-ocr falhou (não bloqueia):', e);
            setOcrPorSlot((prev) => ({ ...prev, [slot]: { ...prev[slot], ocrFalhou: true } }));
          }
        }
      } catch (e) {
        console.warn('[autovistoria-offline] OCR pós-upload exception:', e);
      }
    },
    [cotacaoId],
  );

  // ---- Worker: drena a fila ----
  const processar = useCallback(async () => {
    if (!cotacaoId) return;
    if (trabalhando.current) return;
    if (!navigator.onLine) return;
    trabalhando.current = true;
    setSincronizando(true);
    try {
      const agora = Date.now();
      const lista = await offlineDB.midias_pendentes
        .where('vistoria_id')
        .equals(cotacaoId)
        .and((m) => m.status === 'pendente' && m.proximo_retry_em <= agora && m.origem === 'cotacao_publica')
        .sortBy('criado_em');

      for (const item of lista) {
        await marcarEnviando(item.id);
        const slotKey = item.tipo === 'video' ? VIDEO_SLOT : String(item.slot);
        try {
          // 1) upload para storage (path compatível com o legado)
          const ext = item.tipo === 'video'
            ? ((item.mime || '').includes('mp4') ? 'mp4' : 'webm')
            : 'jpg';
          const fileName = `${cotacaoId}/${slotKey}-${item.criado_em}.${ext}`;

          if (item.tipo === 'video') {
            try {
              await uploadVideoWithRetry({
                supabase: publicSupabase,
                bucket: BUCKET,
                path: fileName,
                file: item.blob,
                contentType: item.mime || `video/${ext}`,
                upsert: true,
                onProgress: (pct) =>
                  setProgressoUpload((p) => ({ ...p, [slotKey]: pct })),
              });
            } catch (err) {
              if (err instanceof VideoUploadError) {
                toast.error(err.userMessage);
              }
              throw err;
            }
          } else {
            const { error: upErr } = await publicSupabase.storage
              .from(BUCKET)
              .upload(fileName, item.blob, {
                contentType: item.mime || 'image/jpeg',
                upsert: true,
              });
            if (upErr) throw new Error(upErr.message);
          }

          // 2) URL pública
          const { data: pub } = publicSupabase.storage.from(BUCKET).getPublicUrl(fileName);
          const url = pub.publicUrl;

          // 3) upsert na tabela canônica (mesmo schema do hook legado)
          const { error: dbError } = await publicSupabase
            .from('cotacoes_vistoria_fotos')
            .upsert(
              {
                cotacao_id: cotacaoId,
                tipo: slotKey,
                arquivo_url: url,
              } as any,
              { onConflict: 'cotacao_id,tipo' },
            );
          if (dbError) throw dbError;

          // 3.5) GARANTE que `fotosRemotas` já contém o slot ANTES de remover
          // o blob da fila local. Sem este refetch, há uma janela em que o
          // blob sai do `urlsLocais` e o React Query ainda não buscou — o
          // slot some do `slotsCompletos`, o contador regride e o auto-
          // posicionamento volta ao mesmo item ("Toque para fotografar").
          // Era exatamente o sintoma reportado: "só persiste se eu atualizo
          // a página". Refetch fecha a janela.
          try {
            await queryClient.refetchQueries({
              queryKey: ['cotacao-vistoria-fotos', cotacaoId],
              exact: true,
            });
          } catch (e) {
            // Refetch nunca pode bloquear o worker — se falhar, invalida
            // assíncrono e segue. O blob ainda é removido a seguir; pior
            // caso, a UI fica 1 ciclo desatualizada (ainda melhor que loop).
            console.warn('[autovistoria-offline] refetch pós-upsert falhou:', e);
            queryClient.invalidateQueries({ queryKey: ['cotacao-vistoria-fotos', cotacaoId] });
          }

          // 4) remove da fila local (agora seguro — fotosRemotas já tem o slot)
          await removerMidia(item.id);
          setProgressoUpload((p) => {
            const novo = { ...p };
            delete novo[slotKey];
            return novo;
          });


          logAuditoriaFire(cotacaoId, 'criar', '[autovistoria_upload_ok]', {
            slot: slotKey,
            tipo: item.tipo,
            size: item.tamanho,
            tentativa: item.tentativas + 1,
          });

          // 5) OCR pós-upload (não-bloqueante para o worker)
          if (item.tipo === 'foto') {
            void rodarOcrPosUpload(slotKey, url);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          await registrarFalha(item.id, msg);
          setProgressoUpload((p) => {
            const novo = { ...p };
            delete novo[slotKey];
            return novo;
          });
          logAuditoriaFire(cotacaoId, 'criar', '[autovistoria_upload_falhou]', {
            slot: slotKey,
            tipo: item.tipo,
            size: item.tamanho,
            tentativa: item.tentativas + 1,
            erro: msg.slice(0, 200),
          });
          // 4xx fatal: para o loop pra não martelar a mesma mídia agora.
          if (/HTTP 4(0[0-9]|1[0-7])/.test(msg)) break;
        }
      }
    } finally {
      trabalhando.current = false;
      setSincronizando(false);
    }
  }, [cotacaoId, rodarOcrPosUpload, queryClient]);

  // Roda quando ficar online, a cada 10s, e quando aparecem novas pendências.
  useEffect(() => {
    if (!online || !cotacaoId) return;
    void processar();
    const i = setInterval(() => void processar(), 10_000);
    return () => clearInterval(i);
  }, [online, cotacaoId, processar]);

  // Dispara processamento sempre que a lista de pendentes muda (nova captura).
  useEffect(() => {
    if (!cotacaoId || pendentes === 0) return;
    void processar();
  }, [cotacaoId, pendentes, processar]);

  // Reage ao foco da aba (Chrome restaurou após discard).
  useEffect(() => {
    if (!cotacaoId) return;
    const onFocus = () => void processar();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [cotacaoId, processar]);

  return useMemo(
    () => ({
      pendentes,
      comErro,
      sincronizando,
      online,
      urlsLocais,
      progressoUpload,
      ocrPorSlot,
      enfileirarFoto,
      enfileirarVideo,
      forcarSync: processar,
    }),
    [pendentes, comErro, sincronizando, online, urlsLocais, progressoUpload, ocrPorSlot, enfileirarFoto, enfileirarVideo, processar],
  );
}
