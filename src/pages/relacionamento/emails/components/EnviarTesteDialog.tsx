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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useEnviarEmailTeste } from '@/hooks/emails-suspensao/useEnviarEmailTeste';
import {
  useEmailSuspensaoTemplatesList,
  type EmailSuspensaoTemplateItem,
} from '@/hooks/emails-suspensao/useTemplatesList';

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

function renderPreview(text: string, vars: Record<string, string>): string {
  let out = text ?? '';
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v);
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

  const effectiveVars = useMemo(() => {
    const out: Record<string, string> = {};
    (template?.variaveis_disponiveis ?? []).forEach((v) => {
      const key = v.code.replace(/[{}\s]/g, '');
      out[key] = vars[key]?.trim() || SAMPLE_DEFAULTS[key] || `<${key}>`;
    });
    return out;
  }, [template, vars]);

  const destinatarioValido = EMAIL_RE.test(destinatario.trim());

  function resetAndClose(o: boolean) {
    if (!o) {
      setResultado(null);
      setVars({});
      setDestinatario('');
      setTemplateKey('');
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

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl">
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
                const key = v.code.replace(/[{}\s]/g, '');
                return (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`var-${key}`}>{v.label}</Label>
                    <Input
                      id={`var-${key}`}
                      placeholder={SAMPLE_DEFAULTS[key] || `<${key}>`}
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
            disabled={!destinatarioValido || !templateKey || enviar.isPending}
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
