import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useEmailSuspensaoTemplatesList,
  useUpdateEmailSuspensaoTemplateItem,
  type EmailSuspensaoTemplateItem,
} from '@/hooks/emails-suspensao/useTemplatesList';
import { TemplateEditorDialog } from './TemplateEditorDialog';

export function TemplatesList() {
  const { data: templates, isLoading } = useEmailSuspensaoTemplatesList();
  const update = useUpdateEmailSuspensaoTemplateItem();
  const [editing, setEditing] = useState<EmailSuspensaoTemplateItem | null>(null);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const items = templates ?? [];

  return (
    <>
      <div className="space-y-3">
        {items.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Nenhum template cadastrado.
            </CardContent>
          </Card>
        )}

        {items.map((t) => {
          const populado = !!(t.assunto?.trim() && t.corpo?.trim());
          return (
            <Card key={t.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Mail className="h-4 w-4 text-primary" />
                      {t.nome}
                      <Badge variant="outline" className="font-mono text-xs">
                        {t.fluxo_key}
                      </Badge>
                      {!populado && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Não populado
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Última edição:{' '}
                      {format(new Date(t.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <Switch
                        checked={t.ativo}
                        disabled={update.isPending || !populado}
                        onCheckedChange={(ativo) => update.mutate({ id: t.id, ativo })}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm">
                  <span className="text-xs uppercase text-muted-foreground mr-2">Assunto</span>
                  {t.assunto || <span className="italic text-muted-foreground">(vazio)</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2 whitespace-pre-wrap">
                  {t.corpo || '(corpo vazio)'}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TemplateEditorDialog
        template={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </>
  );
}
