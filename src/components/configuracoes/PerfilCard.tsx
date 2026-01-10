import { ChevronRight, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface Perfil {
  id: string;
  label: string;
  sigla: string;
  color: string;
  area: string;
  descricao: string;
}

interface PerfilCardProps {
  perfil: Perfil;
  usuariosCount: number;
  onClick: () => void;
}

export function PerfilCard({ perfil, usuariosCount, onClick }: PerfilCardProps) {
  return (
    <Card 
      className="group cursor-pointer border-border/50 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 bg-card/50 backdrop-blur-sm"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-3 h-3 rounded-full mt-1.5 shrink-0 ring-2 ring-offset-2 ring-offset-background", perfil.color, "ring-transparent group-hover:ring-primary/30")} />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {perfil.label}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
              {perfil.descricao}
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{usuariosCount} {usuariosCount === 1 ? 'usuário' : 'usuários'}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
