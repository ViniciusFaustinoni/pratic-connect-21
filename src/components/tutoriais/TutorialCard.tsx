import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, ListChecks, Pencil, Trash2 } from 'lucide-react';
import type { TutorialRow } from '@/hooks/useTutoriais';

interface TutorialCardProps {
  tutorial: TutorialRow;
  canManage?: boolean;
  onEdit?: (t: TutorialRow) => void;
  onDelete?: (t: TutorialRow) => void;
}

export function TutorialCard({ tutorial, canManage, onEdit, onDelete }: TutorialCardProps) {
  return (
    <div className="relative group">
      <Link
        to={`/tutoriais/${tutorial.slug}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      >
        <Card className="h-full transition-all group-hover:border-primary group-hover:shadow-md">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <Badge variant="outline" className="text-xs">
                {tutorial.categoria}
              </Badge>
              {tutorial.novo && <Badge className="text-xs">Novo</Badge>}
            </div>
            <CardTitle className="text-lg leading-tight pr-16">{tutorial.titulo}</CardTitle>
            <CardDescription className="line-clamp-3">{tutorial.descricao}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" />
                {tutorial.steps.length} passos
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />~{tutorial.tempo_estimado_min} min
              </span>
            </div>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </CardContent>
        </Card>
      </Link>
      {canManage && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.(tutorial);
            }}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete?.(tutorial);
            }}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
