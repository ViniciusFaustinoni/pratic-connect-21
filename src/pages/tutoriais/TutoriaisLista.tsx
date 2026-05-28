import { useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { useTutoriais, useDeleteTutorial, useSeedTutoriaisPadrao, type TutorialRow } from '@/hooks/useTutoriais';
import { TutorialCard } from '@/components/tutoriais/TutorialCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { TutorialEditorDialog } from '@/components/tutoriais/TutorialEditorDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function TutoriaisLista() {
  const { data: tutoriais = [], isLoading } = useTutoriais();
  const { hasAnyPerfil } = useAuth();
  const canManage = hasAnyPerfil(['diretor', 'admin_master']);
  const seedDefaults = useSeedTutoriaisPadrao();
  const del = useDeleteTutorial();

  const [editing, setEditing] = useState<TutorialRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<TutorialRow | null>(null);

  const porCategoria = tutoriais.reduce<Record<string, TutorialRow[]>>((acc, t) => {
    (acc[t.categoria] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tutoriais de Uso</h1>
            <p className="text-sm text-muted-foreground">
              Guias práticos para você operar o sistema com segurança e velocidade.
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {tutoriais.length === 0 && !isLoading && (
              <Button
                variant="outline"
                onClick={() => seedDefaults.mutate(undefined, {
                  onSuccess: () => toast.success('Tutoriais padrão restaurados'),
                  onError: (e: any) => toast.error(e.message ?? 'Falha ao restaurar'),
                })}
                disabled={seedDefaults.isPending}
              >
                Restaurar tutoriais padrão
              </Button>
            )}
            <Button onClick={() => setCreating(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo Tutorial
            </Button>
          </div>
        )}
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {Object.entries(porCategoria).map(([categoria, items]) => (
        <section key={categoria} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {categoria}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TutorialCard
                key={t.id}
                tutorial={t}
                canManage={canManage}
                onEdit={setEditing}
                onDelete={setToDelete}
              />
            ))}
          </div>
        </section>
      ))}

      {!isLoading && tutoriais.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum tutorial publicado ainda.{' '}
          {canManage && 'Use "Restaurar tutoriais padrão" ou "Novo Tutorial" para começar.'}
        </p>
      )}

      {(editing || creating) && (
        <TutorialEditorDialog
          tutorial={editing ?? undefined}
          open
          onOpenChange={(o) => {
            if (!o) {
              setEditing(null);
              setCreating(false);
            }
          }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tutorial?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o tutorial &quot;{toDelete?.titulo}&quot; e todos
              os seus passos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await del.mutateAsync(toDelete.id);
                  toast.success('Tutorial excluído');
                  setToDelete(null);
                } catch (e: any) {
                  toast.error(e.message ?? 'Falha ao excluir');
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
