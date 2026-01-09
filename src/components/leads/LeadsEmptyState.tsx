import { Inbox, Upload, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeadsEmptyStateProps {
  onImport?: () => void;
  onNewLead?: () => void;
}

export function LeadsEmptyState({ onImport, onNewLead }: LeadsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center h-20 w-20 rounded-full bg-muted mb-6">
        <Inbox className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Nenhum lead encontrado
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        Comece adicionando seu primeiro lead ou importe uma lista de contatos.
      </p>
      <div className="flex items-center gap-3">
        {onImport && (
          <Button variant="outline" onClick={onImport} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Lista
          </Button>
        )}
        {onNewLead && (
          <Button onClick={onNewLead} className="gap-2 bg-accent hover:bg-accent-hover text-accent-foreground">
            <UserPlus className="h-4 w-4" />
            Novo Lead
          </Button>
        )}
      </div>
    </div>
  );
}
