import { useState } from 'react';
import { Check, ChevronsUpDown, Search, User, Phone, X } from 'lucide-react';
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
import { useAllLeads } from '@/hooks/useLeads';
import type { Lead } from '@/types/vendas';

interface LeadComboboxProps {
  value?: string | null;
  onSelect: (leadId: string | null, lead?: Lead) => void;
  placeholder?: string;
  disabled?: boolean;
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function LeadCombobox({
  value,
  onSelect,
  placeholder = 'Buscar lead por nome ou telefone...',
  disabled = false,
}: LeadComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: leads = [], isLoading } = useAllLeads();

  const selectedLead = leads.find((l) => l.id === value);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null, undefined);
  };

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
          {selectedLead ? (
            <span className="flex items-center gap-2 truncate flex-1">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedLead.nome}</span>
              {selectedLead.telefone && (
                <span className="text-muted-foreground text-xs shrink-0 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {formatPhone(selectedLead.telefone)}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <div className="flex items-center gap-1 ml-2">
            {selectedLead && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Digite nome ou telefone..." />
          <CommandList>
            <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
            <CommandGroup>
              {leads.map((lead) => (
                <CommandItem
                  key={lead.id}
                  value={`${lead.nome} ${lead.telefone || ''}`}
                  onSelect={() => {
                    onSelect(lead.id, lead as Lead);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === lead.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{lead.nome}</span>
                    {lead.telefone && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhone(lead.telefone)}
                      </span>
                    )}
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
