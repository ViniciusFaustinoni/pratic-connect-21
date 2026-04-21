/**
 * Telemetria leve client-side de uso do Supabase.
 * Agrega chamadas em janelas de 1 min e envia em lote a cada 5 min.
 * Custo: 1 insert por sessão por janela com dados — desprezível.
 */

interface Bucket {
  endpoint: string;
  method: string;
  status_bucket: string;
  count: number;
  error_count: number;
  total_ms: number;
  window_start: number;
}

const WINDOW_MS = 60_000; // 1 min
const FLUSH_MS = 5 * 60_000; // 5 min
const SESSION_ID = `s_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

const buckets = new Map<string, Bucket>();
let flushTimer: ReturnType<typeof setInterval> | null = null;
let supabaseRef: any = null;

function getRoute(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname || '';
}

function classifyStatus(status: number, isTimeout: boolean): string {
  if (isTimeout) return 'timeout';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 200) return '2xx';
  return 'other';
}

function endpointFromUrl(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname;
    // /rest/v1/<table> -> rest:<table>
    const rest = path.match(/\/rest\/v1\/([^/?]+)/);
    if (rest) return `rest:${rest[1]}`;
    const fn = path.match(/\/functions\/v1\/([^/?]+)/);
    if (fn) return `fn:${fn[1]}`;
    if (path.includes('/auth/v1/')) {
      const seg = path.split('/auth/v1/')[1]?.split('?')[0] || 'auth';
      return `auth:${seg}`;
    }
    if (path.includes('/realtime/')) return 'realtime';
    if (path.includes('/storage/v1/')) {
      const seg = path.split('/storage/v1/')[1]?.split('/')[0] || 'storage';
      return `storage:${seg}`;
    }
    return path;
  } catch {
    return 'unknown';
  }
}

export function recordCall(opts: {
  url: string;
  method: string;
  status: number;
  durationMs: number;
  isTimeout?: boolean;
}) {
  try {
    const endpoint = endpointFromUrl(opts.url);
    // Ignora a própria telemetria para não criar loop
    if (endpoint === 'rest:client_telemetry') return;

    const window_start = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
    const status_bucket = classifyStatus(opts.status, !!opts.isTimeout);
    const key = `${window_start}|${endpoint}|${opts.method}|${status_bucket}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.total_ms += opts.durationMs;
      if (status_bucket !== '2xx') existing.error_count += 1;
    } else {
      buckets.set(key, {
        endpoint,
        method: opts.method,
        status_bucket,
        count: 1,
        error_count: status_bucket === '2xx' ? 0 : 1,
        total_ms: opts.durationMs,
        window_start,
      });
    }
  } catch {
    /* noop */
  }
}

async function flush() {
  if (!supabaseRef || buckets.size === 0) return;
  const snapshot = Array.from(buckets.values());
  buckets.clear();

  try {
    const {
      data: { user },
    } = await supabaseRef.auth.getUser();
    if (!user) return; // sem sessão, descarta (RLS exige authenticated)

    const route = getRoute();
    const rows = snapshot.map((b) => ({
      user_id: user.id,
      session_id: SESSION_ID,
      route,
      endpoint: b.endpoint,
      method: b.method,
      status_bucket: b.status_bucket,
      count: b.count,
      error_count: b.error_count,
      avg_ms: Math.round(b.total_ms / b.count),
      window_start: new Date(b.window_start).toISOString(),
    }));

    await supabaseRef.from('client_telemetry').insert(rows);
  } catch (e) {
    // Silencioso: telemetria nunca pode quebrar o app
    console.debug('[telemetry] flush falhou', e);
  }
}

export function initTelemetry(client: any) {
  supabaseRef = client;
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_MS);
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      // Best-effort flush
      flush();
    });
  }
}
