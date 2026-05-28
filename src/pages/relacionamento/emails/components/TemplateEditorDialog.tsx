import { useEffect, useRef, useState } from 'react';
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
import { Save, Loader2 } from 'lucide-react';
import {
  useUpdateEmailSuspensaoTemplateItem,
  type EmailSuspensaoTemplateItem,
} from '@/hooks/emails-suspensao/useTemplatesList';

interface Props {
  template: EmailSuspensaoTemplateItem | null;
  onOpenChange: (open: boolean) => void;
}

function renderPreview(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v);
  }
  return out;
}

const SAMPLE_VARS: Record<string, string> = {
  nome_cliente: 'Maria Souza',
  placa: 'ABC1D23',
  prazo_horas: '48',
  motivo_suspensao: 'Inadimplência da mensalidade de maio',
  data: new Date().toLocaleDateString('pt-BR'),
};

export function TemplateEditorDialog({ template, onOpenChange }: Props) {
  const update = useUpdateEmailSuspensaoTemplateItem();
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setAssunto(template.assunto);
      setCorpo(template.corpo);
    }
  }, [template?.id]);

  if (!template) return null;

  const dirty = assunto !== template.assunto || corpo !== template.corpo;

  const inserirVariavel = (code: string) => {
    const el = corpoRef.current;
    if (!el) { setCorpo((c) => c + code); return; }
    const start = el.selectionStart ?? corpo.length;
    const end = el.selectionEnd ?? corpo.length;
    setCorpo(corpo.slice(0, start) + code + corpo.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + code.length;
      el.setSelectionRange(pos, pos);
    });
  };

  async function handleSave() {
    await update.mutateAsync({ id: template!.id, assunto, corpo });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{template.nome}</DialogTitle>
          <DialogDescription>
            Identificador do fluxo:{' '}
            <code className="font-mono text-xs">{template.fluxo_key}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="assunto">Assunto</Label>
              <Input
                id="assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Variáveis disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                {template.variaveis_disponiveis.map((v) => (
                  <Button
                    key={v.code}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inserirVariavel(v.code)}
                    className="font-mono text-xs"
                    title={v.label}
                  >
                    {v.code}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="corpo">Corpo do e-mail</Label>
              <Textarea
                id="corpo"
                ref={corpoRef}
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                rows={16}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Pré-visualização</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs uppercase text-muted-foreground">Assunto</p>
              <p className="font-medium text-sm">
                {renderPreview(assunto, SAMPLE_VARS) || (
                  <span className="text-muted-foreground italic">(vazio)</span>
                )}
              </p>
            </div>
            <div className="rounded-md border bg-background p-4 whitespace-pre-wrap text-sm leading-relaxed min-h-[320px]">
              {renderPreview(corpo, SAMPLE_VARS) || (
                <span className="text-muted-foreground italic">(vazio)</span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          {dirty ? (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Alterações não salvas
            </Badge>
          ) : <span className="text-xs text-muted-foreground">Tudo salvo</span>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
              Fechar
            </Button>
            <Button onClick={handleSave} disabled={!dirty || update.isPending}>
              {update.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
