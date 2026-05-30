import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Save, Loader2, AlertTriangle, Info } from 'lucide-react';
import {
  useEmailSuspensaoTemplate,
  useUpdateEmailSuspensaoTemplate,
} from '@/hooks/emails-suspensao/useEmailSuspensao';
import {
  PREVIEW_EXEMPLO,
  VARIAVEIS_TEMPLATE,
  renderTemplateEmailSuspensao,
} from '@/hooks/emails-suspensao/template';
import { validarTemplate } from '../lib/validarVariaveisTemplate';

export function TemplateEditor() {
  const { data: tpl, isLoading } = useEmailSuspensaoTemplate();
  const update = useUpdateEmailSuspensaoTemplate();

  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (tpl) {
      setAssunto(tpl.assunto);
      setCorpo(tpl.corpo);
    }
  }, [tpl?.id]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!tpl) return null;

  const dirty = assunto !== tpl.assunto || corpo !== tpl.corpo;

  // Validação de variáveis (regex aceita [A-Za-z0-9_], comparação case-insensitive)
  const validacao = useMemo(
    () => validarTemplate({ assunto, corpo, declaradas: VARIAVEIS_TEMPLATE.map((v) => ({ code: v.code, label: v.label })) }),
    [assunto, corpo],
  );

  const inserirVariavel = (code: string) => {
    const el = corpoRef.current;
    if (!el) {
      setCorpo((c) => c + code);
      return;
    }
    const start = el.selectionStart ?? corpo.length;
    const end = el.selectionEnd ?? corpo.length;
    const next = corpo.slice(0, start) + code + corpo.slice(end);
    setCorpo(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + code.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Template de e-mail</CardTitle>
          <CardDescription>
            Use as variáveis abaixo para personalizar a mensagem com dados do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assunto">Assunto</Label>
            <Input
              id="assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Sua conta foi suspensa"
            />
          </div>

          <div className="space-y-2">
            <Label>Variáveis disponíveis</Label>
            <div className="flex flex-wrap gap-2">
              {VARIAVEIS_TEMPLATE.map((v) => (
                <Button
                  key={v.code}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inserirVariavel(v.code)}
                  className="font-mono text-xs"
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
              rows={14}
              className="font-mono text-sm"
            />
          </div>

          {validacao.desconhecidas.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Variáveis não reconhecidas</AlertTitle>
              <AlertDescription>
                <p className="mb-2 text-sm">
                  Essas variáveis aparecem no template mas não estão na lista de variáveis suportadas.
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


          <div className="flex items-center justify-between">
            {dirty ? (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Alterações não salvas
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">Tudo salvo</span>
            )}
            <Button
              disabled={!dirty || update.isPending}
              onClick={() => update.mutate({ id: tpl.id, assunto, corpo })}
            >
              {update.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização</CardTitle>
          <CardDescription>Como o cliente verá o e-mail (dados de exemplo).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs uppercase text-muted-foreground">Assunto</p>
            <p className="font-medium">
              {renderTemplateEmailSuspensao(assunto, PREVIEW_EXEMPLO) || (
                <span className="text-muted-foreground italic">(vazio)</span>
              )}
            </p>
          </div>
          <div className="rounded-md border bg-background p-4 whitespace-pre-wrap text-sm leading-relaxed min-h-[280px]">
            {renderTemplateEmailSuspensao(corpo, PREVIEW_EXEMPLO) || (
              <span className="text-muted-foreground italic">(vazio)</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Exemplo: <strong>{PREVIEW_EXEMPLO.nome_cliente}</strong> · Motivo:{' '}
            <strong>{PREVIEW_EXEMPLO.motivo_suspensao}</strong> · Data:{' '}
            <strong>{PREVIEW_EXEMPLO.data}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
