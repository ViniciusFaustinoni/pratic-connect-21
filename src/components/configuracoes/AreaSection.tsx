import { ChevronDown, LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { PerfilCard, Perfil } from './PerfilCard';

interface AreaSectionProps {
  area: string;
  icon: LucideIcon;
  gradient: string;
  borderColor: string;
  perfis: Perfil[];
  isExpanded: boolean;
  onToggle: () => void;
  onPerfilClick: (perfil: Perfil) => void;
  usuariosPorPerfil: Record<string, number>;
}

export function AreaSection({ 
  area, 
  icon: Icon, 
  gradient,
  borderColor,
  perfis, 
  isExpanded, 
  onToggle, 
  onPerfilClick, 
  usuariosPorPerfil 
}: AreaSectionProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle} className="group/area">
      <div className={cn(
        "rounded-xl border border-border/50 overflow-hidden transition-all duration-300",
        isExpanded && "shadow-md",
        `bg-gradient-to-br ${gradient}`
      )}>
        <CollapsibleTrigger asChild>
          <button 
            className={cn(
              "w-full flex items-center justify-between p-4 hover:bg-background/50 transition-colors",
              "border-l-4",
              borderColor
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-background/80 shadow-sm">
                <Icon className="w-5 h-5 text-foreground" />
              </div>
              <div className="text-left">
                <span className="font-semibold text-foreground">{area}</span>
                <p className="text-xs text-muted-foreground">
                  {perfis.length} {perfis.length === 1 ? 'perfil' : 'perfis'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-background/80 font-normal">
                {perfis.reduce((acc, p) => acc + (usuariosPorPerfil[p.id] || 0), 0)} usuários
              </Badge>
              <ChevronDown className={cn(
                "w-5 h-5 text-muted-foreground transition-transform duration-300",
                isExpanded && "rotate-180"
              )} />
            </div>
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <div className="p-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {perfis.map(perfil => (
                <PerfilCard
                  key={perfil.id}
                  perfil={perfil}
                  usuariosCount={usuariosPorPerfil[perfil.id] || 0}
                  onClick={() => onPerfilClick(perfil)}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
