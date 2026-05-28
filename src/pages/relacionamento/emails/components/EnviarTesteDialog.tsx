import { useMemo, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useEmailSuspensaoTemplate } from '@/hooks/emails-suspensao/useEmailSuspensao';
import { useEnviarEmailTeste } from '@/hooks/emails-suspensao/useEnviarEmailTeste';
import {
  PREVIEW_EXEMPLO,
  renderTemplateEmailSuspensao,
} from '@/hooks/emails-suspensao/template';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EnviarTesteDialog({ open, onOpenChange }: Props) {
  const { data: template } = useEmailSuspensaoTemplate();
  const enviar = useEnviarEmailTeste();

  const [destinatario, setDestinatario] = useState('');
  const [nome, setNome] = useState('');
  const [motivo, setMotivo] = useState('');
  const [data, setData] = useState('');
  const [resultado, setResultado] = useState<
    null | { ok: boolean; mensagem: string }
  >(null);

  const vars = useMemo(
    () => ({
      nome_cliente: nome.trim() || PREVIEW_EXEMPLO.nome_cliente,
      motivo_suspensao: motivo.trim() || PREVIEW_EXEMPLO.motivo_suspensao,
      data: data.trim() || PREVIEW_EXEMPLO.data,
    }),
    [nome, motivo, data],
  );

  const assuntoPreview = useMemo(
    () => renderTemplateEmailSuspensao(template?.assunto ?? '', vars),
    [template?.assunto, vars],
  );
  const corpoPreview = useMemo(
    () => renderTemplateEmailSuspensao(template?.corpo ?? '', vars),
    [template?.corpo, vars],
  );

  const destinatarioValido = EMAIL_RE.test(destinatario.trim());

  function resetAndClose(o: boolean) {
    if (!o) {
      setResultado(null);
    }
    onOpenChange(o);
  }

  async function handleEnviar() {
    setResultado(null);
    try {
      const res = await enviar.mutateAsync({
        destinatario: destinatario.trim(),
        variaveis: {
          nome_cliente: nome.trim() || undefined,
          motivo_suspensao: motivo.trim() || undefined,
          data: data.trim() || undefined,
        },
      });
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
            Dispara um envio real via Resend usando o template salvo. O envio é registrado
            no histórico com origem <strong>teste_manual</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="v-nome">Nome do cliente</Label>
              <Input
                id="v-nome"
                placeholder={PREVIEW_EXEMPLO.nome_cliente}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-motivo">Motivo da suspensão</Label>
              <Input
                id="v-motivo"
                placeholder={PREVIEW_EXEMPLO.motivo_suspensao}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-data">Data</Label>
              <Input
                id="v-data"
                placeholder={PREVIEW_EXEMPLO.data}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Assunto</p>
              <p className="text-sm font-medium">{assuntoPreview || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Corpo renderizado</p>
              <Textarea
                readOnly
                value={corpoPreview}
                className="mt-1 h-40 font-mono text-xs bg-background"
              />
            </div>
          </div>

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
          <Button onClick={handleEnviar} disabled={!destinatarioValido || enviar.isPending}>
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
