import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, EyeOff, ShieldCheck, ShieldAlert, Save, RefreshCw, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const FUNCOES_URL =
  (import.meta.env.VITE_SUPABASE_URL || 'https://iyxdgmukrrdkffraptsx.supabase.co') + '/functions/v1';

interface Campo {
  nome: string;
  label: string;
  tipo: 'text' | 'password';
  obrigatorio: boolean;
}

const META_CAMPOS: Campo[] = [
  { nome: 'access_token', label: 'Access Token (permissão ads_management)', tipo: 'password', obrigatorio: true },
  { nome: 'ad_account_id', label: 'Ad Account ID (ex: act_123456789 ou 123456789)', tipo: 'text', obrigatorio: true },
];

const GOOGLE_CAMPOS: Campo[] = [
  { nome: 'developer_token', label: 'Developer Token', tipo: 'password', obrigatorio: true },
  { nome: 'client_id', label: 'Client ID (OAuth)', tipo: 'text', obrigatorio: true },
  { nome: 'client_secret', label: 'Client Secret (OAuth)', tipo: 'password', obrigatorio: true },
  { nome: 'refresh_token', label: 'Refresh Token', tipo: 'password', obrigatorio: true },
  { nome: 'customer_id', label: 'Customer ID (somente dígitos)', tipo: 'text', obrigatorio: true },
  { nome: 'login_customer_id', label: 'Login Customer ID / MCC (opcional)', tipo: 'text', obrigatorio: false },
];

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function IntegracaoForm({
  integracao, titulo, descricao, campos, onTestar, testarLabel,
}: {
  integracao: string;
  titulo: string;
  descricao: string;
  campos: Campo[];
  onTestar?: () => void;
  testarLabel?: string;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [visiveis, setVisiveis] = useState<Record<string, boolean>>({});
  const [configurado, setConfigurado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregarStatus = async () => {
    try {
      const resp = await fetch(`${FUNCOES_URL}/integracoes-credenciais?integracao=${integracao}`, {
        headers: await authHeaders(),
      });
      const json = await resp.json();
      const reg = Array.isArray(json?.data) ? json.data.find((d: any) => d.integracao === integracao) : null;
      setConfigurado(!!reg?.configurado);
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salvar = async () => {
    const faltando = campos.filter((c) => c.obrigatorio && !valores[c.nome]?.trim());
    // Se ja configurado, permitir update parcial (campos vazios mantidos).
    if (!configurado && faltando.length > 0) {
      toast.error(`Preencha: ${faltando.map((c) => c.label).join(', ')}`);
      return;
    }
    setSalvando(true);
    try {
      const credenciais: Record<string, string> = {};
      for (const c of campos) {
        const v = valores[c.nome]?.trim();
        if (v) credenciais[c.nome] = v;
      }
      const resp = await fetch(`${FUNCOES_URL}/integracoes-credenciais`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ integracao, credenciais }),
      });
      const json = await resp.json();
      if (!resp.ok || json?.success === false) throw new Error(json?.error || 'Falha ao salvar');
      toast.success('Credenciais salvas com segurança (criptografadas).');
      setValores({});
      setConfigurado(true);
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e?.message ?? e}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> {titulo}
            </CardTitle>
            <CardDescription>{descricao}</CardDescription>
          </div>
          {carregando ? null : configurado ? (
            <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Configurado</Badge>
          ) : (
            <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" /> Pendente</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {configurado && (
          <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            Já configurado. Deixe um campo em branco para mantê-lo; preencha apenas o que quiser atualizar.
          </p>
        )}
        {campos.map((campo) => (
          <div key={campo.nome} className="space-y-1.5">
            <Label htmlFor={`${integracao}-${campo.nome}`}>
              {campo.label} {campo.obrigatorio && !configurado && <span className="text-destructive">*</span>}
            </Label>
            <div className="relative">
              <Input
                id={`${integracao}-${campo.nome}`}
                type={campo.tipo === 'password' && !visiveis[campo.nome] ? 'password' : 'text'}
                value={valores[campo.nome] ?? ''}
                autoComplete="off"
                placeholder={configurado ? '•••••• (mantém o atual)' : ''}
                onChange={(e) => setValores((v) => ({ ...v, [campo.nome]: e.target.value }))}
              />
              {campo.tipo === 'password' && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setVisiveis((s) => ({ ...s, [campo.nome]: !s[campo.nome] }))}
                >
                  {visiveis[campo.nome] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button onClick={salvar} disabled={salvando}>
            <Save className="mr-2 h-4 w-4" /> {salvando ? 'Salvando…' : 'Salvar credenciais'}
          </Button>
          {onTestar && configurado && (
            <Button variant="outline" onClick={onTestar}>
              <RefreshCw className="mr-2 h-4 w-4" /> {testarLabel ?? 'Testar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegracaoFocoAds() {
  const navigate = useNavigate();

  const testarMeta = () => {
    toast.promise(
      (async () => {
        const { data, error } = await (supabase as any).functions.invoke('ads-meta-sync', { body: { dias: 1 } });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data.error || 'Falha');
        return data;
      })(),
      {
        loading: 'Testando conexão e sincronizando 1 dia…',
        success: (r: any) => `Conexão OK! ${r?.insights ?? 0} linhas de insight, ${r?.campanhas ?? 0} campanhas.`,
        error: (e) => `Falha: ${e?.message ?? e}`,
      },
    );
  };

  const testarGoogle = () => {
    toast.promise(
      (async () => {
        const { data, error } = await (supabase as any).functions.invoke('ads-google-sync', { body: { dias: 1 } });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data.error || 'Falha');
        return data;
      })(),
      {
        loading: 'Testando conexão Google…',
        success: (r: any) => `Conexão OK! ${r?.insights ?? 0} linhas, ${r?.campanhas ?? 0} campanhas.`,
        error: (e) => `Falha: ${e?.message ?? e}`,
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes/integracoes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credenciais — Foco Ads</h1>
          <p className="text-muted-foreground">
            Tokens das plataformas de anúncios. Armazenados criptografados (AES-256) — nunca expostos no frontend.
          </p>
        </div>
      </div>

      <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 py-4 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            O token Meta tem permissão <strong>ads_management</strong> (pode gastar/alterar campanhas). Trate-o como
            credencial crítica. Após salvar, ele <strong>não é exibido novamente</strong>.
          </p>
        </CardContent>
      </Card>

      <IntegracaoForm
        integracao="meta_ads"
        titulo="Meta Ads (Marketing API)"
        descricao="Access token com ads_management + Ad Account ID."
        campos={META_CAMPOS}
        onTestar={testarMeta}
        testarLabel="Testar sincronização Meta"
      />

      <IntegracaoForm
        integracao="google_ads"
        titulo="Google Ads"
        descricao="Credenciais OAuth + developer token + customer ID."
        campos={GOOGLE_CAMPOS}
        onTestar={testarGoogle}
        testarLabel="Testar sincronização Google"
      />
    </div>
  );
}
