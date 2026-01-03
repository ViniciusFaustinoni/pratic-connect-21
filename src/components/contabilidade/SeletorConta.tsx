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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SeletorContaProps {
  value?: string;
  onChange: (contaId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  tipoFiltro?: 'receita' | 'despesa' | 'ativo' | 'passivo';
}

export function SeletorConta({
  value,
  onChange,
  placeholder = 'Selecione uma conta...',
  disabled = false,
  tipoFiltro,
}: SeletorContaProps) {
  const [open, setOpen] = useState(false);

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-seletor', tipoFiltro],
    queryFn: async () => {
      let query = supabase
        .from('plano_contas')
        .select('id, codigo, descricao, tipo')
        .eq('aceita_lancamento', true)
        .eq('ativa', true)
        .order('codigo');

      if (tipoFiltro) {
        query = query.eq('tipo', tipoFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const contaSelecionada = contas.find((conta) => conta.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled || isLoading}
        >
          {contaSelecionada
            ? `${contaSelecionada.codigo} - ${contaSelecionada.descricao}`
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por código ou descrição..." />
          <CommandList>
            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
            <CommandGroup>
              {contas.map((conta) => (
                <CommandItem
                  key={conta.id}
                  value={`${conta.codigo} ${conta.descricao}`}
                  onSelect={() => {
                    onChange(conta.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === conta.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-xs mr-2">{conta.codigo}</span>
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
