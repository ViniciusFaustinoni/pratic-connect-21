import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronsUpDown, Search, AlertTriangle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

interface SinistroWithRelations {
  id: string;
  protocolo: string;
  tipo: string;
  status: string;
  associado_id: string;
  veiculo_id: string;
  associado: {
    id: string;
    nome: string;
  } | null;
  veiculo: {
    id: string;
    placa: string;
    marca: string | null;
    modelo: string | null;
  } | null;
}

interface SinistroComboboxProps {
  value?: string;
  onSelect: (sinistro: SinistroWithRelations) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SinistroCombobox({
  value,
  onSelect,
  placeholder = 'Buscar sinistro...',
  disabled = false,
}: SinistroComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: sinistros = [], isLoading } = useQuery({
    queryKey: ['sinistros-combobox', search],
    queryFn: async () => {
      let query = supabase
        .from('sinistros')
        .select(`
          id,
          protocolo,
          tipo,
          status,
          associado_id,
          veiculo_id,
          associado:associados(id, nome),
          veiculo:veiculos(id, placa, marca, modelo)
        `)
        .not('status', 'in', '(cancelado,negado)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (search) {
        query = query.or(`protocolo.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SinistroWithRelations[];
    },
  });

  const selectedSinistro = sinistros.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedSinistro ? (
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span>{selectedSinistro.protocolo}</span>
              {selectedSinistro.veiculo && (
                <Badge variant="secondary" className="ml-1">
                  {selectedSinistro.veiculo.placa}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por protocolo..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : sinistros.length === 0 ? (
              <CommandEmpty>Nenhum sinistro encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {sinistros.map((sinistro) => (
                  <CommandItem
                    key={sinistro.id}
                    value={sinistro.id}
                    onSelect={() => {
                      onSelect(sinistro);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-1 py-3"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            'h-4 w-4',
                            value === sinistro.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span className="font-medium">{sinistro.protocolo}</span>
                        <Badge variant="outline" className="text-xs">
                          {sinistro.tipo}
                        </Badge>
                      </div>
                      {sinistro.veiculo && (
                        <Badge variant="secondary">
                          {sinistro.veiculo.placa}
                        </Badge>
                      )}
                    </div>
                    <div className="ml-6 text-sm text-muted-foreground">
                      {sinistro.veiculo && (
                        <span>
                          {sinistro.veiculo.marca} {sinistro.veiculo.modelo}
                        </span>
                      )}
                      {sinistro.associado && (
                        <span className="ml-2">• {sinistro.associado.nome}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
