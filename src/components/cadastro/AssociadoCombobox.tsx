import { useState } from 'react';
import { Check, ChevronsUpDown, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAssociados } from '@/hooks/useAssociados';

interface AssociadoComboboxProps {
  value?: string;
  onSelect: (associadoId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function AssociadoCombobox({
  value,
  onSelect,
  placeholder = 'Buscar associado...',
  disabled = false,
}: AssociadoComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: associados, isLoading } = useAssociados();

  const selectedAssociado = associados?.find((a) => a.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className="w-full justify-between font-normal"
        >
          {selectedAssociado ? (
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedAssociado.nome}</span>
              <span className="text-muted-foreground text-xs shrink-0">
                {formatCPF(selectedAssociado.cpf)}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite nome ou CPF..." />
          <CommandList>
            <CommandEmpty>Nenhum associado encontrado.</CommandEmpty>
            <CommandGroup>
              {associados?.map((associado) => (
                <CommandItem
                  key={associado.id}
                  value={`${associado.nome} ${associado.cpf}`}
                  onSelect={() => {
                    onSelect(associado.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === associado.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{associado.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      CPF: {formatCPF(associado.cpf)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
