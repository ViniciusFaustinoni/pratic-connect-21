import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock, ListChecks } from 'lucide-react';
import { Tutorial } from '@/data/tutoriais';

interface TutorialCardProps {
  tutorial: Tutorial;
}

export function TutorialCard({ tutorial }: TutorialCardProps) {
  return (
    <Link
      to={`/tutoriais/${tutorial.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
    >
      <Card className="h-full transition-all group-hover:border-primary group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <Badge variant="outline" className="text-xs">
              {tutorial.categoria}
            </Badge>
            {tutorial.novo && <Badge className="text-xs">Novo</Badge>}
          </div>
          <CardTitle className="text-lg leading-tight">{tutorial.titulo}</CardTitle>
          <CardDescription className="line-clamp-3">{tutorial.descricao}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" />
              {tutorial.steps.length} passos
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />~{tutorial.tempoEstimadoMin} min
            </span>
          </div>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </CardContent>
      </Card>
    </Link>
  );
}
