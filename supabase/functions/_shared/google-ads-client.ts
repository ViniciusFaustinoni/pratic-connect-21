// =============================================================================
// google-ads-client — helpers compartilhados para a Google Ads API (REST)
// =============================================================================
// CREDENCIAL CRITICA: refresh_token + developer_token. Nunca logar segredos.
// Usado server-side por ads-google-sync (leitura) e ads-executar-acao (escrita).
// =============================================================================

const GOOGLE_ADS_VERSION = "v17";
const ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_VERSION}`;
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleAdsCreds {
  developer_token: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  customer_id: string;
  login_customer_id?: string;
}

/** Troca refresh_token por access_token (OAuth2). Nunca loga o token. */
export async function getGoogleAccessToken(creds: GoogleAdsCreds): Promise<string> {
  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });
  const r = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error(`OAuth Google ${r.status}: ${j?.error_description || j?.error || "falha ao obter access_token"}`);
  }
  return j.access_token as string;
}

function headers(creds: GoogleAdsCreds, accessToken: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": creds.developer_token,
    "Content-Type": "application/json",
  };
  if (creds.login_customer_id) h["login-customer-id"] = creds.login_customer_id;
  return h;
}

/** Executa uma consulta GAQL (search) e retorna todas as linhas (com paginacao). */
export async function gaqlSearch(
  creds: GoogleAdsCreds,
  accessToken: string,
  query: string,
): Promise<any[]> {
  const url = `${ADS_BASE}/customers/${creds.customer_id}/googleAds:search`;
  const results: any[] = [];
  let pageToken: string | undefined;

  do {
    const r = await fetch(url, {
      method: "POST",
      headers: headers(creds, accessToken),
      body: JSON.stringify({ query, pageToken }),
    });
    const j = await r.json();
    if (!r.ok) {
      const msg = j?.error?.message || j?.[0]?.error?.message || `HTTP ${r.status}`;
      throw new Error(`Google Ads search: ${msg}`);
    }
    for (const row of j.results ?? []) results.push(row);
    pageToken = j.nextPageToken;
  } while (pageToken);

  return results;
}

/** Aplica um mutate (escrita) num recurso. Ex.: service='campaigns'. */
export async function gaqlMutate(
  creds: GoogleAdsCreds,
  accessToken: string,
  service: string,
  operations: unknown[],
): Promise<any> {
  const url = `${ADS_BASE}/customers/${creds.customer_id}/${service}:mutate`;
  const r = await fetch(url, {
    method: "POST",
    headers: headers(creds, accessToken),
    body: JSON.stringify({ operations }),
  });
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.error?.message || j?.[0]?.error?.message || `HTTP ${r.status}`;
    throw new Error(`Google Ads mutate(${service}): ${msg}`);
  }
  return j;
}
