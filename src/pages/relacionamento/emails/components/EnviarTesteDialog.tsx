import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, AlertCircle, CheckCircle2, Search, X, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEnviarEmailTeste } from '@/hooks/emails-suspensao/useEnviarEmailTeste';
import {
  useEmailSuspensaoTemplatesList,
  type EmailSuspensaoTemplateItem,
} from '@/hooks/emails-suspensao/useTemplatesList';
import { useAssociadoSearch, type AssociadoSearchResult } from '@/hooks/useAssociadoSearch';
import { extrairVariaveisSet } from '../lib/validarVariaveisTemplate';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SAMPLE_DEFAULTS: Record<string, string> = {
  nome_cliente: 'Maria Souza',
  placa: 'ABC1D23',
  prazo_horas: '48',
  motivo_suspensao: 'Inadimplência da mensalidade de maio',
  data: new Date().toLocaleDateString('pt-BR'),
};

type ValueSource = 'associado' | 'manual' | 'placeholder';

function renderPreview(text: string, vars: Record<string, string>): string {
  let out = text ?? '';
  for (const [k, v] of Object.entries(vars)) {
    // Regex case-insensitive — aceita {{Nome_Cliente}} ou {{nome_cliente}}
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi'), v);
  }
  return out;
}

export function EnviarTesteDialog({ open, onOpenChange }: Props) {
  const { data: templates = [] } = useEmailSuspensaoTemplatesList();
  const enviar = useEnviarEmailTeste();

  const [templateKey, setTemplateKey] = useState<string>('');
  const [destinatario, setDestinatario] = useState('');
  const [vars, setVars] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<null | { ok: boolean; mensagem: string }>(null);

  // Lookup de associado real
  const [buscaAssociado, setBuscaAssociado] = useState('');
  const [associadoSelecionado, setAssociadoSelecionado] = useState<AssociadoSearchResult | null>(null);
  const [associadoVars, setAssociadoVars] = useState<Record<string, string>>({});
  const [carregandoAssociado, setCarregandoAssociado] = useState(false);
  const { data: resultadosBusca = [] } = useAssociadoSearch(buscaAssociado);

  useEffect(() => {
    if (open && !templateKey && templates.length > 0) {
      const first = templates.find((t) => t.ativo) ?? templates[0];
      setTemplateKey(first.fluxo_key);
    }
  }, [open, templates, templateKey]);

  const template: EmailSuspensaoTemplateItem | undefined = useMemo(
    () => templates.find((t) => t.fluxo_key === templateKey),
    [templates, templateKey],
  );

  // Variáveis efetivamente presentes no texto do template (assunto + corpo)
  // — chaves normalizadas para lowercase, usadas como fonte da verdade para
  // o bloqueio do botão "Enviar agora".
  const varsNoTexto = useMemo(() => {
    if (!template) return new Set<string>();
    const set = new Set<string>();
    extrairVariaveisSet(template.assunto).forEach((v) => set.add(v));
    extrairVariaveisSet(template.corpo).forEach((v) => set.add(v));
    return set;
  }, [template]);

  // Resolve o valor de cada variável + origem (associado, manual, placeholder)
  const valoresResolvidos = useMemo(() => {
    const map = new Map<string, { value: string; source: ValueSource }>();
    const declaradas = (template?.variaveis_disponiveis ?? []).map((v) => v.code.replace(/[{}\s]/g, ''));
    // União: declaradas no fluxo + as que aparecem no texto (cobre casos desconhecidos)
    const todas = new Set<string>([...declaradas, ...varsNoTexto]);

    for (const keyOriginal of todas) {
      const k = keyOriginal.toLowerCase();
      const manual = vars[k]?.trim();
      const doAssoc = associadoVars[k]?.trim();
      if (manual) {
        map.set(k, { value: manual, source: 'manual' });
      } else if (doAssoc) {
        map.set(k, { value: doAssoc, source: 'associado' });
      } else if (SAMPLE_DEFAULTS[k]) {
        map.set(k, { value: SAMPLE_DEFAULTS[k], source: 'placeholder' });
      } else {
        map.set(k, { value: '', source: 'placeholder' });
      }
    }
    return map;
  }, [template, vars, associadoVars, varsNoTexto]);

  const effectiveVars = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of valoresResolvidos) {
      out[k] = v.value || `<${k}>`;
    }
    return out;
  }, [valoresResolvidos]);

  // BLOQUEIO: variável presente no TEXTO do template E sem valor real
  // (manual ou via associado) — placeholder/SAMPLE_DEFAULTS NÃO conta como real.
  const variaveisFaltantes = useMemo(() => {
    const faltam: string[] = [];
    for (const k of varsNoTexto) {
      const resolvido = valoresResolvidos.get(k);
      if (!resolvido || resolvido.source === 'placeholder') {
        faltam.push(k);
      }
    }
    return faltam;
  }, [varsNoTexto, valoresResolvidos]);

  const destinatarioValido = EMAIL_RE.test(destinatario.trim());

  async function selecionarAssociado(a: AssociadoSearchResult) {
    setAssociadoSelecionado(a);
    setBuscaAssociado('');
    setCarregandoAssociado(true);
    try {
      const novasVars: Record<string, string> = {
        nome_cliente: a.nome ?? '',
        data: new Date().toLocaleDateString('pt-BR'),
      };

      // Sugere e-mail do associado como destinatário se ainda estiver vazio
      if (!destinatario && a.id) {
        const { data: assocFull } = await supabase
          .from('associados')
          .select('email')
          .eq('id', a.id)
          .maybeSingle();
        if (assocFull?.email) setDestinatario(assocFull.email);
      }

      // Busca veículo ativo principal pra puxar a placa
      if (a.id) {
        const { data: veiculo } = await supabase
          .from('veiculos')
          .select('placa, status')
          .eq('associado_id', a.id)
          .in('status', ['ativo', 'instalacao_pendente', 'em_analise'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (veiculo?.placa) novasVars.placa = veiculo.placa;
      }

      setAssociadoVars(novasVars);
    } catch (e) {
      console.warn('[EnviarTesteDialog] erro ao popular vars do associado:', e);
    } finally {
      setCarregandoAssociado(false);
    }
  }

  function limparAssociado() {
    setAssociadoSelecionado(null);
    setAssociadoVars({});
  }

  function resetAndClose(o: boolean) {
    if (!o) {
      setResultado(null);
      setVars({});
      setDestinatario('');
      setTemplateKey('');
      setBuscaAssociado('');
      setAssociadoSelecionado(null);
      setAssociadoVars({});
    }
    onOpenChange(o);
  }

  async function handleEnviar() {
    setResultado(null);
    try {
      const res = await enviar.mutateAsync({
        destinatario: destinatario.trim(),
        template_key: templateKey,
        variaveis: vars,
      } as any);
      if (res.ok) {
        setResultado({ ok: true, mensagem: `Enviado com sucesso (id: ${res.id ?? '—'})` });
      } else {
        setResultado({
          ok: false,
          mensagem: res.erro
            ? `Falha: ${res.erro}${res.http_status ? ` (HTTP ${res.http_status})` : ''}`
            : 'Falha no envio (sem detalhes).',
        });
      }
    } catch (e: any) {
      setResultado({ ok: false, mensagem: e?.message || 'Erro inesperado' });
    }
  }

  const bloqueioVariaveis = variaveisFaltantes.length > 0;

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar e-mail de teste</DialogTitle>
          <DialogDescription>
            Escolha qual template testar. O envio é real (Resend) e fica registrado no histórico
            com origem <strong>teste_manual</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.fluxo_key}>
                    {t.nome} · <span className="font-mono text-xs">{t.fluxo_key}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pré-visualizar com associado real (opcional)</Label>
            {associadoSelecionado ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{associadoSelecionado.nome}</span>
                  <span className="text-xs text-muted-foreground">CPF {associadoSelecionado.cpf}</span>
                  {carregandoAssociado && <Loader2 className="h-3 w-3 animate-spin" />}
                </div>
                <Button variant="ghost" size="sm" onClick={limparAssociado} className="h-7">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou telefone…"
                  value={buscaAssociado}
                  onChange={(e) => setBuscaAssociado(e.target.value)}
                  className="pl-9"
                />
                {buscaAssociado.length >= 2 && resultadosBusca.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                    {resultadosBusca.slice(0, 8).map((a) => (
                      <button
                        key={`${a.id || 'sga'}-${a.cpf}`}
                        type="button"
                        onClick={() => selecionarAssociado(a)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="font-medium">{a.nome}</span>
                        <span className="text-xs text-muted-foreground">{a.cpf}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="destinatario">E-mail de destino *</Label>
            <Input
              id="destinatario"
              type="email"
              placeholder="voce@exemplo.com"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
            />
          </div>

          {template && template.variaveis_disponiveis.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {template.variaveis_disponiveis.map((v) => {
                const key = v.code.replace(/[{}\s]/g, '').toLowerCase();
                const resolvido = valoresResolvidos.get(key);
                const source = resolvido?.source ?? 'placeholder';
                const usadaNoTexto = varsNoTexto.has(key);
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`var-${key}`}>{v.label}</Label>
                      {usadaNoTexto && source === 'placeholder' && (
                        <Badge variant="destructive" className="text-[10px]">sem valor</Badge>
                      )}
                      {source === 'associado' && (
                        <Badge variant="secondary" className="text-[10px]">via associado</Badge>
                      )}
                      {source === 'manual' && (
                        <Badge variant="outline" className="text-[10px]">manual</Badge>
                      )}
                    </div>
                    <Input
                      id={`var-${key}`}
                      placeholder={associadoVars[key] || SAMPLE_DEFAULTS[key] || `<${key}>`}
                      value={vars[key] ?? ''}
                      onChange={(e) =>
                        setVars((s) => ({ ...s, [key]: e.target.value }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}

          {template && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Assunto</p>
                <p className="text-sm font-medium">
                  {renderPreview(template.assunto, effectiveVars) || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Corpo renderizado</p>
                <Textarea
                  readOnly
                  value={renderPreview(template.corpo, effectiveVars)}
                  className="mt-1 h-40 font-mono text-xs bg-background"
                />
              </div>
            </div>
          )}

          {bloqueioVariaveis && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Preencha estas variáveis usadas no template antes de enviar:{' '}
                {variaveisFaltantes.map((v) => (
                  <Badge key={v} variant="destructive" className="ml-1 font-mono text-[10px]">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {resultado && (
            <Alert variant={resultado.ok ? 'default' : 'destructive'}>
              {resultado.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{resultado.mensagem}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => resetAndClose(false)} disabled={enviar.isPending}>
            Fechar
          </Button>
          <Button
            onClick={handleEnviar}
            disabled={!destinatarioValido || !templateKey || enviar.isPending || bloqueioVariaveis}
          >
            {enviar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
