import { GraduationCap } from 'lucide-react';
import { tutoriais } from '@/data/tutoriais';
import { TutorialCard } from '@/components/tutoriais/TutorialCard';

export default function TutoriaisLista() {
  // Agrupar por categoria
  const porCategoria = tutoriais.reduce<Record<string, typeof tutoriais>>((acc, t) => {
    (acc[t.categoria] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tutoriais de Uso</h1>
          <p className="text-sm text-muted-foreground">
            Guias práticos para você operar o sistema com segurança e velocidade.
          </p>
        </div>
      </header>

      {Object.entries(porCategoria).map(([categoria, items]) => (
        <section key={categoria} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {categoria}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TutorialCard key={t.id} tutorial={t} />
            ))}
          </div>
        </section>
      ))}

      {tutoriais.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum tutorial publicado ainda.</p>
      )}
    </div>
  );
}
