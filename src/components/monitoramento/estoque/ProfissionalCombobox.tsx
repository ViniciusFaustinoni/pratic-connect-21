import { useState } from 'react';
import { Check, ChevronsUpDown, User, UserMinus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ProfissionalOption {
  id: string;
  nome: string;
  rastreadores_atribuidos?: number;
}

interface ProfissionalComboboxProps {
  profissionais: ProfissionalOption[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  currentPortadorId?: string | null;
  allowRemove?: boolean;
  placeholder?: string;
}

export function ProfissionalCombobox({
  profissionais,
  value,
  onChange,
  loading,
  currentPortadorId,
  allowRemove,
  placeholder = 'Selecione o profissional',
}: ProfissionalComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = profissionais.find((p) => p.id === value);
  const isRemove = value === 'remover';

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={loading}
        >
          <span className="flex items-center gap-2 truncate">
            {isRemove ? (
              <>
                <UserMinus className="h-4 w-4 text-destructive" />
                <span className="text-destructive">Remover atribuição</span>
              </>
            ) : selected ? (
              <>
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{selected.nome}</span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {loading ? 'Carregando...' : placeholder}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 z-[1300]"
        align="start"
      >
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Buscar profissional..."
              className="h-10 border-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[280px]">
            <CommandEmpty>Nenhum profissional encontrado.</CommandEmpty>

            {allowRemove && currentPortadorId && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__remover__"
                    onSelect={() => {
                      onChange('remover');
                      setOpen(false);
                    }}
                    className="text-destructive aria-selected:text-destructive"
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Remover atribuição
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        isRemove ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading="Profissionais">
              {profissionais.map((p) => {
                const isCurrent = p.id === currentPortadorId;
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.nome} ${p.id}`}
                    disabled={isCurrent}
                    onSelect={() => {
                      if (isCurrent) return;
                      onChange(p.id);
                      setOpen(false);
                    }}
                  >
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{p.nome}</span>
                    {isCurrent && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (atual)
                      </span>
                    )}
                    {!isCurrent &&
                      typeof p.rastreadores_atribuidos === 'number' &&
                      p.rastreadores_atribuidos > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({p.rastreadores_atribuidos} em posse)
                        </span>
                      )}
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        value === p.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
