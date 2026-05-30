import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Save, Loader2, AlertTriangle, Info } from 'lucide-react';
import {
  useUpdateEmailSuspensaoTemplateItem,
  type EmailSuspensaoTemplateItem,
} from '@/hooks/emails-suspensao/useTemplatesList';
import { EmailBodyEditor } from './EmailBodyEditor';
import { wrapPraticcarEmail } from '../lib/wrapPraticcarEmail';
import { validarTemplate } from '../lib/validarVariaveisTemplate';

interface Props {
  template: EmailSuspensaoTemplateItem | null;
  onOpenChange: (open: boolean) => void;
}

function renderVars(text: string, vars: Record<string, string>): string {
  let out = text ?? '';
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
  const insertVarRef = useRef<((code: string) => void) | null>(null);

  useEffect(() => {
    if (template) {
      setAssunto(template.assunto);
      setCorpo(template.corpo);
    }
  }, [template?.id]);

  if (!template) return null;

  const dirty = assunto !== template.assunto || corpo !== template.corpo;

  const validacao = useMemo(
    () =>
      validarTemplate({
        assunto,
        corpo,
        declaradas: (template.variaveis_disponiveis ?? []).map((v) => ({ code: v.code, label: v.label })),
      }),
    [assunto, corpo, template.variaveis_disponiveis],
  );

  const inserirVariavel = (code: string) => {
    if (insertVarRef.current) {
      insertVarRef.current(code);
      return;
    }
    setCorpo((c) => c + code);
  };

  async function handleSave() {
    await update.mutateAsync({
      id: template!.id,
      assunto,
      corpo,
      // ao salvar pelo editor visual, promovemos sempre o template a html
      formato: 'html',
    });
    onOpenChange(false);
  }

  const previewHtml = wrapPraticcarEmail({
    assunto: renderVars(assunto, SAMPLE_VARS) || '(sem assunto)',
    corpoHtml: renderVars(corpo, SAMPLE_VARS),
    formato: template.formato,
  });

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>{template.nome}</DialogTitle>
          <DialogDescription>
            Identificador do fluxo:{' '}
            <code className="font-mono text-xs">{template.fluxo_key}</code>
            {template.formato === 'texto' && (
              <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700">
                Migrando de texto puro — será salvo como HTML
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

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
            <Label>Corpo do e-mail</Label>
            <EmailBodyEditor
              value={corpo}
              onChange={setCorpo}
              insertVariableRef={insertVarRef}
              previewHtml={previewHtml}
            />
            <p className="text-xs text-muted-foreground">
              O cabeçalho azul e o rodapé com CNPJ são adicionados automaticamente em todos os e-mails.
              Você edita só o conteúdo do meio.
            </p>
          </div>

          {validacao.desconhecidas.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Variáveis não reconhecidas</AlertTitle>
              <AlertDescription>
                <p className="mb-2 text-sm">
                  Essas variáveis aparecem no template mas não estão na lista de variáveis suportadas deste fluxo.
                  No envio real elas serão substituídas por <strong>vazio</strong>.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {validacao.desconhecidas.map((v) => (
                    <Badge key={v} variant="destructive" className="font-mono text-xs">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validacao.naoUsadas.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Variáveis declaradas mas não usadas</AlertTitle>
              <AlertDescription>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {validacao.naoUsadas.map((v) => (
                    <Badge key={v} variant="outline" className="font-mono text-xs">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
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
