import { useState } from 'react';
import { Check, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useInstaladores } from '@/hooks/useRotas';

interface InstaladorMultiSelectProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InstaladorMultiSelect({
  selectedIds,
  onSelectionChange,
  disabled = false,
  placeholder = 'Selecione os instaladores',
}: InstaladorMultiSelectProps) {
  const { data: instaladores, isLoading } = useInstaladores();
  const [open, setOpen] = useState(false);

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedIds.filter((i) => i !== id));
  };

  const selectedInstaladores = instaladores?.filter((i) =>
    selectedIds.includes(i.id)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between h-auto min-h-10',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          disabled={disabled}
        >
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedInstaladores?.map((inst) => (
                <Badge
                  key={inst.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  {inst.nome}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={(e) => handleRemove(inst.id, e)}
                  />
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <User className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <ScrollArea className="h-[200px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : !instaladores?.length ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum instalador encontrado
            </div>
          ) : (
            <div className="p-1">
              {instaladores.map((inst) => {
                const isSelected = selectedIds.includes(inst.id);
                return (
                  <div
                    key={inst.id}
                    onClick={() => handleToggle(inst.id)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-2 cursor-pointer rounded-md transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-input'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="flex-1">{inst.nome}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
