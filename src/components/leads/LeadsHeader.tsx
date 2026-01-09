import { Users, UserPlus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeadsHeaderProps {
  onNovoLead: () => void;
  onImport?: () => void;
}

export function LeadsHeader({ onNovoLead, onImport }: LeadsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas oportunidades de venda
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onImport && (
          <Button variant="outline" onClick={onImport} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
        )}
        <Button
          onClick={onNovoLead}
          className="gap-2 bg-accent hover:bg-accent-hover text-accent-foreground"
        >
          <UserPlus className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>
    </div>
  );
}
