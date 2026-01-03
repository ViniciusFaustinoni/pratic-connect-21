import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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
import { useContasAnaliticas, PlanoContas } from '@/hooks/useContabilidade';

interface ContaComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ContaCombobox({
  value,
  onValueChange,
  placeholder = 'Selecione uma conta...',
  disabled = false,
}: ContaComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: contas, isLoading } = useContasAnaliticas();

  const selectedConta = contas?.find(c => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          {selectedConta ? (
            <span className="truncate">
              {selectedConta.codigo} - {selectedConta.descricao}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar conta..." />
          <CommandList>
            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
            <CommandGroup>
              {contas?.map((conta) => (
                <CommandItem
                  key={conta.id}
                  value={`${conta.codigo} ${conta.descricao}`}
                  onSelect={() => {
                    onValueChange(conta.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === conta.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-sm mr-2">{conta.codigo}</span>
                  <span className="truncate">{conta.descricao}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
