import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, ImageIcon, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolverImagemTutorial } from '@/lib/tutoriais/imagemLocal';
import type { TutorialStepRow } from '@/hooks/useTutoriais';

interface TutorialStepViewProps {
  step: TutorialStepRow;
  total: number;
}

export function TutorialStepView({ step, total }: TutorialStepViewProps) {
  const imagem = resolverImagemTutorial(step.imagem_url);
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="mb-2">
          Passo {step.numero} de {total}
        </Badge>
        <h2 className="text-2xl font-semibold tracking-tight">{step.titulo}</h2>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {step.descricao}
        </p>
      </div>

      <Card className="overflow-hidden bg-muted/30">
        <CardContent className="p-0">
          {imagem ? (
            <img
              src={imagem}
              alt={`Ilustração do passo ${step.numero}: ${step.titulo}`}
              className="w-full h-auto"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ImageIcon className="mx-auto h-10 w-10 opacity-40" />
                <p className="mt-2 text-sm">Sem imagem</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {step.dicas && step.dicas.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Dicas</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {step.dicas.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step.links && step.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {step.links.map((l, i) => (
            <Link
              key={i}
              to={l.url}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
