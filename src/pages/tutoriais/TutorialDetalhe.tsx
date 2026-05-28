import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { useTutorialBySlug } from '@/hooks/useTutoriais';
import { TutorialIndex } from '@/components/tutoriais/TutorialIndex';
import { TutorialStepView } from '@/components/tutoriais/TutorialStepView';
import { useAuth } from '@/contexts/AuthContext';
import { TutorialEditorDialog } from '@/components/tutoriais/TutorialEditorDialog';

export default function TutorialDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const { data: tutorial, isLoading } = useTutorialBySlug(slug);
  const [current, setCurrent] = useState(1);
  const [editing, setEditing] = useState(false);
  const { hasAnyPerfil } = useAuth();
  const canManage = hasAnyPerfil(['diretor', 'admin_master']);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!tutorial) {
    return <Navigate to="/tutoriais" replace />;
  }

  const total = tutorial.steps.length;
  const step = tutorial.steps.find((s) => s.numero === current) ?? tutorial.steps[0];
  const progresso = total > 0 ? (current / total) * 100 : 0;

  const goPrev = () => setCurrent((c) => Math.max(1, c - 1));
  const goNext = () => setCurrent((c) => Math.min(total, c + 1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tutoriais" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Tutoriais
          </Link>
        </Button>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Pencil className="h-4 w-4" /> Editar tutorial
          </Button>
        )}
      </div>

      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tutorial.titulo}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">{tutorial.descricao}</p>
        <Progress value={progresso} className="h-2" />
      </header>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Este tutorial ainda não tem passos.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardContent className="p-3">
                <TutorialIndex
                  steps={tutorial.steps}
                  currentStep={current}
                  onSelect={setCurrent}
                />
              </CardContent>
            </Card>
          </aside>

          <main className="min-w-0 space-y-6">
            <TutorialStepView step={step} total={total} />

            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="outline" onClick={goPrev} disabled={current === 1} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {current} / {total}
              </span>
              <Button onClick={goNext} disabled={current === total} className="gap-1.5">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </main>
        </div>
      )}

      {editing && (
        <TutorialEditorDialog
          tutorial={tutorial}
          open
          onOpenChange={(o) => setEditing(o)}
        />
      )}
    </div>
  );
}
