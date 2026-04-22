import Dexie, { type Table } from 'dexie';

/**
 * Banco local (IndexedDB) para suportar vistorias offline.
 * Persiste blobs de fotos/vídeos até que sejam sincronizados com o Supabase.
 */

export type MidiaTipo = 'foto' | 'video';
export type SyncStatus = 'pendente' | 'enviando' | 'enviada' | 'erro';

export interface MidiaPendente {
  /** UUID gerado no cliente — também usado como idempotency key no servidor */
  id: string;
  /** ID da vistoria a que pertence */
  vistoria_id: string;
  /** Origem da vistoria — define qual edge function vai recebê-la */
  origem: 'regulador' | 'instalador';
  tipo: MidiaTipo;
  /** Slot/índice da foto (1-10) ou identificador (ex.: 'frente', 'video_360') */
  slot: string | number;
  /** Conteúdo binário */
  blob: Blob;
  mime: string;
  tamanho: number;
  criado_em: number;
  status: SyncStatus;
  tentativas: number;
  proximo_retry_em: number;
  ultimo_erro: string | null;
}

export interface VistoriaPendente {
  id: string; // mesmo ID da vistoria no servidor
  origem: 'regulador' | 'instalador';
  /** Snapshot dos dados (não-mídia) salvos offline para envio na finalização */
  payload: Record<string, unknown>;
  status: SyncStatus | 'rascunho';
  atualizado_em: number;
}

class OfflineDB extends Dexie {
  midias_pendentes!: Table<MidiaPendente, string>;
  vistorias_pendentes!: Table<VistoriaPendente, string>;

  constructor() {
    super('praticcar-offline-v1');
    this.version(1).stores({
      midias_pendentes: 'id, vistoria_id, status, criado_em, [vistoria_id+tipo]',
      vistorias_pendentes: 'id, status, atualizado_em',
    });
  }
}

export const offlineDB = new OfflineDB();

/** Gera um UUID v4 — funciona offline, sem depender de bibliotecas externas */
export function gerarClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback simples
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Adiciona uma mídia à fila e devolve o registro persistido.
 *
 * Para fotos > 250KB, comprime antes de gravar no IndexedDB para
 * (a) evitar estourar quota de storage do Dexie em low-end e
 * (b) reduzir a memória usada na fila offline.
 */
export async function enfileirarMidia(params: {
  vistoria_id: string;
  origem: 'regulador' | 'instalador';
  tipo: MidiaTipo;
  slot: string | number;
  blob: Blob;
  mime?: string;
}): Promise<MidiaPendente> {
  let blobFinal = params.blob;
  let mimeFinal = params.mime || params.blob.type || (params.tipo === 'video' ? 'video/webm' : 'image/jpeg');

  if (params.tipo === 'foto' && params.blob.size > 250 * 1024) {
    try {
      // Import dinâmico evita ciclo (compressImage importa hooks de capability).
      const { compressImage } = await import('@/lib/imageCompressor');
      const fileIn = params.blob instanceof File
        ? params.blob
        : new File([params.blob], `foto_${Date.now()}.jpg`, { type: mimeFinal });
      const compressed = await compressImage(fileIn);
      blobFinal = compressed;
      mimeFinal = 'image/jpeg';
    } catch (err) {
      console.warn('[enfileirarMidia] Falha ao comprimir foto, gravando original:', err);
    }
  }

  const registro: MidiaPendente = {
    id: gerarClientId(),
    vistoria_id: params.vistoria_id,
    origem: params.origem,
    tipo: params.tipo,
    slot: params.slot,
    blob: blobFinal,
    mime: mimeFinal,
    tamanho: blobFinal.size,
    criado_em: Date.now(),
    status: 'pendente',
    tentativas: 0,
    proximo_retry_em: 0,
    ultimo_erro: null,
  };
  await offlineDB.midias_pendentes.put(registro);
  return registro;
}

/** Remove mídia da fila local (após confirmação de upload) */
export async function removerMidia(id: string): Promise<void> {
  await offlineDB.midias_pendentes.delete(id);
}

/** Marca mídia como em envio */
export async function marcarEnviando(id: string): Promise<void> {
  await offlineDB.midias_pendentes.update(id, { status: 'enviando' });
}

/** Registra falha de upload com backoff exponencial */
export async function registrarFalha(id: string, mensagem: string): Promise<void> {
  const atual = await offlineDB.midias_pendentes.get(id);
  if (!atual) return;
  const tentativas = atual.tentativas + 1;
  // Backoff: 5s, 30s, 2min, 10min, 1h, 1h, 1h...
  const atrasos = [5_000, 30_000, 120_000, 600_000, 3_600_000];
  const atraso = atrasos[Math.min(tentativas - 1, atrasos.length - 1)];
  await offlineDB.midias_pendentes.update(id, {
    status: 'pendente',
    tentativas,
    proximo_retry_em: Date.now() + atraso,
    ultimo_erro: mensagem,
  });
}

/** Lista mídias prontas para envio (status pendente e fora do janela de backoff) */
export async function listarProntasParaEnvio(): Promise<MidiaPendente[]> {
  const agora = Date.now();
  return offlineDB.midias_pendentes
    .where('status')
    .equals('pendente')
    .and((m) => m.proximo_retry_em <= agora)
    .sortBy('criado_em');
}
